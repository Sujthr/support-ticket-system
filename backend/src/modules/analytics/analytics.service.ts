import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  async getDashboardStats(organizationId: string) {
    const [
      totalTickets,
      openTickets,
      pendingTickets,
      resolvedTickets,
      slaBreached,
    ] = await Promise.all([
      this.prisma.ticket.count({ where: { organizationId } }),
      this.prisma.ticket.count({ where: { organizationId, status: 'OPEN' } }),
      this.prisma.ticket.count({ where: { organizationId, status: 'PENDING' } }),
      this.prisma.ticket.count({ where: { organizationId, status: 'RESOLVED' } }),
      this.prisma.ticket.count({ where: { organizationId, slaBreached: true, status: { in: ['OPEN', 'PENDING'] } } }),
    ]);

    return { totalTickets, openTickets, pendingTickets, resolvedTickets, slaBreached };
  }

  async getTicketVolumeByDay(organizationId: string, days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const tickets = await this.prisma.ticket.groupBy({
      by: ['createdAt'],
      where: {
        organizationId,
        createdAt: { gte: startDate },
      },
      _count: true,
    });

    const volumeMap = new Map<string, number>();
    for (const t of tickets) {
      const day = t.createdAt.toISOString().split('T')[0];
      volumeMap.set(day, (volumeMap.get(day) || 0) + t._count);
    }

    return Array.from(volumeMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  async getAgentPerformance(organizationId: string) {
    const agents = await this.prisma.user.findMany({
      where: {
        organizationId,
        role: { in: ['ADMIN', 'AGENT'] },
      },
      select: {
        id: true, firstName: true, lastName: true, email: true, avatar: true,
        _count: {
          select: { assignedTickets: true },
        },
        assignedTickets: {
          select: { id: true, status: true, priority: true, createdAt: true, resolvedAt: true, firstResponseAt: true, slaBreached: true },
        },
      },
    });

    return agents.map(agent => {
      const all = agent.assignedTickets;
      const resolved = all.filter(t => t.status === 'RESOLVED' || t.status === 'CLOSED');
      const open = all.filter(t => t.status === 'OPEN' || t.status === 'PENDING');
      const breached = all.filter(t => t.slaBreached);
      const withResponse = all.filter(t => t.firstResponseAt);

      // Avg resolution time (hours)
      let avgResolutionHours: number | null = null;
      if (resolved.length > 0) {
        const totalMs = resolved.reduce((sum, t) => {
          if (t.resolvedAt) return sum + (t.resolvedAt.getTime() - t.createdAt.getTime());
          return sum;
        }, 0);
        avgResolutionHours = Math.round((totalMs / resolved.length / 3600000) * 10) / 10;
      }

      // Avg first response time (hours)
      let avgFirstResponseHours: number | null = null;
      if (withResponse.length > 0) {
        const totalMs = withResponse.reduce((sum, t) => {
          return sum + (t.firstResponseAt!.getTime() - t.createdAt.getTime());
        }, 0);
        avgFirstResponseHours = Math.round((totalMs / withResponse.length / 3600000) * 10) / 10;
      }

      // SLA compliance rate
      const slaComplianceRate = all.length > 0
        ? Math.round(((all.length - breached.length) / all.length) * 100)
        : 100;

      // Resolution rate
      const resolutionRate = all.length > 0
        ? Math.round((resolved.length / all.length) * 100)
        : 0;

      // Priority breakdown
      const byPriority = {
        URGENT: all.filter(t => t.priority === 'URGENT').length,
        HIGH: all.filter(t => t.priority === 'HIGH').length,
        MEDIUM: all.filter(t => t.priority === 'MEDIUM').length,
        LOW: all.filter(t => t.priority === 'LOW').length,
      };

      return {
        id: agent.id,
        name: `${agent.firstName} ${agent.lastName}`,
        email: agent.email,
        avatar: agent.avatar,
        totalAssigned: agent._count.assignedTickets,
        openTickets: open.length,
        totalResolved: resolved.length,
        avgResolutionHours,
        avgFirstResponseHours,
        slaComplianceRate,
        resolutionRate,
        slaBreachedCount: breached.length,
        byPriority,
      };
    });
  }

  // Detailed KPI for a single agent
  async getAgentKpiDetail(agentId: string, organizationId: string) {
    const agent = await this.prisma.user.findFirst({
      where: { id: agentId, organizationId, role: { in: ['ADMIN', 'AGENT'] } },
      select: {
        id: true, firstName: true, lastName: true, email: true, avatar: true, createdAt: true,
      },
    });

    if (!agent) return null;

    const tickets = await this.prisma.ticket.findMany({
      where: { assigneeId: agentId, organizationId },
      select: {
        id: true, ticketNumber: true, title: true, status: true, priority: true,
        slaBreached: true, createdAt: true, resolvedAt: true, firstResponseAt: true, closedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const resolved = tickets.filter(t => t.status === 'RESOLVED' || t.status === 'CLOSED');
    const open = tickets.filter(t => t.status === 'OPEN' || t.status === 'PENDING');
    const breached = tickets.filter(t => t.slaBreached);

    // Resolution times per ticket for charting
    const resolutionTimes = resolved
      .filter(t => t.resolvedAt)
      .map(t => ({
        ticketNumber: t.ticketNumber,
        title: t.title,
        hours: Math.round((t.resolvedAt!.getTime() - t.createdAt.getTime()) / 3600000 * 10) / 10,
        date: t.resolvedAt!.toISOString().split('T')[0],
      }));

    // Tickets resolved per week (last 12 weeks)
    const weeklyResolved: { week: string; count: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - (i * 7 + weekStart.getDay()));
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);

      const count = resolved.filter(t => {
        const d = t.resolvedAt || t.closedAt;
        return d && d >= weekStart && d < weekEnd;
      }).length;

      weeklyResolved.push({
        week: weekStart.toISOString().split('T')[0],
        count,
      });
    }

    // Avg resolution time
    let avgResolutionHours: number | null = null;
    if (resolved.length > 0) {
      const totalMs = resolved.reduce((sum, t) => {
        if (t.resolvedAt) return sum + (t.resolvedAt.getTime() - t.createdAt.getTime());
        return sum;
      }, 0);
      avgResolutionHours = Math.round((totalMs / resolved.length / 3600000) * 10) / 10;
    }

    // Avg first response time
    const withResponse = tickets.filter(t => t.firstResponseAt);
    let avgFirstResponseHours: number | null = null;
    if (withResponse.length > 0) {
      const totalMs = withResponse.reduce((sum, t) => {
        return sum + (t.firstResponseAt!.getTime() - t.createdAt.getTime());
      }, 0);
      avgFirstResponseHours = Math.round((totalMs / withResponse.length / 3600000) * 10) / 10;
    }

    const slaComplianceRate = tickets.length > 0
      ? Math.round(((tickets.length - breached.length) / tickets.length) * 100)
      : 100;

    return {
      agent,
      summary: {
        totalAssigned: tickets.length,
        openTickets: open.length,
        resolvedTickets: resolved.length,
        slaBreachedCount: breached.length,
        slaComplianceRate,
        avgResolutionHours,
        avgFirstResponseHours,
        resolutionRate: tickets.length > 0 ? Math.round((resolved.length / tickets.length) * 100) : 0,
      },
      weeklyResolved,
      resolutionTimes: resolutionTimes.slice(0, 20),
      recentTickets: tickets.slice(0, 10),
    };
  }

  async getTicketsByPriority(organizationId: string) {
    const results = await this.prisma.ticket.groupBy({
      by: ['priority'],
      where: { organizationId },
      _count: true,
    });
    return results.map(r => ({ priority: r.priority, count: r._count }));
  }

  async getTicketsByStatus(organizationId: string) {
    const results = await this.prisma.ticket.groupBy({
      by: ['status'],
      where: { organizationId },
      _count: true,
    });
    return results.map(r => ({ status: r.status, count: r._count }));
  }
}
