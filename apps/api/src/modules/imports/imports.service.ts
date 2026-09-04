import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  FileFormat,
  ImportStatus,
  ReportModule,
  UploadStatus,
} from '@prisma/client';
import * as XLSX from 'xlsx';
import {
  BdgPreviewPayload,
  ImportPreviewPayload,
  PodsPreviewPayload,
  normalizeKey,
} from '@bdg-pods/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ParserService } from '../../parsers/parser.service';
import { UploadsService } from '../uploads/uploads.service';
import { transformBdgSheets } from './bdg-transform';
import {
  transformPodsSheets,
  transformDailyFromMatrix,
} from './pods-transform';

@Injectable()
export class ImportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly parser: ParserService,
    private readonly uploads: UploadsService,
  ) {}

  /**
   * Parse a file in-memory and return a preview.
   * Does NOT write Upload / ImportJob / business records.
   */
  async previewFromFile(file: Express.Multer.File, module: ReportModule) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('No file provided for preview');
    }

    const preview = await this.buildPreview(
      file.buffer,
      file.originalname,
      file.mimetype || 'application/octet-stream',
      module,
    );

    const recordsFound =
      preview.module === 'BDG'
        ? preview.records.length
        : preview.pods.length + preview.dailyUpdates.length;

    return {
      fileName: file.originalname,
      module,
      recordsFound,
      recordsValid: preview.validCount,
      errorCount: preview.errorCount,
      warningCount: preview.warningCount,
      preview,
    };
  }

  /**
   * Persist file + import history and upsert business data.
   * This is the only step that writes to the database.
   */
  async commitFromFile(
    file: Express.Multer.File,
    module: ReportModule,
    userId?: string | null,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('No file provided for import');
    }

    const preview = await this.buildPreview(
      file.buffer,
      file.originalname,
      file.mimetype || 'application/octet-stream',
      module,
    );

    if (preview.validCount === 0) {
      throw new BadRequestException(
        'No valid records to import. Fix errors in the file and preview again.',
      );
    }

    const upload = await this.uploads.create(file, module, userId);

    const recordsFound =
      preview.module === 'BDG'
        ? preview.records.length
        : preview.pods.length + preview.dailyUpdates.length;

    const job = await this.prisma.importJob.create({
      data: {
        uploadId: upload.id,
        module,
        status: ImportStatus.PREVIEW,
        recordsFound,
        recordsValid: preview.validCount,
        errorCount: preview.errorCount,
        warningCount: preview.warningCount,
        previewPayload: preview as object,
      },
    });

    try {
      const result =
        preview.module === 'BDG'
          ? await this.commitBdg(preview, job.id)
          : await this.commitPods(preview, job.id);

      await this.prisma.upload.update({
        where: { id: upload.id },
        data: { status: UploadStatus.PARSED, errorMessage: null },
      });

      return this.prisma.importJob.update({
        where: { id: job.id },
        data: {
          status: ImportStatus.COMMITTED,
          recordsCreated: result.created,
          recordsUpdated: result.updated,
          recordsSkipped: result.skipped,
          committedById: userId ?? null,
          committedAt: new Date(),
          summary: result.summary,
        },
        include: {
          upload: true,
          committedBy: { select: { id: true, name: true, email: true } },
        },
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Database import failed';
      await this.prisma.upload.update({
        where: { id: upload.id },
        data: { status: UploadStatus.FAILED, errorMessage: message },
      });
      await this.prisma.importJob.update({
        where: { id: job.id },
        data: {
          status: ImportStatus.FAILED,
          errorDetails: { message },
        },
      });
      throw new BadRequestException(`Database import failed: ${message}`);
    }
  }

  private async buildPreview(
    buffer: Buffer,
    fileName: string,
    mimeType: string,
    module: ReportModule,
  ): Promise<ImportPreviewPayload> {
    try {
      const parsed = await this.parser.parse(buffer, fileName, mimeType);
      const format = parsed.format as FileFormat;

      if (module === ReportModule.BDG) {
        const existing = await this.prisma.bdgMember.findMany({
          select: { normalizedMemberName: true },
        });
        const names = new Set(existing.map((e) => e.normalizedMemberName));
        const result = transformBdgSheets(parsed.sheets, parsed.rawText, names);
        return {
          module: 'BDG',
          periodStart: result.periodStart,
          periodEnd: result.periodEnd,
          records: result.records,
          validCount: result.validCount,
          warningCount: result.warningCount,
          errorCount: result.errorCount,
        } satisfies BdgPreviewPayload;
      }

      const existing = await this.prisma.pod.findMany({
        select: { normalizedName: true },
      });
      const names = new Set(existing.map((e) => e.normalizedName));
      const result = transformPodsSheets(parsed.sheets, names);

      if (format === 'XLSX' || format === 'XLS') {
        const dailyMatrix = this.readSheetMatrix(buffer, /daily/i);
        if (dailyMatrix) {
          const daily = transformDailyFromMatrix(dailyMatrix);
          if (daily.records.length > 0 || result.dailyUpdates.length === 0) {
            const oldDailyValid = result.dailyUpdates.filter(
              (r) => r.action !== 'skip',
            ).length;
            const oldDailyErrors = result.dailyUpdates.filter(
              (r) => r.action === 'skip',
            ).length;
            result.validCount =
              result.validCount - oldDailyValid + daily.validCount;
            result.errorCount =
              result.errorCount - oldDailyErrors + daily.errorCount;
            result.dailyUpdates = daily.records;
          }
        }
      }

      return {
        module: 'PODS',
        pods: result.pods,
        dailyUpdates: result.dailyUpdates,
        validCount: result.validCount,
        warningCount: result.warningCount,
        errorCount: result.errorCount,
      } satisfies PodsPreviewPayload;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to parse file';
      throw new BadRequestException(message);
    }
  }

  private async commitBdg(preview: BdgPreviewPayload, importId: string) {
    let created = 0;
    let updated = 0;
    let skipped = 0;

    await this.prisma.$transaction(async (tx) => {
      for (const record of preview.records) {
        if (
          record.action === 'skip' ||
          record.issues.some((i) => i.severity === 'error')
        ) {
          skipped += 1;
          continue;
        }
        const d = record.data;
        const normalized = normalizeKey(d.memberName);
        const existing = await tx.bdgMember.findUnique({
          where: { normalizedMemberName: normalized },
        });

        const data = {
          memberName: d.memberName.trim(),
          totalInbound: d.totalInbound,
          totalOutbound: d.totalOutbound,
          apacInbound: d.apacInbound,
          apacOutbound: d.apacOutbound,
          menaInbound: d.menaInbound,
          menaOutbound: d.menaOutbound,
          internationalInbound: d.internationalInbound,
          internationalOutbound: d.internationalOutbound,
          ukeuInbound: d.ukeuInbound,
          ukeuOutbound: d.ukeuOutbound,
          naInbound: d.naInbound,
          naOutbound: d.naOutbound,
          periodStart: d.periodStart ? new Date(d.periodStart) : null,
          periodEnd: d.periodEnd ? new Date(d.periodEnd) : null,
          sourceImportId: importId,
        };

        if (existing) {
          await tx.bdgMember.update({
            where: { id: existing.id },
            data,
          });
          updated += 1;
        } else {
          await tx.bdgMember.create({
            data: {
              ...data,
              normalizedMemberName: normalized,
            },
          });
          created += 1;
        }
      }
    });

    return {
      created,
      updated,
      skipped,
      summary: `BDG import: ${created} created, ${updated} updated, ${skipped} skipped`,
    };
  }

  private async commitPods(preview: PodsPreviewPayload, importId: string) {
    let created = 0;
    let updated = 0;
    let skipped = 0;

    await this.prisma.$transaction(async (tx) => {
      for (const record of preview.pods) {
        if (
          record.action === 'skip' ||
          record.issues.some((i) => i.severity === 'error')
        ) {
          skipped += 1;
          continue;
        }
        const d = record.data;
        const normalized = normalizeKey(d.podName);
        const existing = await tx.pod.findUnique({
          where: { normalizedName: normalized },
        });
        const data = {
          name: d.podName.trim(),
          description: d.description ?? null,
          status: d.status ?? null,
          startDate: d.startDate ? new Date(d.startDate) : null,
          developers: d.developers ?? null,
          machineOwner: d.machineOwner ?? null,
          machineAlignedToProject: d.machineAlignedToProject ?? null,
          feCompletion: d.feCompletion ?? null,
          beCompletion: d.beCompletion ?? null,
          integrationCompletion: d.integrationCompletion ?? null,
          sourceImportId: importId,
        };

        if (existing) {
          await tx.pod.update({ where: { id: existing.id }, data });
          updated += 1;
        } else {
          await tx.pod.create({
            data: { ...data, normalizedName: normalized },
          });
          created += 1;
        }
      }

      for (const record of preview.dailyUpdates) {
        if (
          record.action === 'skip' ||
          record.issues.some((i) => i.severity === 'error')
        ) {
          skipped += 1;
          continue;
        }
        const d = record.data;
        const normalized = normalizeKey(d.podName);
        let pod = await tx.pod.findUnique({
          where: { normalizedName: normalized },
        });
        if (!pod) {
          pod = await tx.pod.create({
            data: {
              name: d.podName.trim(),
              normalizedName: normalized,
              sourceImportId: importId,
            },
          });
          created += 1;
        }

        const date = new Date(d.date);
        const existingDaily = await tx.podDailyUpdate.findUnique({
          where: {
            podId_date: { podId: pod.id, date },
          },
        });

        const dailyData = {
          feCompletion: d.feCompletion,
          beCompletion: d.beCompletion,
          integrationCompletion: d.integrationCompletion,
        };

        if (existingDaily) {
          await tx.podDailyUpdate.update({
            where: { id: existingDaily.id },
            data: dailyData,
          });
          updated += 1;
        } else {
          await tx.podDailyUpdate.create({
            data: {
              podId: pod.id,
              date,
              ...dailyData,
            },
          });
          created += 1;
        }
      }
    });

    return {
      created,
      updated,
      skipped,
      summary: `PODS import: ${created} created, ${updated} updated, ${skipped} skipped`,
    };
  }

  async findAll(page = 1, pageSize = 20, module?: ReportModule) {
    const where = module ? { module } : {};
    const skip = (page - 1) * pageSize;
    const [data, total] = await Promise.all([
      this.prisma.importJob.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          upload: {
            include: {
              uploadedBy: { select: { id: true, name: true, email: true } },
            },
          },
          committedBy: { select: { id: true, name: true, email: true } },
        },
      }),
      this.prisma.importJob.count({ where }),
    ]);
    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize) || 1,
    };
  }

  async findOne(id: string) {
    const job = await this.prisma.importJob.findUnique({
      where: { id },
      include: {
        upload: {
          include: {
            uploadedBy: { select: { id: true, name: true, email: true } },
          },
        },
        committedBy: { select: { id: true, name: true, email: true } },
      },
    });
    if (!job) throw new NotFoundException('Import not found');
    return job;
  }

  private readSheetMatrix(
    buffer: Buffer,
    namePattern: RegExp,
  ): (string | number | null)[][] | null {
    try {
      const wb = XLSX.read(buffer, {
        type: 'buffer',
        cellDates: true,
        raw: true,
      });
      const sheetName = wb.SheetNames.find((n) => namePattern.test(n));
      if (!sheetName) return null;
      const sheet = wb.Sheets[sheetName];
      return XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
        header: 1,
        defval: null,
        raw: true,
        blankrows: false,
      });
    } catch {
      return null;
    }
  }
}
