import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class SlaService {
  private readonly logger = new Logger(SlaService.name);

  constructor(private prisma: PrismaService) {}

  // Check for SLA breaches every 5 minutes
  @Cron(CronExpression.EVERY_5_MINUTES)
  async checkSlaBreaches() {
    const now = new Date();

    // Find tickets that are past their due date and not yet marked as breached
    const breachedTickets = await this.prisma.ticket.findMany({
      where: {
        slaBreached: false,
        dueAt: { lt: now },
        status: { in: ['OPEN', 'PENDING'] },
      },
      include: {
        assignee: true,
        organization: true,
      },
    });

    if (breachedTickets.length === 0) return;

    this.logger.log(`Found ${breachedTickets.length} SLA breaches`);

    for (const ticket of breachedTickets) {
      await this.prisma.ticket.update({
        where: { id: ticket.id },
        data: { slaBreached: true },
      });

      // Create notification for assignee/admins
      if (ticket.assigneeId) {
        await this.prisma.notification.create({
          data: {
            type: 'SLA_BREACH',
            title: 'SLA Breach',
            message: `Ticket #${ticket.ticketNumber} "${ticket.title}" has breached its SLA`,
            recipientId: ticket.assigneeId,
            organizationId: ticket.organizationId,
            metadata: JSON.stringify({ ticketId: ticket.id }),
          },
        });
      }

      await this.prisma.activityLog.create({
        data: {
          action: 'SLA_BREACHED',
          ticketId: ticket.id,
          userId: ticket.assigneeId || ticket.creatorId,
          details: JSON.stringify({ dueAt: ticket.dueAt }),
        },
      });
    }
  }

  async getSlaPolicies(organizationId: string) {
    return this.prisma.slaPolicy.findMany({
      where: { organizationId },
      orderBy: { priority: 'asc' },
    });
  }

  async updateSlaPolicy(
    id: string,
    data: { firstResponseMinutes?: number; resolutionMinutes?: number; isActive?: boolean },
  ) {
    return this.prisma.slaPolicy.update({ where: { id }, data });
  }
}
