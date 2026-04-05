import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

interface CreatePriorityData {
  name: string;
  level: number;
  color?: string;
  icon?: string;
}

interface UpdatePriorityData {
  name?: string;
  level?: number;
  color?: string;
  icon?: string;
}

@Injectable()
export class PrioritiesService {
  constructor(private prisma: PrismaService) {}

  async create(organizationId: string, data: CreatePriorityData) {
    // Check unique name within org
    const existingName = await this.prisma.customPriority.findUnique({
      where: { name_organizationId: { name: data.name, organizationId } },
    });

    if (existingName) {
      throw new ConflictException(
        `Priority with name "${data.name}" already exists`,
      );
    }

    // Check unique level within org
    const existingLevel = await this.prisma.customPriority.findUnique({
      where: { level_organizationId: { level: data.level, organizationId } },
    });

    if (existingLevel) {
      throw new ConflictException(
        `Priority with level ${data.level} already exists`,
      );
    }

    return this.prisma.customPriority.create({
      data: {
        name: data.name,
        level: data.level,
        color: data.color,
        icon: data.icon,
        organizationId,
      },
    });
  }

  async findAll(organizationId: string) {
    return this.prisma.customPriority.findMany({
      where: { organizationId },
      orderBy: { level: 'desc' },
    });
  }

  async update(id: string, data: UpdatePriorityData) {
    const priority = await this.prisma.customPriority.findUnique({
      where: { id },
    });

    if (!priority) {
      throw new NotFoundException('Priority not found');
    }

    // If renaming, check uniqueness within the same org
    if (data.name && data.name !== priority.name) {
      const duplicate = await this.prisma.customPriority.findUnique({
        where: {
          name_organizationId: {
            name: data.name,
            organizationId: priority.organizationId,
          },
        },
      });

      if (duplicate) {
        throw new ConflictException(
          `Priority with name "${data.name}" already exists`,
        );
      }
    }

    // If changing level, check uniqueness within the same org
    if (data.level !== undefined && data.level !== priority.level) {
      const duplicate = await this.prisma.customPriority.findUnique({
        where: {
          level_organizationId: {
            level: data.level,
            organizationId: priority.organizationId,
          },
        },
      });

      if (duplicate) {
        throw new ConflictException(
          `Priority with level ${data.level} already exists`,
        );
      }
    }

    return this.prisma.customPriority.update({
      where: { id },
      data,
    });
  }

  async delete(id: string) {
    const priority = await this.prisma.customPriority.findUnique({
      where: { id },
    });

    if (!priority) {
      throw new NotFoundException('Priority not found');
    }

    return this.prisma.customPriority.delete({ where: { id } });
  }

  async seedDefaults(organizationId: string) {
    const existing = await this.prisma.customPriority.findFirst({
      where: { organizationId },
    });

    if (existing) {
      return this.findAll(organizationId);
    }

    const defaults = [
      { name: 'LOW', level: 1, color: '#22C55E', isDefault: true },
      { name: 'MEDIUM', level: 2, color: '#F59E0B', isDefault: true },
      { name: 'HIGH', level: 3, color: '#EF4444', isDefault: true },
      { name: 'URGENT', level: 4, color: '#DC2626', isDefault: true },
    ];

    await this.prisma.$transaction(
      defaults.map((p) =>
        this.prisma.customPriority.create({
          data: { ...p, organizationId },
        }),
      ),
    );

    return this.findAll(organizationId);
  }
}
