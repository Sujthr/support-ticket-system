import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

  async create(
    organizationId: string,
    data: { name: string; description?: string; color?: string; icon?: string },
  ) {
    const existing = await this.prisma.ticketCategory.findUnique({
      where: { name_organizationId: { name: data.name, organizationId } },
    });

    if (existing) {
      throw new ConflictException(
        `Category with name "${data.name}" already exists`,
      );
    }

    // Place new category at the end
    const lastCategory = await this.prisma.ticketCategory.findFirst({
      where: { organizationId },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });
    const sortOrder = (lastCategory?.sortOrder ?? -1) + 1;

    return this.prisma.ticketCategory.create({
      data: {
        name: data.name,
        description: data.description,
        color: data.color,
        icon: data.icon,
        sortOrder,
        organizationId,
      },
    });
  }

  async findAll(organizationId: string) {
    return this.prisma.ticketCategory.findMany({
      where: { organizationId },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async update(
    id: string,
    data: {
      name?: string;
      description?: string;
      color?: string;
      icon?: string;
      isActive?: boolean;
    },
  ) {
    const category = await this.prisma.ticketCategory.findUnique({
      where: { id },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    // If renaming, check uniqueness within the same org
    if (data.name && data.name !== category.name) {
      const duplicate = await this.prisma.ticketCategory.findUnique({
        where: {
          name_organizationId: {
            name: data.name,
            organizationId: category.organizationId,
          },
        },
      });

      if (duplicate) {
        throw new ConflictException(
          `Category with name "${data.name}" already exists`,
        );
      }
    }

    return this.prisma.ticketCategory.update({
      where: { id },
      data,
    });
  }

  async delete(id: string) {
    const category = await this.prisma.ticketCategory.findUnique({
      where: { id },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return this.prisma.ticketCategory.delete({ where: { id } });
  }

  async reorder(organizationId: string, ids: string[]) {
    const updates = ids.map((id, index) =>
      this.prisma.ticketCategory.updateMany({
        where: { id, organizationId },
        data: { sortOrder: index },
      }),
    );

    await this.prisma.$transaction(updates);

    return this.findAll(organizationId);
  }
}
