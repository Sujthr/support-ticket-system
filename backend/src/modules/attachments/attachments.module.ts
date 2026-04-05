import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { AttachmentsController } from './attachments.controller';
import { AttachmentsService } from './attachments.service';

@Module({
  imports: [
    MulterModule.register({ storage: undefined }), // memory storage for buffer access
  ],
  controllers: [AttachmentsController],
  providers: [AttachmentsService],
})
export class AttachmentsModule {}
