import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { ChannelsService } from './channels.service';
import * as crypto from 'crypto';

interface MetaWebhookEntry {
  id: string;
  changes: Array<{
    value: {
      messaging_product: string;
      metadata: { display_phone_number: string; phone_number_id: string };
      contacts?: Array<{ profile: { name: string }; wa_id: string }>;
      messages?: Array<{
        id: string;
        from: string;
        timestamp: string;
        type: string;
        text?: { body: string };
        image?: { id: string; mime_type: string; caption?: string };
        document?: { id: string; mime_type: string; filename: string; caption?: string };
        audio?: { id: string; mime_type: string };
        video?: { id: string; mime_type: string; caption?: string };
        location?: { latitude: number; longitude: number; name?: string; address?: string };
      }>;
      statuses?: Array<{ id: string; status: string; timestamp: string }>;
    };
    field: string;
  }>;
}

@Injectable()
export class MetaWhatsappService {
  private readonly logger = new Logger(MetaWhatsappService.name);

  constructor(
    private prisma: PrismaService,
    private channelsService: ChannelsService,
  ) {}

  /**
   * Verify the webhook subscription (GET request from Meta).
   */
  verifyWebhook(
    mode: string,
    token: string,
    challenge: string,
    verifyToken: string,
  ): string | null {
    if (mode === 'subscribe' && token === verifyToken) {
      this.logger.log('Meta WhatsApp webhook verified');
      return challenge;
    }
    return null;
  }

  /**
   * Validate incoming webhook signature from Meta.
   */
  validateSignature(payload: string, signature: string, appSecret: string): boolean {
    try {
      const expected = crypto
        .createHmac('sha256', appSecret)
        .update(payload)
        .digest('hex');
      return `sha256=${expected}` === signature;
    } catch {
      return false;
    }
  }

  /**
   * Process incoming webhook from Meta WhatsApp Cloud API.
   */
  async handleWebhook(body: { object: string; entry: MetaWebhookEntry[] }) {
    if (body.object !== 'whatsapp_business_account') return;

    for (const entry of body.entry) {
      for (const change of entry.changes) {
        if (change.field !== 'messages') continue;

        const value = change.value;
        const phoneNumberId = value.metadata?.phone_number_id;
        if (!phoneNumberId) continue;

        const orgId = await this.channelsService.findOrgByMetaPhoneId(phoneNumberId);
        if (!orgId) {
          this.logger.warn(`No org found for Meta phone_number_id ${phoneNumberId}`);
          continue;
        }

        const config = await this.prisma.channelConfig.findUnique({
          where: { organizationId: orgId },
        });

        const messages = value.messages || [];
        const contacts = value.contacts || [];

        for (const message of messages) {
          const contactName = contacts.find(c => c.wa_id === message.from)?.profile?.name || message.from;
          const body = this.extractMessageBody(message);

          const ticket = await this.channelsService.createTicketFromChannel({
            channel: 'WHATSAPP',
            senderIdentity: `+${message.from}`,
            subject: `WhatsApp from ${contactName}`,
            body,
            externalId: message.id,
            rawPayload: JSON.stringify({ entry, contact: contactName }),
            organizationId: orgId,
          });

          // Send auto-reply if enabled
          if (config?.autoReplyEnabled !== false && config?.metaWhatsappToken && ticket.ticketNumber) {
            await this.sendMessage(
              config.metaWhatsappToken,
              config.metaWhatsappPhoneId!,
              message.from,
              `Your support ticket #${ticket.ticketNumber} has been created. Our team will respond shortly.`,
            ).catch(err => {
              this.logger.warn(`Failed to send WhatsApp auto-reply: ${err.message}`);
            });
          }
        }
      }
    }
  }

  /**
   * Send a WhatsApp message via Meta Cloud API.
   * Gracefully fails if token is not configured.
   */
  async sendMessage(
    accessToken: string,
    phoneNumberId: string,
    to: string,
    text: string,
  ): Promise<boolean> {
    try {
      const response = await fetch(
        `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to,
            type: 'text',
            text: { body: text },
          }),
        },
      );

      if (!response.ok) {
        const error = await response.text();
        this.logger.warn(`Meta WhatsApp API error: ${error}`);
        return false;
      }

      return true;
    } catch (error) {
      this.logger.warn(`Failed to send WhatsApp message: ${error.message}`);
      return false;
    }
  }

  private extractMessageBody(message: any): string {
    switch (message.type) {
      case 'text':
        return message.text?.body || '';
      case 'image':
        return `[Image]${message.image?.caption ? ` ${message.image.caption}` : ''}`;
      case 'document':
        return `[Document: ${message.document?.filename || 'file'}]${message.document?.caption ? ` ${message.document.caption}` : ''}`;
      case 'audio':
        return '[Voice message]';
      case 'video':
        return `[Video]${message.video?.caption ? ` ${message.video.caption}` : ''}`;
      case 'location':
        const loc = message.location;
        return `[Location: ${loc?.name || ''} ${loc?.address || ''} (${loc?.latitude}, ${loc?.longitude})]`;
      default:
        return `[${message.type || 'unknown'} message]`;
    }
  }
}
