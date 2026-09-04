import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { isAggregateMemberName, normalizeKey } from '@bdg-pods/shared';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface BdgListQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  member?: string;
  members?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  periodStart?: string;
  periodEnd?: string;
}

export interface BdgUpsertDto {
  memberName: string;
  totalInbound?: number | null;
  totalOutbound?: number | null;
  apacInbound?: number | null;
  apacOutbound?: number | null;
  menaInbound?: number | null;
  menaOutbound?: number | null;
  internationalInbound?: number | null;
  internationalOutbound?: number | null;
  ukeuInbound?: number | null;
  ukeuOutbound?: number | null;
  naInbound?: number | null;
  naOutbound?: number | null;
  periodStart?: string | null;
  periodEnd?: string | null;
}

@Injectable()
export class BdgService {
  constructor(private readonly prisma: PrismaService) {}

  private memberWhere(query: BdgListQuery): Prisma.BdgMemberWhereInput {
    const where: Prisma.BdgMemberWhereInput = {};

    if (query.search) {
      where.OR = [
        { memberName: { contains: query.search, mode: 'insensitive' } },
        { normalizedMemberName: { contains: query.search.toLowerCase() } },
      ];
    }
    if (query.member) {
      where.memberName = { contains: query.member, mode: 'insensitive' };
    }
    if (query.members) {
      const names = query.members
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (names.length) {
        where.OR = names.map((n) => ({
          memberName: { equals: n, mode: 'insensitive' as const },
        }));
      }
    }
    if (query.periodStart || query.periodEnd) {
      where.AND = [];
      if (query.periodStart) {
        (where.AND as Prisma.BdgMemberWhereInput[]).push({
          periodEnd: { gte: new Date(query.periodStart) },
        });
      }
      if (query.periodEnd) {
        (where.AND as Prisma.BdgMemberWhereInput[]).push({
          periodStart: { lte: new Date(query.periodEnd) },
        });
      }
    }
    return where;
  }

  async findAll(query: BdgListQuery) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where = this.memberWhere(query);

    const sortBy = query.sortBy ?? 'updatedAt';
    const sortDir = query.sortDir ?? 'desc';
    const allowed = new Set([
      'memberName',
      'totalInbound',
      'totalOutbound',
      'updatedAt',
      'createdAt',
    ]);
    const orderBy: Prisma.BdgMemberOrderByWithRelationInput = allowed.has(sortBy)
      ? { [sortBy]: sortDir }
      : { updatedAt: 'desc' };

    const [raw, total, allForTotals] = await Promise.all([
      this.prisma.bdgMember.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy,
      }),
      this.prisma.bdgMember.count({ where }),
      this.prisma.bdgMember.findMany({ where }),
    ]);

    const data = raw
      .filter((m) => !isAggregateMemberName(m.memberName))
      .map((m) => this.enrich(m));

    return {
      data,
      totals: this.computeTotals(allForTotals),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize) || 1,
    };
  }

  async findOne(id: string) {
    const member = await this.prisma.bdgMember.findUnique({ where: { id } });
    if (!member) throw new NotFoundException('BDG member not found');
    if (isAggregateMemberName(member.memberName)) {
      throw new NotFoundException('BDG member not found');
    }
    return this.enrich(member);
  }

  async create(dto: BdgUpsertDto) {
    this.assertValidMember(dto.memberName);
    this.assertNonNegative(dto);
    const normalized = normalizeKey(dto.memberName);
    const existing = await this.prisma.bdgMember.findUnique({
      where: { normalizedMemberName: normalized },
    });
    if (existing) {
      throw new BadRequestException(
        `BDG member already exists: "${dto.memberName}". Use update instead.`,
      );
    }
    const created = await this.prisma.bdgMember.create({
      data: this.toPrismaData(dto, normalized),
    });
    return this.enrich(created);
  }

  async update(id: string, dto: BdgUpsertDto) {
    const existing = await this.prisma.bdgMember.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('BDG member not found');
    this.assertValidMember(dto.memberName ?? existing.memberName);
    this.assertNonNegative(dto);
    const normalized = normalizeKey(dto.memberName);
    if (normalized !== existing.normalizedMemberName) {
      const clash = await this.prisma.bdgMember.findUnique({
        where: { normalizedMemberName: normalized },
      });
      if (clash && clash.id !== id) {
        throw new BadRequestException(
          `Another BDG member already uses the name "${dto.memberName}"`,
        );
      }
    }
    const updated = await this.prisma.bdgMember.update({
      where: { id },
      data: {
        ...this.toPrismaData(dto, normalized),
        normalizedMemberName: normalized,
      },
    });
    return this.enrich(updated);
  }

  async remove(id: string) {
    const existing = await this.prisma.bdgMember.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('BDG member not found');
    await this.prisma.bdgMember.delete({ where: { id } });
    return { id, deleted: true };
  }

  async purgeAggregateRows() {
    const all = await this.prisma.bdgMember.findMany();
    const bad = all.filter((m) => isAggregateMemberName(m.memberName));
    if (bad.length) {
      await this.prisma.bdgMember.deleteMany({
        where: { id: { in: bad.map((b) => b.id) } },
      });
    }
    return { deleted: bad.length };
  }

  async summary() {
    await this.purgeAggregateRows();
    const members = await this.prisma.bdgMember.findMany();
    const filtered = members.filter((m) => !isAggregateMemberName(m.memberName));
    let totalInbound = 0;
    let totalOutbound = 0;
    for (const m of filtered) {
      totalInbound += m.totalInbound ?? 0;
      totalOutbound += m.totalOutbound ?? 0;
    }
    return {
      totalMembers: filtered.length,
      totalLeads: totalInbound + totalOutbound,
      inboundLeads: totalInbound,
      outboundLeads: totalOutbound,
    };
  }

  async byRegion(query: BdgListQuery = {}) {
    const members = await this.prisma.bdgMember.findMany({
      where: this.memberWhere(query),
    });
    const filtered = members.filter((m) => !isAggregateMemberName(m.memberName));
    const regions = [
      { key: 'APAC', inbound: 'apacInbound', outbound: 'apacOutbound' },
      { key: 'MENA', inbound: 'menaInbound', outbound: 'menaOutbound' },
      {
        key: 'INTERNATIONAL',
        inbound: 'internationalInbound',
        outbound: 'internationalOutbound',
      },
      { key: 'UK/EU', inbound: 'ukeuInbound', outbound: 'ukeuOutbound' },
      { key: 'NA', inbound: 'naInbound', outbound: 'naOutbound' },
    ] as const;

    return regions.map((r) => {
      let inbound = 0;
      let outbound = 0;
      for (const m of filtered) {
        inbound += (m[r.inbound as keyof typeof m] as number | null) ?? 0;
        outbound += (m[r.outbound as keyof typeof m] as number | null) ?? 0;
      }
      return { region: r.key, inbound, outbound, total: inbound + outbound };
    });
  }

  async topMembers(limit = 10, query: BdgListQuery = {}) {
    const members = await this.prisma.bdgMember.findMany({
      where: this.memberWhere(query),
    });
    return members
      .filter((m) => !isAggregateMemberName(m.memberName))
      .map((m) => this.enrich(m))
      .sort((a, b) => b.totalLeads - a.totalLeads)
      .slice(0, limit);
  }

  async exportAll(query: BdgListQuery) {
    const result = await this.findAll({ ...query, page: 1, pageSize: 10000 });
    return result.data;
  }

  private computeTotals(
    members: Array<{
      totalInbound: number | null;
      totalOutbound: number | null;
      apacInbound: number | null;
      apacOutbound: number | null;
      menaInbound: number | null;
      menaOutbound: number | null;
      internationalInbound: number | null;
      internationalOutbound: number | null;
      ukeuInbound: number | null;
      ukeuOutbound: number | null;
      naInbound: number | null;
      naOutbound: number | null;
      memberName: string;
    }>,
  ) {
    const filtered = members.filter((m) => !isAggregateMemberName(m.memberName));
    const sum = (pick: (m: (typeof filtered)[0]) => number | null) =>
      filtered.reduce((a, m) => a + (pick(m) ?? 0), 0);

    const totalInbound = sum((m) => m.totalInbound);
    const totalOutbound = sum((m) => m.totalOutbound);
    return {
      memberName: 'Total',
      totalInbound,
      totalOutbound,
      totalLeads: totalInbound + totalOutbound,
      apacTotal: sum((m) => m.apacInbound) + sum((m) => m.apacOutbound),
      menaTotal: sum((m) => m.menaInbound) + sum((m) => m.menaOutbound),
      internationalTotal:
        sum((m) => m.internationalInbound) + sum((m) => m.internationalOutbound),
      ukeuTotal: sum((m) => m.ukeuInbound) + sum((m) => m.ukeuOutbound),
      naTotal: sum((m) => m.naInbound) + sum((m) => m.naOutbound),
      isTotalsRow: true,
    };
  }

  private assertValidMember(name: string) {
    const trimmed = name?.trim() ?? '';
    if (!trimmed) {
      throw new BadRequestException('BDG Member is required');
    }
    if (isAggregateMemberName(trimmed)) {
      throw new BadRequestException(
        'Cannot create or update a BDG member named "Total". Totals are calculated dynamically.',
      );
    }
  }

  private assertNonNegative(dto: BdgUpsertDto) {
    const fields: Array<keyof BdgUpsertDto> = [
      'totalInbound',
      'totalOutbound',
      'apacInbound',
      'apacOutbound',
      'menaInbound',
      'menaOutbound',
      'internationalInbound',
      'internationalOutbound',
      'ukeuInbound',
      'ukeuOutbound',
      'naInbound',
      'naOutbound',
    ];
    for (const f of fields) {
      const v = dto[f];
      if (typeof v === 'number' && v < 0) {
        throw new BadRequestException(`Lead values cannot be negative (${f})`);
      }
    }
  }

  private toPrismaData(dto: BdgUpsertDto, normalized: string) {
    return {
      memberName: dto.memberName.trim(),
      normalizedMemberName: normalized,
      totalInbound: dto.totalInbound ?? null,
      totalOutbound: dto.totalOutbound ?? null,
      apacInbound: dto.apacInbound ?? null,
      apacOutbound: dto.apacOutbound ?? null,
      menaInbound: dto.menaInbound ?? null,
      menaOutbound: dto.menaOutbound ?? null,
      internationalInbound: dto.internationalInbound ?? null,
      internationalOutbound: dto.internationalOutbound ?? null,
      ukeuInbound: dto.ukeuInbound ?? null,
      ukeuOutbound: dto.ukeuOutbound ?? null,
      naInbound: dto.naInbound ?? null,
      naOutbound: dto.naOutbound ?? null,
      periodStart: dto.periodStart ? new Date(dto.periodStart) : null,
      periodEnd: dto.periodEnd ? new Date(dto.periodEnd) : null,
    };
  }

  private enrich<T extends {
    totalInbound: number | null;
    totalOutbound: number | null;
    apacInbound: number | null;
    apacOutbound: number | null;
    menaInbound: number | null;
    menaOutbound: number | null;
    internationalInbound: number | null;
    internationalOutbound: number | null;
    ukeuInbound: number | null;
    ukeuOutbound: number | null;
    naInbound: number | null;
    naOutbound: number | null;
  }>(m: T) {
    const inbound = m.totalInbound ?? 0;
    const outbound = m.totalOutbound ?? 0;
    return {
      ...m,
      totalLeads: inbound + outbound,
      apacTotal: (m.apacInbound ?? 0) + (m.apacOutbound ?? 0),
      menaTotal: (m.menaInbound ?? 0) + (m.menaOutbound ?? 0),
      internationalTotal:
        (m.internationalInbound ?? 0) + (m.internationalOutbound ?? 0),
      ukeuTotal: (m.ukeuInbound ?? 0) + (m.ukeuOutbound ?? 0),
      naTotal: (m.naInbound ?? 0) + (m.naOutbound ?? 0),
    };
  }
}
