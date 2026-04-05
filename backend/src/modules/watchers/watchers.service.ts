import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class WatchersService {
  constructor(private prisma: PrismaService) {}

  async addWatcher(ticketId: string, userId: string, organizationId: string) {
    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId, organizationId },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');

    const user = await this.prisma.user.findFirst({
      where: { id: userId, organizationId },
    });
    if (!user) throw new NotFoundException('User not found in this organization');

    const existing = await this.prisma.ticketWatcher.findUnique({
      where: { ticketId_userId: { ticketId, userId } },
    });
    if (existing) throw new ConflictException('User is already watching this ticket');

    return this.prisma.ticketWatcher.create({
      data: { ticketId, userId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatar: true,
          },
        },
      },
    });
  }

  async removeWatcher(ticketId: string, userId: string) {
    const existing = await this.prisma.ticketWatcher.findUnique({
      where: { ticketId_userId: { ticketId, userId } },
    });
    if (!existing) throw new NotFoundException('Watcher not found');

    await this.prisma.ticketWatcher.delete({
      where: { ticketId_userId: { ticketId, userId } },
    });

    return { message: 'Watcher removed' };
  }

  async getWatchers(ticketId: string) {
    const watchers = await this.prisma.ticketWatcher.findMany({
      where: { ticketId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatar: true,
            role: true,
          },
        },
      },
      orderBy: { addedAt: 'asc' },
    });

    return watchers.map((w) => ({
      ...w.user,
      addedAt: w.addedAt,
    }));
  }

  async getWatcherIds(ticketId: string): Promise<string[]> {
    const watchers = await this.prisma.ticketWatcher.findMany({
      where: { ticketId },
      select: { userId: true },
    });

    return watchers.map((w) => w.userId);
  }

  async isWatching(ticketId: string, userId: string): Promise<boolean> {
    const watcher = await this.prisma.ticketWatcher.findUnique({
      where: { ticketId_userId: { ticketId, userId } },
    });

    return !!watcher;
  }
}
