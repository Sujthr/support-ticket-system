import { Module } from '@nestjs/common';
import { EmailModule } from '../email/email.module';
import { ChannelsService } from './channels.service';
import { InboundEmailService } from './inbound-email.service';
import { TwilioService } from './twilio.service';
import { MetaWhatsappService } from './meta-whatsapp.service';
import { ChannelsConfigController, WebhooksController } from './channels.controller';

@Module({
  imports: [EmailModule],
  controllers: [ChannelsConfigController, WebhooksController],
  providers: [ChannelsService, InboundEmailService, TwilioService, MetaWhatsappService],
  exports: [ChannelsService],
})
export class ChannelsModule {}
