import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';

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

  async update(user: AuthenticatedUser, data: { name?: string; logo?: string; domain?: string; autoAssignMode?: string }) {
    return this.prisma.organization.update({
      where: { id: user.organizationId },
      data,
    });
  }

  async uploadLogo(user: AuthenticatedUser, file: Express.Multer.File) {
    const uploadsDir = path.join(process.cwd(), 'uploads', 'logos');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // Delete old logo file if it exists
    const currentOrg = await this.prisma.organization.findUnique({
      where: { id: user.organizationId },
      select: { logo: true },
    });
    if (currentOrg?.logo?.startsWith('/uploads/logos/')) {
      const oldPath = path.join(process.cwd(), currentOrg.logo);
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    }

    const ext = path.extname(file.originalname).toLowerCase() || '.png';
    const fileName = `${crypto.randomUUID()}${ext}`;
    const filePath = path.join(uploadsDir, fileName);
    fs.writeFileSync(filePath, file.buffer);

    const logoUrl = `/uploads/logos/${fileName}`;
    return this.prisma.organization.update({
      where: { id: user.organizationId },
      data: { logo: logoUrl },
    });
  }

  async getTags(user: AuthenticatedUser) {
    return this.prisma.tag.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { name: 'asc' },
    });
  }
}
