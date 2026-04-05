import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface';

@Injectable()
export class OrganizationsService {
  constructor(private prisma: PrismaService) {}

  async findOne(user: AuthenticatedUser) {
    const org = await this.prisma.organization.findUnique({
      where: { id: user.organizationId },
      include: {
        _count: { select: { users: true, tickets: true } },
      },
    });
    if (!org) throw new NotFoundException('Organization not found');
    return org;
  }

  async update(user: AuthenticatedUser, data: { name?: string; logo?: string; domain?: string }) {
    return this.prisma.organization.update({
      where: { id: user.organizationId },
      data,
    });
  }

  async getTags(user: AuthenticatedUser) {
    return this.prisma.tag.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { name: 'asc' },
    });
  }
}
