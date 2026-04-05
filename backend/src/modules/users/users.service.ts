import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface';
import { PaginatedResponse, PaginationDto } from '../../common/dto/pagination.dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: PaginationDto & { role?: string }, user: AuthenticatedUser) {
    const where: any = { organizationId: user.organizationId };
    if (query.role) where.role = query.role;

    const skip = (query.page - 1) * query.limit;
    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: query.limit,
        select: {
          id: true, email: true, firstName: true, lastName: true,
          role: true, avatar: true, isActive: true, lastLoginAt: true, createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);
    return new PaginatedResponse(users, total, query.page, query.limit);
  }

  async findOne(id: string, user: AuthenticatedUser) {
    const found = await this.prisma.user.findFirst({
      where: { id, organizationId: user.organizationId },
      select: {
        id: true, email: true, firstName: true, lastName: true,
        role: true, avatar: true, isActive: true, lastLoginAt: true, createdAt: true,
        _count: { select: { assignedTickets: true, createdTickets: true } },
      },
    });
    if (!found) throw new NotFoundException('User not found');
    return found;
  }

  async getAgents(user: AuthenticatedUser) {
    return this.prisma.user.findMany({
      where: {
        organizationId: user.organizationId,
        role: { in: ['ADMIN', 'AGENT'] },
        isActive: true,
      },
      select: { id: true, firstName: true, lastName: true, email: true, role: true, avatar: true },
      orderBy: { firstName: 'asc' },
    });
  }

  async updateProfile(userId: string, data: { firstName?: string; lastName?: string; avatar?: string }) {
    return this.prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true, email: true, firstName: true, lastName: true,
        role: true, avatar: true, isActive: true,
      },
    });
  }

  async toggleActive(id: string, user: AuthenticatedUser) {
    const target = await this.prisma.user.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!target) throw new NotFoundException('User not found');

    return this.prisma.user.update({
      where: { id },
      data: { isActive: !target.isActive },
      select: { id: true, email: true, firstName: true, lastName: true, isActive: true },
    });
  }
}
