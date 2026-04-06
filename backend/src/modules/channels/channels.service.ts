import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { EmailService } from '../email/email.service';

export interface InboundChannelMessage {
  channel: 'PHONE' | 'WHATSAPP' | 'EMAIL_INBOUND';
  senderIdentity: string; // phone number, email, WhatsApp ID
  subject?: string;
  body?: string;
  externalId?: string;
  rawPayload?: string;
  organizationId: string;
  mediaUrls?: string[];
}

@Injectable()
export class ChannelsService {
  private readonly logger = new Logger(ChannelsService.name);

  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
  ) {}

  /**
   * Core method: creates a ticket from any inbound channel message.
   * Handles deduplication, auto-assignment, SLA, and notifications.
   */
  async createTicketFromChannel(msg: InboundChannelMessage) {
    const config = await this.prisma.channelConfig.findUnique({
      where: { organizationId: msg.organizationId },
    });

    // Check for deduplication — if same sender sent a message within N minutes, add as comment
    const deduplicateMinutes = config?.deduplicateMinutes ?? 30;
    const cutoff = new Date(Date.now() - deduplicateMinutes * 60 * 1000);

    const recentMessage = await this.prisma.inboundMessage.findFirst({
      where: {
        organizationId: msg.organizationId,
        senderIdentity: msg.senderIdentity,
        channel: msg.channel,
        ticketId: { not: null },
        createdAt: { gte: cutoff },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (recentMessage?.ticketId) {
      // Add as comment to existing ticket instead of creating new one
      return this.addToExistingTicket(recentMessage.ticketId, msg);
    }

    // Create new ticket
    return this.createNewTicket(msg);
  }

  private async createNewTicket(msg: InboundChannelMessage) {
    // Get the system user (first admin) to act as the ticket creator
    const systemUser = await this.prisma.user.findFirst({
      where: {
        organizationId: msg.organizationId,
        role: 'ADMIN',
        isActive: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    if (!systemUser) {
      this.logger.error(`No active admin found for org ${msg.organizationId}`);
      throw new Error('No active admin found for organization');
    }

    // Build ticket title based on channel
    const title = this.buildTitle(msg);
    const description = this.buildDescription(msg);

    // Get next ticket number
    const lastTicket = await this.prisma.ticket.findFirst({
      where: { organizationId: msg.organizationId },
      orderBy: { ticketNumber: 'desc' },
      select: { ticketNumber: true },
    });
    const ticketNumber = (lastTicket?.ticketNumber || 0) + 1;

    // Find SLA policy for MEDIUM priority (default for inbound)
    const slaPolicy = await this.prisma.slaPolicy.findUnique({
      where: {
        priority_organizationId: {
          priority: 'MEDIUM',
          organizationId: msg.organizationId,
        },
      },
    });
    const dueAt = slaPolicy
      ? new Date(Date.now() + slaPolicy.resolutionMinutes * 60 * 1000)
      : undefined;

    // Auto-assign
    const assigneeId = await this.autoAssign(msg.organizationId);

    const ticket = await this.prisma.ticket.create({
      data: {
        ticketNumber,
        title,
        description,
        priority: 'MEDIUM',
        source: msg.channel,
        channelMessageId: msg.externalId,
        callerInfo: msg.senderIdentity,
        organizationId: msg.organizationId,
        creatorId: systemUser.id,
        assigneeId,
        slaPolicyId: slaPolicy?.id,
        dueAt,
      },
      include: {
        creator: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
        assignee: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
      },
    });

    // Log inbound message
    await this.prisma.inboundMessage.create({
      data: {
        channel: msg.channel,
        externalId: msg.externalId,
        senderIdentity: msg.senderIdentity,
        subject: msg.subject,
        body: msg.body,
        rawPayload: msg.rawPayload,
        ticketId: ticket.id,
        organizationId: msg.organizationId,
        processedAt: new Date(),
      },
    });

    // Activity log
    await this.prisma.activityLog.create({
      data: {
        action: 'TICKET_CREATED',
        ticketId: ticket.id,
        userId: systemUser.id,
        details: JSON.stringify({
          title,
          source: msg.channel,
          senderIdentity: msg.senderIdentity,
          autoCreated: true,
        }),
      },
    });

    // Notifications
    this.emailService.sendTicketCreatedEmail(ticket, ticket.creator).catch(() => {});
    if (ticket.assignee && ticket.assigneeId !== systemUser.id) {
      this.emailService.sendTicketAssignedEmail(ticket, ticket.assignee).catch(() => {});
      await this.prisma.notification.create({
        data: {
          type: 'TICKET_ASSIGNED',
          title: 'New ticket from ' + msg.channel.toLowerCase(),
          message: `Ticket #${ticket.ticketNumber} "${ticket.title}" created from ${msg.channel.toLowerCase().replace('_', ' ')} and assigned to you`,
          recipientId: ticket.assigneeId!,
          organizationId: msg.organizationId,
          metadata: JSON.stringify({ ticketId: ticket.id }),
        },
      });
    }

    this.logger.log(
      `Ticket #${ticket.ticketNumber} created from ${msg.channel} (sender: ${msg.senderIdentity})`,
    );

    return ticket;
  }

  private async addToExistingTicket(ticketId: string, msg: InboundChannelMessage) {
    const systemUser = await this.prisma.user.findFirst({
      where: { organizationId: msg.organizationId, role: 'ADMIN', isActive: true },
      orderBy: { createdAt: 'asc' },
    });

    if (!systemUser) throw new Error('No active admin found');

    const body = `**[${msg.channel} follow-up from ${msg.senderIdentity}]**\n\n${msg.body || 'No message content'}`;

    const comment = await this.prisma.comment.create({
      data: {
        body,
        isInternal: false,
        ticketId,
        authorId: systemUser.id,
      },
    });

    // Log inbound message
    await this.prisma.inboundMessage.create({
      data: {
        channel: msg.channel,
        externalId: msg.externalId,
        senderIdentity: msg.senderIdentity,
        subject: msg.subject,
        body: msg.body,
        rawPayload: msg.rawPayload,
        ticketId,
        organizationId: msg.organizationId,
        processedAt: new Date(),
      },
    });

    // Reopen if ticket was resolved/closed
    const ticket = await this.prisma.ticket.findUnique({ where: { id: ticketId } });
    if (ticket && (ticket.status === 'RESOLVED' || ticket.status === 'CLOSED')) {
      await this.prisma.ticket.update({
        where: { id: ticketId },
        data: { status: 'OPEN' },
      });
    }

    this.logger.log(`Follow-up from ${msg.senderIdentity} added to ticket ${ticketId}`);

    // Return the existing ticket so callers get a consistent shape
    const fullTicket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        creator: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
        assignee: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
      },
    });

    return { ...fullTicket!, deduplicated: true, commentId: comment.id };
  }

  private buildTitle(msg: InboundChannelMessage): string {
    switch (msg.channel) {
      case 'PHONE':
        return `Phone call from ${msg.senderIdentity}`;
      case 'WHATSAPP':
        const preview = msg.body ? msg.body.substring(0, 60) : 'WhatsApp message';
        return `WhatsApp: ${preview}${(msg.body?.length ?? 0) > 60 ? '...' : ''}`;
      case 'EMAIL_INBOUND':
        return msg.subject || `Email from ${msg.senderIdentity}`;
      default:
        return `Inbound message from ${msg.senderIdentity}`;
    }
  }

  private buildDescription(msg: InboundChannelMessage): string {
    const header = `**Source:** ${msg.channel.replace('_', ' ')}\n**From:** ${msg.senderIdentity}\n`;

    switch (msg.channel) {
      case 'PHONE':
        return `${header}\n**Type:** Incoming phone call\n\n${msg.body || '_Call received. No voicemail transcription available._'}`;
      case 'WHATSAPP':
        return `${header}\n${msg.body || '_No message content_'}`;
      case 'EMAIL_INBOUND':
        return `${header}**Subject:** ${msg.subject || '(no subject)'}\n\n${msg.body || '_Empty email body_'}`;
      default:
        return `${header}\n${msg.body || ''}`;
    }
  }

  private async autoAssign(organizationId: string): Promise<string | undefined> {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { autoAssignMode: true },
    });

    if (!org || org.autoAssignMode === 'MANUAL') return undefined;

    const agents = await this.prisma.user.findMany({
      where: {
        organizationId,
        role: { in: ['ADMIN', 'AGENT'] },
        isActive: true,
        isAvailableForAssign: true,
      },
      select: {
        id: true,
        _count: { select: { assignedTickets: { where: { status: { in: ['OPEN', 'PENDING'] } } } } },
      },
      orderBy: { createdAt: 'asc' },
    });

    if (agents.length === 0) return undefined;

    if (org.autoAssignMode === 'LOAD_BALANCED') {
      agents.sort((a, b) => a._count.assignedTickets - b._count.assignedTickets);
      return agents[0].id;
    }

    // ROUND_ROBIN
    const lastAssigned = await this.prisma.ticket.findFirst({
      where: { organizationId, assigneeId: { not: null } },
      orderBy: { createdAt: 'desc' },
      select: { assigneeId: true },
    });

    if (!lastAssigned?.assigneeId) return agents[0].id;
    const lastIdx = agents.findIndex(a => a.id === lastAssigned.assigneeId);
    return agents[(lastIdx + 1) % agents.length].id;
  }

  /**
   * Get all channel configs for an org. Returns null if not configured.
   */
  async getConfig(organizationId: string) {
    return this.prisma.channelConfig.findUnique({
      where: { organizationId },
    });
  }

  /**
   * Find org by channel config — used by webhooks to route to the right org.
   */
  async findOrgByTwilioNumber(phoneNumber: string) {
    const config = await this.prisma.channelConfig.findFirst({
      where: { twilioPhoneNumber: phoneNumber, twilioEnabled: true },
    });
    return config?.organizationId;
  }

  async findOrgByMetaPhoneId(phoneId: string) {
    const config = await this.prisma.channelConfig.findFirst({
      where: { metaWhatsappPhoneId: phoneId, metaWhatsappEnabled: true },
    });
    return config?.organizationId;
  }
}
