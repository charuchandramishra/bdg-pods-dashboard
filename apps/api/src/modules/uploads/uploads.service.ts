import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileFormat, ReportModule, UploadStatus } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ParserService } from '../../parsers/parser.service';
import {
  ALLOWED_EXTENSIONS,
  ALLOWED_MIME_TYPES,
} from '../../parsers/file-parser.interface';

@Injectable()
export class UploadsService {
  private readonly uploadDir: string;
  private readonly maxBytes: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly parser: ParserService,
    private readonly config: ConfigService,
  ) {
    this.uploadDir = path.resolve(
      process.cwd(),
      this.config.get<string>('UPLOAD_DIR') ?? './uploads',
    );
    const maxMb = Number(this.config.get('MAX_UPLOAD_SIZE_MB') ?? 20);
    this.maxBytes = maxMb * 1024 * 1024;
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  async create(
    file: Express.Multer.File,
    module: ReportModule,
    userId?: string | null,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    if (file.size > this.maxBytes) {
      throw new BadRequestException(
        `File exceeds maximum size of ${this.maxBytes / (1024 * 1024)} MB`,
      );
    }

    const sanitized = this.sanitizeFilename(file.originalname);
    const ext = sanitized.split('.').pop()?.toLowerCase() ?? '';
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      throw new BadRequestException(
        'Invalid file type. Supported formats: CSV, XLS, XLSX, DOC, DOCX, PDF.',
      );
    }
    if (
      file.mimetype &&
      !ALLOWED_MIME_TYPES.has(file.mimetype) &&
      file.mimetype !== 'application/octet-stream'
    ) {
      throw new BadRequestException(
        `Invalid MIME type: ${file.mimetype}. Supported formats: CSV, XLS, XLSX, DOC, DOCX, PDF.`,
      );
    }

    const format = this.parser.detect(sanitized, file.mimetype || '');
    const storedName = `${Date.now()}-${Math.random().toString(36).slice(2)}-${sanitized}`;
    const fullPath = path.join(this.uploadDir, storedName);
    fs.writeFileSync(fullPath, file.buffer);

    const upload = await this.prisma.upload.create({
      data: {
        originalName: sanitized,
        storedName,
        mimeType: file.mimetype || 'application/octet-stream',
        format: format as FileFormat,
        sizeBytes: file.size,
        module,
        status: UploadStatus.PENDING,
        uploadedById: userId ?? null,
      },
      include: {
        uploadedBy: { select: { id: true, name: true, email: true } },
      },
    });

    return upload;
  }

  async findAll(page = 1, pageSize = 20) {
    const skip = (page - 1) * pageSize;
    const [data, total] = await Promise.all([
      this.prisma.upload.findMany({
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          uploadedBy: { select: { id: true, name: true, email: true } },
        },
      }),
      this.prisma.upload.count(),
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
    const upload = await this.prisma.upload.findUnique({
      where: { id },
      include: {
        uploadedBy: { select: { id: true, name: true, email: true } },
        imports: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!upload) throw new NotFoundException('Upload not found');
    return upload;
  }

  getFilePath(storedName: string): string {
    return path.join(this.uploadDir, storedName);
  }

  readFile(storedName: string): Buffer {
    const fullPath = this.getFilePath(storedName);
    if (!fs.existsSync(fullPath)) {
      throw new NotFoundException('Uploaded file missing on disk');
    }
    return fs.readFileSync(fullPath);
  }

  private sanitizeFilename(name: string): string {
    const base = path.basename(name).replace(/[^\w.\- ()[\]]+/g, '_');
    return base.slice(0, 180) || 'upload.bin';
  }
}
