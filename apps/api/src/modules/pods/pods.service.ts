import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { normalizeKey, normalizePercentage, overallCompletion } from '@bdg-pods/shared';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface PodsListQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  statuses?: string;
  ids?: string;
  developer?: string;
  startDateFrom?: string;
  startDateTo?: string;
  completionMin?: number;
  completionMax?: number;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  limit?: number;
}

export interface PodUpsertDto {
  name: string;
  description?: string | null;
  status?: string | null;
  startDate?: string | null;
  developers?: string | null;
  machineOwner?: string | null;
  machineAlignedToProject?: string | null;
  feCompletion?: number | null;
  beCompletion?: number | null;
  integrationCompletion?: number | null;
}

@Injectable()
export class PodsService {
  constructor(private readonly prisma: PrismaService) {}

  private baseWhere(query: PodsListQuery): Prisma.PodWhereInput {
    const where: Prisma.PodWhereInput = {};

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { developers: { contains: query.search, mode: 'insensitive' } },
        { machineOwner: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    if (query.status) {
      where.status = { equals: query.status, mode: 'insensitive' };
    }
    if (query.statuses) {
      const list = query.statuses.split(',').map((s) => s.trim()).filter(Boolean);
      if (list.length) {
        where.OR = list.map((s) => ({
          status: { equals: s, mode: 'insensitive' as const },
        }));
      }
    }
    if (query.ids) {
      const ids = query.ids.split(',').map((s) => s.trim()).filter(Boolean);
      if (ids.length) where.id = { in: ids };
    }
    if (query.developer) {
      where.developers = { contains: query.developer, mode: 'insensitive' };
    }
    if (query.startDateFrom || query.startDateTo) {
      where.startDate = {};
      if (query.startDateFrom) {
        where.startDate.gte = new Date(query.startDateFrom);
      }
      if (query.startDateTo) {
        where.startDate.lte = new Date(query.startDateTo);
      }
    }
    return where;
  }

  async findAll(query: PodsListQuery) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where = this.baseWhere(query);

    const [raw, totalAll] = await Promise.all([
      this.prisma.pod.findMany({ where, orderBy: { updatedAt: 'desc' } }),
      this.prisma.pod.count({ where }),
    ]);

    let enriched = raw.map((p) => this.enrich(p));

    if (query.completionMin !== undefined) {
      enriched = enriched.filter(
        (p) => (p.overallCompletion ?? 0) >= query.completionMin!,
      );
    }
    if (query.completionMax !== undefined) {
      enriched = enriched.filter(
        (p) => (p.overallCompletion ?? 0) <= query.completionMax!,
      );
    }

    const sortBy = query.sortBy ?? 'updatedAt';
    const sortDir = query.sortDir ?? 'desc';
    enriched.sort((a, b) => {
      const av = (a as Record<string, unknown>)[sortBy];
      const bv = (b as Record<string, unknown>)[sortBy];
      if (av === bv) return 0;
      if (av === null || av === undefined) return 1;
      if (bv === null || bv === undefined) return -1;
      const cmp = av < bv ? -1 : 1;
      return sortDir === 'asc' ? cmp : -cmp;
    });

    const total = enriched.length;
    const data = enriched.slice((page - 1) * pageSize, page * pageSize);

    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize) || 1,
      matchedBeforeCompletionFilter: totalAll,
    };
  }

  async findOne(id: string) {
    const pod = await this.prisma.pod.findUnique({
      where: { id },
      include: {
        dailyUpdates: { orderBy: { date: 'asc' } },
      },
    });
    if (!pod) throw new NotFoundException('POD not found');
    return this.enrich(pod);
  }

  async create(dto: PodUpsertDto) {
    this.assertValidPod(dto);
    const normalized = normalizeKey(dto.name);
    const existing = await this.prisma.pod.findUnique({
      where: { normalizedName: normalized },
    });
    if (existing) {
      throw new BadRequestException(
        `POD already exists: "${dto.name}". Use update instead.`,
      );
    }
    const created = await this.prisma.pod.create({
      data: this.toPrismaData(dto, normalized),
    });
    return this.enrich(created);
  }

  async update(id: string, dto: PodUpsertDto) {
    const existing = await this.prisma.pod.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('POD not found');
    this.assertValidPod(dto);
    const normalized = normalizeKey(dto.name);
    if (normalized !== existing.normalizedName) {
      const clash = await this.prisma.pod.findUnique({
        where: { normalizedName: normalized },
      });
      if (clash && clash.id !== id) {
        throw new BadRequestException(
          `Another POD already uses the name "${dto.name}"`,
        );
      }
    }
    const updated = await this.prisma.pod.update({
      where: { id },
      data: {
        ...this.toPrismaData(dto, normalized),
        normalizedName: normalized,
      },
    });
    return this.enrich(updated);
  }

  async remove(id: string) {
    const existing = await this.prisma.pod.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('POD not found');
    await this.prisma.pod.delete({ where: { id } });
    return { id, deleted: true };
  }

  async summary() {
    const pods = await this.prisma.pod.findMany();
    const enriched = pods.map((p) => this.enrich(p));
    const totalPods = enriched.length;

    const normalizeStatus = (s: string | null | undefined) =>
      (s ?? 'unknown').trim().toLowerCase();

    const inProgress = enriched.filter((p) =>
      /progress|wip|ongoing/i.test(normalizeStatus(p.status)),
    ).length;
    const completed = enriched.filter((p) =>
      /complete|done|closed/i.test(normalizeStatus(p.status)),
    ).length;
    const notStarted = enriched.filter((p) =>
      /not\s*start|pending|new|todo/i.test(normalizeStatus(p.status)),
    ).length;

    const avg = (pick: (p: (typeof enriched)[0]) => number | null) => {
      const vals = enriched
        .map(pick)
        .filter((v): v is number => typeof v === 'number');
      if (!vals.length) return 0;
      return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100;
    };

    return {
      totalPods,
      inProgress,
      completed,
      notStarted,
      avgFeCompletion: avg((p) => p.feCompletion),
      avgBeCompletion: avg((p) => p.beCompletion),
      avgIntegrationCompletion: avg((p) => p.integrationCompletion),
      overallAverageCompletion: avg((p) => p.overallCompletion),
    };
  }

  async statusDistribution(query: PodsListQuery = {}) {
    const pods = await this.prisma.pod.findMany({
      where: this.baseWhere(query),
      select: { status: true },
    });
    const map = new Map<string, number>();
    for (const p of pods) {
      const key = (p.status ?? 'Unknown').trim() || 'Unknown';
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return [...map.entries()].map(([status, count]) => ({ status, count }));
  }

  async completion(limit = 20, query: PodsListQuery = {}) {
    const pods = await this.prisma.pod.findMany({
      where: this.baseWhere(query),
    });
    return pods
      .map((p) => this.enrich(p))
      .sort((a, b) => (b.overallCompletion ?? 0) - (a.overallCompletion ?? 0))
      .slice(0, limit)
      .map((p) => ({
        id: p.id,
        name: p.name,
        feCompletion: p.feCompletion,
        beCompletion: p.beCompletion,
        integrationCompletion: p.integrationCompletion,
        overallCompletion: p.overallCompletion,
        status: p.status,
      }));
  }

  async history(
    id: string,
    opts?: {
      dateFrom?: string;
      dateTo?: string;
      range?: 'all' | 'daily' | 'weekly' | 'custom';
    },
  ) {
    const pod = await this.prisma.pod.findUnique({
      where: { id },
      include: { dailyUpdates: { orderBy: { date: 'asc' } } },
    });
    if (!pod) throw new NotFoundException('POD not found');

    let history = pod.dailyUpdates;
    const range = opts?.range ?? 'all';
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (range === 'daily') {
      history = history.filter(
        (h) => h.date.toISOString().slice(0, 10) === today.toISOString().slice(0, 10),
      );
    } else if (range === 'weekly') {
      const from = new Date(today);
      from.setDate(from.getDate() - 6);
      history = history.filter((h) => h.date >= from && h.date <= today);
    } else if (range === 'custom' || opts?.dateFrom || opts?.dateTo) {
      if (opts?.dateFrom) {
        const from = new Date(opts.dateFrom);
        history = history.filter((h) => h.date >= from);
      }
      if (opts?.dateTo) {
        const to = new Date(opts.dateTo);
        history = history.filter((h) => h.date <= to);
      }
    }

    return {
      pod: this.enrich(pod),
      history,
    };
  }

  async exportAll(query: PodsListQuery) {
    const result = await this.findAll({ ...query, page: 1, pageSize: 10000 });
    return result.data;
  }

  private assertValidPod(dto: PodUpsertDto) {
    if (!dto.name?.trim()) {
      throw new BadRequestException('POD Name is required');
    }
    for (const [label, value] of [
      ['FE', dto.feCompletion],
      ['BE', dto.beCompletion],
      ['Integration', dto.integrationCompletion],
    ] as const) {
      if (value === null || value === undefined) continue;
      const n = normalizePercentage(value);
      if (n === null || n < 0 || n > 100) {
        throw new BadRequestException(
          `Invalid completion percentage for ${label}`,
        );
      }
    }
  }

  private toPrismaData(dto: PodUpsertDto, normalized: string) {
    return {
      name: dto.name.trim(),
      normalizedName: normalized,
      description: dto.description ?? null,
      status: dto.status ?? null,
      startDate: dto.startDate ? new Date(dto.startDate) : null,
      developers: dto.developers ?? null,
      machineOwner: dto.machineOwner ?? null,
      machineAlignedToProject: dto.machineAlignedToProject ?? null,
      feCompletion:
        dto.feCompletion === null || dto.feCompletion === undefined
          ? null
          : normalizePercentage(dto.feCompletion),
      beCompletion:
        dto.beCompletion === null || dto.beCompletion === undefined
          ? null
          : normalizePercentage(dto.beCompletion),
      integrationCompletion:
        dto.integrationCompletion === null ||
        dto.integrationCompletion === undefined
          ? null
          : normalizePercentage(dto.integrationCompletion),
    };
  }

  private enrich<
    T extends {
      feCompletion: number | null;
      beCompletion: number | null;
      integrationCompletion: number | null;
    },
  >(pod: T) {
    return {
      ...pod,
      overallCompletion: overallCompletion(
        pod.feCompletion,
        pod.beCompletion,
        pod.integrationCompletion,
      ),
    };
  }
}
