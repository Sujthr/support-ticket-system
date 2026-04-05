import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface';

@Injectable()
export class CannedResponsesService {
  constructor(private prisma: PrismaService) {}

  async create(
    user: AuthenticatedUser,
    data: {
      title: string;
      content: string;
      shortcut?: string;
      categoryTag?: string;
      isShared?: boolean;
    },
  ) {
    return this.prisma.cannedResponse.create({
      data: {
        title: data.title,
        content: data.content,
        shortcut: data.shortcut || null,
        categoryTag: data.categoryTag || null,
        isShared: data.isShared ?? true,
        authorId: user.id,
        organizationId: user.organizationId,
      },
      include: {
        author: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });
  }

  async findAll(user: AuthenticatedUser) {
    return this.prisma.cannedResponse.findMany({
      where: {
        organizationId: user.organizationId,
        OR: [
          { isShared: true },
          { authorId: user.id },
        ],
      },
      include: {
        author: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
      orderBy: { title: 'asc' },
    });
  }

  async update(
    id: string,
    userId: string,
    data: {
      title?: string;
      content?: string;
      shortcut?: string;
      categoryTag?: string;
      isShared?: boolean;
    },
    userRole: string,
  ) {
    const response = await this.prisma.cannedResponse.findUnique({
      where: { id },
    });

    if (!response) {
      throw new NotFoundException('Canned response not found');
    }

    if (response.authorId !== userId && userRole !== 'ADMIN') {
      throw new ForbiddenException('You can only edit your own canned responses');
    }

    return this.prisma.cannedResponse.update({
      where: { id },
      data: {
        title: data.title,
        content: data.content,
        shortcut: data.shortcut,
        categoryTag: data.categoryTag,
        isShared: data.isShared,
      },
      include: {
        author: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });
  }

  async delete(id: string, userId: string, userRole: string) {
    const response = await this.prisma.cannedResponse.findUnique({
      where: { id },
    });

    if (!response) {
      throw new NotFoundException('Canned response not found');
    }

    if (response.authorId !== userId && userRole !== 'ADMIN') {
      throw new ForbiddenException('You can only delete your own canned responses');
    }

    await this.prisma.cannedResponse.delete({ where: { id } });
    return { message: 'Canned response deleted' };
  }

  async findByShortcut(orgId: string, shortcut: string) {
    return this.prisma.cannedResponse.findFirst({
      where: {
        organizationId: orgId,
        shortcut,
      },
    });
  }
}
