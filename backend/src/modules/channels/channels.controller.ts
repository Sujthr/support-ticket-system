import {
  Controller, Get, Post, Delete, Body, Query, Req, Res, UseGuards, Headers, Logger, RawBodyRequest,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiExcludeEndpoint } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { PrismaService } from '../../database/prisma.service';
import { ChannelsService } from './channels.service';
import { TwilioService } from './twilio.service';
import { MetaWhatsappService } from './meta-whatsapp.service';
import { InboundEmailService } from './inbound-email.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface';

// ─── Admin Config Endpoints (JWT protected) ───────────────────

@ApiTags('Channels')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('channels')
export class ChannelsConfigController {
  private readonly logger = new Logger(ChannelsConfigController.name);

  constructor(
    private prisma: PrismaService,
    private channelsService: ChannelsService,
    private inboundEmailService: InboundEmailService,
  ) {}

  @Get('config')
  @ApiOperation({ summary: 'Get channel configuration (Admin only)' })
  async getConfig(@CurrentUser() user: AuthenticatedUser) {
    const config = await this.prisma.channelConfig.findUnique({
      where: { organizationId: user.organizationId },
    });

    if (!config) return null;

    // Mask sensitive fields
    return {
      ...config,
      imapPass: config.imapPass ? '••••••••' : '',
      twilioAuthToken: config.twilioAuthToken ? '••••••••' : '',
      metaWhatsappToken: config.metaWhatsappToken ? '••••••••' : '',
    };
  }

  @Post('config')
  @ApiOperation({ summary: 'Save/update channel configuration (Admin only)' })
  async saveConfig(
    @Body() dto: {
      // IMAP
      imapEnabled?: boolean;
      imapHost?: string;
      imapPort?: number;
      imapUser?: string;
      imapPass?: string;
      imapTls?: boolean;
      // Twilio
      twilioEnabled?: boolean;
      twilioAccountSid?: string;
      twilioAuthToken?: string;
      twilioPhoneNumber?: string;
      twilioRecordCalls?: boolean;
      // Meta WhatsApp
      metaWhatsappEnabled?: boolean;
      metaWhatsappToken?: string;
      metaWhatsappPhoneId?: string;
      metaWhatsappVerifyToken?: string;
      metaWhatsappBusinessId?: string;
      // Common
      autoReplyEnabled?: boolean;
      deduplicateMinutes?: number;
    },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    // Preserve masked passwords
    const existing = await this.prisma.channelConfig.findUnique({
      where: { organizationId: user.organizationId },
    });

    const imapPass = (!dto.imapPass || dto.imapPass === '••••••••')
      ? existing?.imapPass ?? ''
      : dto.imapPass;
    const twilioAuthToken = (!dto.twilioAuthToken || dto.twilioAuthToken === '••••••••')
      ? existing?.twilioAuthToken ?? ''
      : dto.twilioAuthToken;
    const metaWhatsappToken = (!dto.metaWhatsappToken || dto.metaWhatsappToken === '••••••••')
      ? existing?.metaWhatsappToken ?? ''
      : dto.metaWhatsappToken;

    const data = {
      imapEnabled: dto.imapEnabled ?? false,
      imapHost: dto.imapHost ?? null,
      imapPort: dto.imapPort ?? 993,
      imapUser: dto.imapUser ?? null,
      imapPass: imapPass || null,
      imapTls: dto.imapTls ?? true,
      twilioEnabled: dto.twilioEnabled ?? false,
      twilioAccountSid: dto.twilioAccountSid ?? null,
      twilioAuthToken: twilioAuthToken || null,
      twilioPhoneNumber: dto.twilioPhoneNumber ?? null,
      twilioRecordCalls: dto.twilioRecordCalls ?? false,
      metaWhatsappEnabled: dto.metaWhatsappEnabled ?? false,
      metaWhatsappToken: metaWhatsappToken || null,
      metaWhatsappPhoneId: dto.metaWhatsappPhoneId ?? null,
      metaWhatsappVerifyToken: dto.metaWhatsappVerifyToken ?? null,
      metaWhatsappBusinessId: dto.metaWhatsappBusinessId ?? null,
      autoReplyEnabled: dto.autoReplyEnabled ?? true,
      deduplicateMinutes: dto.deduplicateMinutes ?? 30,
    };

    const config = await this.prisma.channelConfig.upsert({
      where: { organizationId: user.organizationId },
      create: { ...data, organizationId: user.organizationId },
      update: data,
    });

    return {
      ...config,
      imapPass: config.imapPass ? '••••••••' : '',
      twilioAuthToken: config.twilioAuthToken ? '••••••••' : '',
      metaWhatsappToken: config.metaWhatsappToken ? '••••••••' : '',
    };
  }

  @Delete('config')
  @ApiOperation({ summary: 'Delete channel configuration (Admin only)' })
  async deleteConfig(@CurrentUser() user: AuthenticatedUser) {
    await this.prisma.channelConfig.deleteMany({
      where: { organizationId: user.organizationId },
    });
    return { message: 'Channel configuration deleted' };
  }

  @Post('test-imap')
  @ApiOperation({ summary: 'Test IMAP connection (Admin only)' })
  async testImap(
    @Body() dto: { imapHost: string; imapPort: number; imapUser: string; imapPass: string; imapTls: boolean },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    // If password is masked, use the stored one
    if (dto.imapPass === '••••••••') {
      const existing = await this.prisma.channelConfig.findUnique({
        where: { organizationId: user.organizationId },
      });
      if (existing?.imapPass) dto.imapPass = existing.imapPass;
    }

    return this.inboundEmailService.testConnection(dto);
  }

  @Get('messages')
  @ApiOperation({ summary: 'Get recent inbound messages log (Admin only)' })
  async getMessages(
    @CurrentUser() user: AuthenticatedUser,
    @Query('limit') limit?: string,
    @Query('channel') channel?: string,
  ) {
    const where: any = { organizationId: user.organizationId };
    if (channel) where.channel = channel;

    return this.prisma.inboundMessage.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit || '50', 10),
    });
  }

  @Get('free-providers')
  @ApiOperation({ summary: 'List free channel integration providers with setup instructions' })
  async getFreeProviders() {
    return {
      whatsapp: [
        {
          name: 'Twilio WhatsApp Sandbox',
          cost: 'Free (no credit card)',
          limit: 'Sandbox testing only',
          setup: 'https://www.twilio.com/try-twilio → Console → Messaging → Try it Out → WhatsApp',
          steps: [
            'Create free Twilio account at https://www.twilio.com/try-twilio',
            'Go to Console → Messaging → Try it Out → Send a WhatsApp Message',
            'Note the sandbox number (e.g., +1 415 523 8886)',
            'Send the join code from your WhatsApp to the sandbox number',
            'Set webhook URL: https://your-domain.com/api/v1/webhooks/twilio/whatsapp',
            'Configure Account SID, Auth Token, and Phone Number in this app',
          ],
        },
        {
          name: 'Meta WhatsApp Cloud API',
          cost: '1,000 free conversations/month',
          limit: 'Up to 5 test phone numbers in test mode',
          setup: 'https://developers.facebook.com → Create App → Add WhatsApp',
          steps: [
            'Create Meta Developer account at https://developers.facebook.com',
            'Create a Business type app and add WhatsApp product',
            'Get Temporary Access Token and Phone Number ID from API Setup',
            'Add test phone numbers (up to 5)',
            'Configure webhook: https://your-domain.com/api/v1/webhooks/meta/whatsapp',
            'Set verify token and subscribe to "messages"',
            'Configure Token, Phone ID, Verify Token, and Business ID in this app',
          ],
        },
      ],
      phone: [
        {
          name: 'Twilio Free Trial',
          cost: '$15.50 free credit (no card required)',
          limit: '~500 minutes of calls',
          setup: 'https://www.twilio.com/try-twilio',
          steps: [
            'Create free Twilio account',
            'Buy a phone number (~$1/month from trial credit)',
            'Configure voice webhook: https://your-domain.com/api/v1/webhooks/twilio/voice',
            'Configure status webhook: https://your-domain.com/api/v1/webhooks/twilio/voice/status',
            'Call your Twilio number to test',
          ],
        },
      ],
      inboundEmail: [
        {
          name: 'Gmail IMAP',
          cost: 'Free',
          limit: 'Unlimited',
          setup: 'Gmail Settings → Enable IMAP + App Password',
          config: { imapHost: 'imap.gmail.com', imapPort: 993, imapTls: true },
          steps: [
            'Enable IMAP in Gmail: Settings → Forwarding and POP/IMAP → Enable IMAP',
            'Enable 2-Factor Authentication on your Google account',
            'Generate App Password at https://myaccount.google.com/apppasswords',
            'Use the 16-character app password as IMAP password',
          ],
        },
        {
          name: 'Outlook.com IMAP',
          cost: 'Free',
          limit: 'Unlimited',
          config: { imapHost: 'outlook.office365.com', imapPort: 993, imapTls: true },
          steps: [
            'Use your Outlook.com email and password',
            'If 2FA enabled, generate an app password',
          ],
        },
      ],
      webhookTunnel: {
        name: 'ngrok (required for local development)',
        cost: 'Free tier available',
        setup: 'https://ngrok.com',
        steps: [
          'Sign up at https://ngrok.com',
          'Install: npm install -g ngrok  OR  download from website',
          'Authenticate: ngrok config add-authtoken YOUR_TOKEN',
          'Start tunnel: ngrok http 3001',
          'Use the HTTPS URL for all webhook configurations',
        ],
        note: 'Free ngrok URLs change on restart. Update webhooks accordingly.',
      },
    };
  }
}

// ─── Webhook Endpoints (no auth — validated by provider signatures) ─

@ApiTags('Webhooks')
@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(
    private prisma: PrismaService,
    private twilioService: TwilioService,
    private metaWhatsappService: MetaWhatsappService,
  ) {}

  // ── Twilio Voice Webhook ──

  @Post('twilio/voice')
  @ApiExcludeEndpoint()
  async twilioVoice(@Req() req: Request, @Res() res: Response) {
    try {
      this.logger.log('Twilio voice webhook received');
      const { twiml } = await this.twilioService.handleIncomingCall(req.body);
      res.type('text/xml').send(twiml);
    } catch (error) {
      this.logger.error(`Twilio voice webhook error: ${error.message}`);
      res.type('text/xml').send(
        '<?xml version="1.0" encoding="UTF-8"?><Response><Say>We are experiencing technical difficulties. Please try again later.</Say></Response>',
      );
    }
  }

  @Post('twilio/voice/status')
  @ApiExcludeEndpoint()
  async twilioVoiceStatus(@Req() req: Request, @Res() res: Response) {
    try {
      await this.twilioService.handleCallStatus(req.body);
      res.sendStatus(200);
    } catch (error) {
      this.logger.warn(`Twilio status callback error: ${error.message}`);
      res.sendStatus(200); // Always return 200 to Twilio
    }
  }

  // ── Twilio WhatsApp Webhook ──

  @Post('twilio/whatsapp')
  @ApiExcludeEndpoint()
  async twilioWhatsApp(@Req() req: Request, @Res() res: Response) {
    try {
      this.logger.log('Twilio WhatsApp webhook received');
      const { reply } = await this.twilioService.handleWhatsAppMessage(req.body);

      if (reply) {
        // Respond with TwiML to send auto-reply
        const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${reply}</Message></Response>`;
        res.type('text/xml').send(twiml);
      } else {
        res.type('text/xml').send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
      }
    } catch (error) {
      this.logger.error(`Twilio WhatsApp webhook error: ${error.message}`);
      res.type('text/xml').send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
    }
  }

  // ── Meta WhatsApp Cloud API Webhook ──

  @Get('meta/whatsapp')
  @ApiExcludeEndpoint()
  async metaWhatsAppVerify(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
    @Res() res: Response,
  ) {
    // Find any org with Meta WhatsApp configured and matching verify token
    const config = await this.prisma.channelConfig.findFirst({
      where: { metaWhatsappEnabled: true, metaWhatsappVerifyToken: token },
    });

    if (config && mode === 'subscribe') {
      this.logger.log('Meta WhatsApp webhook verified');
      res.send(challenge);
    } else {
      this.logger.warn('Meta WhatsApp webhook verification failed');
      res.sendStatus(403);
    }
  }

  @Post('meta/whatsapp')
  @ApiExcludeEndpoint()
  async metaWhatsApp(@Body() body: any, @Res() res: Response) {
    try {
      this.logger.log('Meta WhatsApp webhook received');
      await this.metaWhatsappService.handleWebhook(body);
      res.sendStatus(200);
    } catch (error) {
      this.logger.error(`Meta WhatsApp webhook error: ${error.message}`);
      res.sendStatus(200); // Always return 200 to Meta
    }
  }
}
