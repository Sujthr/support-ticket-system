import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface';
import { PaginatedResponse, PaginationDto } from '../../common/dto/pagination.dto';

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  async create(data: {
    type: any;
    title: string;
    message: string;
    recipientId: string;
    organizationId: string;
    metadata?: any;
  }) {
    return this.prisma.notification.create({ data });
  }

  async findAll(query: PaginationDto & { unreadOnly?: string }, user: AuthenticatedUser) {
    const where: any = {
      recipientId: user.id,
      organizationId: user.organizationId,
    };
    if (query.unreadOnly === 'true') where.isRead = false;

    const skip = (query.page - 1) * query.limit;
    const [notifications, total] = await Promise.all([
      this.prisma.notification.findMany({
        where, skip, take: query.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.notification.count({ where }),
    ]);

    return new PaginatedResponse(notifications, total, query.page, query.limit);
  }

  async getUnreadCount(user: AuthenticatedUser) {
    const count = await this.prisma.notification.count({
      where: { recipientId: user.id, isRead: false },
    });
    return { count };
  }

  async markAsRead(id: string, user: AuthenticatedUser) {
    return this.prisma.notification.updateMany({
      where: { id, recipientId: user.id },
      data: { isRead: true },
    });
  }

  async markAllAsRead(user: AuthenticatedUser) {
    return this.prisma.notification.updateMany({
      where: { recipientId: user.id, isRead: false },
      data: { isRead: true },
    });
  }
}
