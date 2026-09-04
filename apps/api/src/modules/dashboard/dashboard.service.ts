import { Injectable } from '@nestjs/common';
import { isAggregateMemberName, overallCompletion } from '@bdg-pods/shared';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async summary() {
    const [membersRaw, pods] = await Promise.all([
      this.prisma.bdgMember.findMany(),
      this.prisma.pod.findMany(),
    ]);

    const members = membersRaw.filter(
      (m) => !isAggregateMemberName(m.memberName),
    );

    let totalInbound = 0;
    let totalOutbound = 0;
    for (const m of members) {
      totalInbound += m.totalInbound ?? 0;
      totalOutbound += m.totalOutbound ?? 0;
    }

    const normalizeStatus = (s: string | null | undefined) =>
      (s ?? '').trim().toLowerCase();

    const podsInProgress = pods.filter((p) =>
      /progress|wip|ongoing/i.test(normalizeStatus(p.status)),
    ).length;
    const podsCompleted = pods.filter((p) =>
      /complete|done|closed/i.test(normalizeStatus(p.status)),
    ).length;

    const avg = (vals: Array<number | null | undefined>) => {
      const n = vals.filter((v): v is number => typeof v === 'number');
      if (!n.length) return 0;
      return Math.round((n.reduce((a, b) => a + b, 0) / n.length) * 100) / 100;
    };

    const overalls = pods.map((p) =>
      overallCompletion(p.feCompletion, p.beCompletion, p.integrationCompletion),
    );

    return {
      totalBdgMembers: members.length,
      totalInboundLeads: totalInbound,
      totalOutboundLeads: totalOutbound,
      totalLeads: totalInbound + totalOutbound,
      totalPods: pods.length,
      podsInProgress,
      podsCompleted,
      avgPodCompletion: avg(overalls),
      avgFeCompletion: avg(pods.map((p) => p.feCompletion)),
      avgBeCompletion: avg(pods.map((p) => p.beCompletion)),
      avgIntegrationCompletion: avg(pods.map((p) => p.integrationCompletion)),
    };
  }
}
