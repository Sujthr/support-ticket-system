import { BadRequestException, Injectable, NotFoundException, PayloadTooLargeException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface';
import { AppLogger } from '../../common/logger/app-logger.service';
import { isAllowedImage, detectImageKind } from '../../common/security/file-validation';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';

const MAX_LOGO_SIZE = 2 * 1024 * 1024; // 2 MB

@Injectable()
export class OrganizationsService {
  constructor(
    private prisma: PrismaService,
    private readonly logger: AppLogger,
  ) {}

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
    if (!file?.buffer) {
      throw new BadRequestException('No file provided');
    }

    if (file.size > MAX_LOGO_SIZE) {
      this.logger.high('logo rejected: oversize', 'OrgLogo', {
        userId: user.id, orgId: user.organizationId, size: file.size,
      });
      throw new PayloadTooLargeException(`Logo exceeds ${MAX_LOGO_SIZE} bytes`);
    }

    // Magic-byte check — reject anything that isn't a real raster image.
    // SVG is intentionally *not* allowed (scripted XSS vector when served inline).
    const kind = detectImageKind(file.buffer);
    if (!kind || !isAllowedImage(file.buffer, ['png', 'jpeg', 'gif', 'webp'])) {
      this.logger.high('logo rejected: invalid signature', 'OrgLogo', {
        userId: user.id, orgId: user.organizationId,
        claimed: file.mimetype, detected: kind,
      });
      throw new BadRequestException('Unsupported image format (png, jpeg, gif, webp only)');
    }

    const uploadsDir = path.join(process.cwd(), 'uploads', 'logos');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const currentOrg = await this.prisma.organization.findUnique({
      where: { id: user.organizationId },
      select: { logo: true },
    });
    if (currentOrg?.logo?.startsWith('/uploads/logos/')) {
      const oldPath = path.join(process.cwd(), currentOrg.logo);
      if (fs.existsSync(oldPath)) {
        try { fs.unlinkSync(oldPath); } catch (err: any) {
          this.logger.medium('failed to delete old logo', 'OrgLogo', { err: err.message });
        }
      }
    }

    const extByKind: Record<string, string> = { png: '.png', jpeg: '.jpg', gif: '.gif', webp: '.webp' };
    const fileName = `${crypto.randomUUID()}${extByKind[kind]}`;
    const filePath = path.join(uploadsDir, fileName);
    fs.writeFileSync(filePath, file.buffer);

    this.logger.medium('logo uploaded', 'OrgLogo', {
      userId: user.id, orgId: user.organizationId, kind, size: file.size,
    });

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
