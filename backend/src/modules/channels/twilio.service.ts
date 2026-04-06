import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { ChannelsService } from './channels.service';
import * as crypto from 'crypto';

interface TwilioVoiceWebhook {
  CallSid: string;
  From: string;
  To: string;
  CallStatus: string;
  Direction: string;
  CallerCity?: string;
  CallerState?: string;
  CallerCountry?: string;
  RecordingUrl?: string;
  TranscriptionText?: string;
}

interface TwilioSmsWebhook {
  MessageSid: string;
  From: string;
  To: string;
  Body: string;
  NumMedia?: string;
  MediaUrl0?: string;
  MediaContentType0?: string;
}

@Injectable()
export class TwilioService {
  private readonly logger = new Logger(TwilioService.name);

  constructor(
    private prisma: PrismaService,
    private channelsService: ChannelsService,
  ) {}

  /**
   * Validate Twilio webhook signature to ensure authenticity.
   * Returns false if validation fails — webhook should be rejected.
   */
  validateSignature(
    authToken: string,
    signature: string,
    url: string,
    params: Record<string, string>,
  ): boolean {
    try {
      // Build the data string: URL + sorted params
      const data = url + Object.keys(params)
        .sort()
        .reduce((acc, key) => acc + key + params[key], '');

      const expected = crypto
        .createHmac('sha1', authToken)
        .update(data)
        .digest('base64');

      return signature === expected;
    } catch {
      return false;
    }
  }

  /**
   * Handle incoming voice call webhook from Twilio.
   * Creates a ticket and returns TwiML response.
   */
  async handleIncomingCall(payload: TwilioVoiceWebhook): Promise<{ twiml: string; ticket: any }> {
    const orgId = await this.channelsService.findOrgByTwilioNumber(payload.To);
    if (!orgId) {
      this.logger.warn(`No org found for Twilio number ${payload.To}`);
      return {
        twiml: this.buildTwiml('Sorry, this support number is not configured. Please try again later.', false),
        ticket: null,
      };
    }

    const config = await this.prisma.channelConfig.findUnique({
      where: { organizationId: orgId },
    });

    const locationParts = [payload.CallerCity, payload.CallerState, payload.CallerCountry].filter(Boolean);
    const location = locationParts.length > 0 ? ` (${locationParts.join(', ')})` : '';

    const body = `Incoming call from ${payload.From}${location}\nCall SID: ${payload.CallSid}\nStatus: ${payload.CallStatus}`;

    const ticket = await this.channelsService.createTicketFromChannel({
      channel: 'PHONE',
      senderIdentity: payload.From,
      body,
      externalId: payload.CallSid,
      rawPayload: JSON.stringify(payload),
      organizationId: orgId,
    });

    const ticketNumber = ticket.ticketNumber || 'new';
    const shouldRecord = config?.twilioRecordCalls ?? false;

    const twiml = this.buildTwiml(
      `Thank you for calling support. Your ticket number is ${ticketNumber}. An agent will get back to you shortly. ${shouldRecord ? 'Please leave a message after the beep.' : 'Goodbye.'}`,
      shouldRecord,
    );

    return { twiml, ticket };
  }

  /**
   * Handle call status callback (recording ready, transcription, etc.)
   */
  async handleCallStatus(payload: TwilioVoiceWebhook) {
    if (!payload.CallSid) return;

    const inbound = await this.prisma.inboundMessage.findFirst({
      where: { externalId: payload.CallSid },
    });

    if (!inbound?.ticketId) return;

    // If we have a transcription or recording, add it as a comment
    if (payload.TranscriptionText || payload.RecordingUrl) {
      const systemUser = await this.prisma.user.findFirst({
        where: { organizationId: inbound.organizationId, role: 'ADMIN', isActive: true },
        orderBy: { createdAt: 'asc' },
      });

      if (systemUser) {
        let commentBody = '**[Voicemail Update]**\n\n';
        if (payload.TranscriptionText) {
          commentBody += `**Transcription:** ${payload.TranscriptionText}\n\n`;
        }
        if (payload.RecordingUrl) {
          commentBody += `**Recording:** ${payload.RecordingUrl}\n`;
        }

        await this.prisma.comment.create({
          data: {
            body: commentBody,
            isInternal: true,
            ticketId: inbound.ticketId,
            authorId: systemUser.id,
          },
        });
      }
    }
  }

  /**
   * Handle incoming WhatsApp message via Twilio.
   */
  async handleWhatsAppMessage(payload: TwilioSmsWebhook): Promise<{ reply: string; ticket: any }> {
    // Twilio WhatsApp numbers have "whatsapp:" prefix
    const to = payload.To.replace('whatsapp:', '');
    const from = payload.From.replace('whatsapp:', '');

    const orgId = await this.channelsService.findOrgByTwilioNumber(to);
    if (!orgId) {
      this.logger.warn(`No org found for Twilio WhatsApp number ${to}`);
      return { reply: '', ticket: null };
    }

    const config = await this.prisma.channelConfig.findUnique({
      where: { organizationId: orgId },
    });

    const mediaUrls: string[] = [];
    const numMedia = parseInt(payload.NumMedia || '0', 10);
    for (let i = 0; i < numMedia; i++) {
      const url = (payload as any)[`MediaUrl${i}`];
      if (url) mediaUrls.push(url);
    }

    let body = payload.Body || '';
    if (mediaUrls.length > 0) {
      body += '\n\n**Attachments:**\n' + mediaUrls.map((url, i) => `- [Media ${i + 1}](${url})`).join('\n');
    }

    const ticket = await this.channelsService.createTicketFromChannel({
      channel: 'WHATSAPP',
      senderIdentity: from,
      body,
      externalId: payload.MessageSid,
      rawPayload: JSON.stringify(payload),
      organizationId: orgId,
      mediaUrls,
    });

    const autoReply = config?.autoReplyEnabled !== false;
    const ticketNumber = ticket.ticketNumber || 'new';
    const reply = autoReply
      ? `Your support ticket #${ticketNumber} has been created. Our team will respond shortly.`
      : '';

    return { reply, ticket };
  }

  /**
   * Build TwiML XML response for voice calls.
   */
  private buildTwiml(message: string, record: boolean): string {
    let twiml = '<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n';
    twiml += `  <Say voice="alice">${this.escapeXml(message)}</Say>\n`;
    if (record) {
      twiml += '  <Record maxLength="120" transcribe="true" />\n';
      twiml += '  <Say voice="alice">We did not receive a recording. Goodbye.</Say>\n';
    }
    twiml += '</Response>';
    return twiml;
  }

  private escapeXml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}
