import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class AttachmentsService {
  constructor(private prisma: PrismaService) {}

  async uploadFile(
    file: Express.Multer.File,
    ticketId?: string,
    commentId?: string,
  ) {
    // In production, upload to S3. For MVP, store locally.
    const uploadsDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const fileName = `${Date.now()}-${file.originalname}`;
    const filePath = path.join(uploadsDir, fileName);
    fs.writeFileSync(filePath, file.buffer);

    return this.prisma.attachment.create({
      data: {
        fileName: file.originalname,
        fileUrl: `/uploads/${fileName}`,
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
