import { Module } from '@nestjs/common';
import { SlaController } from './sla.controller';
import { SlaService } from './sla.service';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [EmailModule],
  controllers: [SlaController],
  providers: [SlaService],
  exports: [SlaService],
})
export class SlaModule {}
