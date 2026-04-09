import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';

const ALLOWED_MIME_TYPES = [
  'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml',
  'application/pdf',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain', 'text/csv',
  'application/zip', 'application/x-zip-compressed',
];

@Injectable()
export class AttachmentsService {
  constructor(private prisma: PrismaService) {}

  async uploadFile(
    file: Express.Multer.File,
    ticketId?: string,
    commentId?: string,
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    // Validate MIME type
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        `File type "${file.mimetype}" is not allowed. Allowed types: images, PDF, Office documents, text, CSV, ZIP.`,
      );
    }

    const uploadsDir = path.join(process.cwd(), 'uploads', 'attachments');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // Use UUID filename to prevent path traversal and predictability
    const ext = path.extname(file.originalname).toLowerCase().replace(/[^a-z0-9.]/g, '');
    const fileName = `${crypto.randomUUID()}${ext}`;
    const filePath = path.join(uploadsDir, fileName);
    fs.writeFileSync(filePath, file.buffer);

    return this.prisma.attachment.create({
      data: {
        fileName: file.originalname,
        fileUrl: `/uploads/attachments/${fileName}`,
        fileSize: file.size,
        mimeType: file.mimetype,
        ticketId,
        commentId,
      },
    });
  }

  async deleteAttachment(id: string) {
    const attachment = await this.prisma.attachment.findUnique({ where: { id } });
    if (attachment) {
      // Delete file from disk
      const filePath = path.join(process.cwd(), attachment.fileUrl);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      await this.prisma.attachment.delete({ where: { id } });
    }
    return { message: 'Attachment deleted' };
  }
}
