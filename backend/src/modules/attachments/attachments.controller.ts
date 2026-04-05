import {
  Controller, Post, Delete, Param, Query, UseGuards, UseInterceptors, UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { AttachmentsService } from './attachments.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('Attachments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('attachments')
export class AttachmentsController {
  constructor(private attachmentsService: AttachmentsService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } })) // 10MB limit
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload a file attachment' })
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Query('ticketId') ticketId?: string,
    @Query('commentId') commentId?: string,
  ) {
    return this.attachmentsService.uploadFile(file, ticketId, commentId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an attachment' })
  async delete(@Param('id') id: string) {
    return this.attachmentsService.deleteAttachment(id);
  }
}
