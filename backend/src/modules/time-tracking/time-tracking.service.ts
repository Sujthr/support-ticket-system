import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface';

interface LogTimeDto {
  minutes: number;
  description?: string;
}

@Injectable()
export class TimeTrackingService {
  constructor(private prisma: PrismaService) {}

  async logTime(ticketId: string, userId: string, data: LogTimeDto) {
    if (!data.minutes || data.minutes <= 0 || !Number.isInteger(data.minutes)) {
      throw new BadRequestException('Minutes must be a positive integer');
    }

    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { id: true, organizationId: true },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');

    const entry = await this.prisma.timeEntry.create({
      data: {
        minutes: data.minutes,
        description: data.description || null,
        ticketId,
        userId,
      },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true, avatar: true },
        },
      },
    });

    // Update ticket total time
    await this.prisma.ticket.update({
      where: { id: ticketId },
      data: {
        totalTimeMinutes: { increment: data.minutes },
      },
    });

    return entry;
  }

  async getEntries(ticketId: string) {
    return this.prisma.timeEntry.findMany({
      where: { ticketId },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true, avatar: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async deleteEntry(id: string, user: AuthenticatedUser) {
    const entry = await this.prisma.timeEntry.findUnique({
      where: { id },
      include: { ticket: { select: { organizationId: true } } },
    });

    if (!entry) throw new NotFoundException('Time entry not found');

    if (entry.ticket.organizationId !== user.organizationId) {
      throw new NotFoundException('Time entry not found');
    }

    if (entry.userId !== user.id && user.role !== 'ADMIN') {
      throw new ForbiddenException('Only the author or an admin can delete this entry');
    }

    await this.prisma.timeEntry.delete({ where: { id } });

    // Decrement ticket total time
    await this.prisma.ticket.update({
      where: { id: entry.ticketId },
      data: {
        totalTimeMinutes: { decrement: entry.minutes },
      },
    });

    return { message: 'Time entry deleted' };
  }

  async getAgentTimeStats(agentId: string, organizationId: string) {
    const entries = await this.prisma.timeEntry.findMany({
      where: {
        userId: agentId,
        ticket: { organizationId },
      },
      select: { minutes: true, ticketId: true },
    });

    if (entries.length === 0) {
      return {
        totalMinutes: 0,
        totalEntries: 0,
        uniqueTickets: 0,
        averageMinutesPerTicket: null,
      };
    }

    const totalMinutes = entries.reduce((acc, e) => acc + e.minutes, 0);
    const uniqueTickets = new Set(entries.map((e) => e.ticketId)).size;
    const averageMinutesPerTicket = Math.round((totalMinutes / uniqueTickets) * 100) / 100;

    return {
      totalMinutes,
      totalEntries: entries.length,
      uniqueTickets,
      averageMinutesPerTicket,
    };
  }
}
