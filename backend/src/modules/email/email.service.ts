import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { PrismaService } from '../../database/prisma.service';

/** Well-known free SMTP providers with their configuration */
export const FREE_SMTP_PROVIDERS = {
  ethereal: {
    name: 'Ethereal (Development/Testing)',
    description: 'Fake SMTP — emails captured but not delivered. Perfect for testing.',
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false,
    note: 'Auto-generate credentials at https://ethereal.email or use the /email-config/setup-ethereal endpoint',
  },
  brevo: {
    name: 'Brevo (formerly Sendinblue)',
    description: 'Free tier: 300 emails/day',
    host: 'smtp-relay.brevo.com',
    port: 587,
    secure: false,
    note: 'Sign up at https://www.brevo.com — use your login email as SMTP user and your SMTP key as password',
  },
  gmail: {
    name: 'Gmail',
    description: 'Free: 500 emails/day. Requires App Password (2FA must be enabled)',
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    note: 'Generate App Password at https://myaccount.google.com/apppasswords',
  },
  mailtrap: {
    name: 'Mailtrap',
    description: 'Free tier: 100 emails/month (testing only)',
    host: 'sandbox.smtp.mailtrap.io',
    port: 2525,
    secure: false,
    note: 'Sign up at https://mailtrap.io — get credentials from Email Testing inbox',
  },
  outlook: {
    name: 'Outlook / Hotmail',
    description: 'Free with Microsoft account',
    host: 'smtp-mail.outlook.com',
    port: 587,
    secure: false,
    note: 'Use your full Outlook email and password (or app password with 2FA)',
  },
};

/** Escape HTML special characters to prevent XSS in email templates */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private prisma: PrismaService) {}

  private async getTransporter(orgId: string) {
    const config = await this.prisma.emailConfig.findUnique({
      where: { organizationId: orgId },
    });

    if (!config || !config.isActive) {
      return null;
    }

    const transporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpPort === 465,
      auth: {
        user: config.smtpUser,
        pass: config.smtpPass,
      },
    });

    return { transporter, config };
  }

  private buildHtml(subject: string, bodyHtml: string, footerText: string): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f7;padding:32px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background-color:#2563eb;padding:24px 32px;">
              <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:600;">${subject}</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;color:#1f2937;font-size:15px;line-height:1.6;">
              ${bodyHtml}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px;background-color:#f9fafb;border-top:1px solid #e5e7eb;">
              <p style="margin:0;color:#6b7280;font-size:13px;line-height:1.5;">${footerText}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
  }

  private async sendMail(
    orgId: string,
    to: string,
    subject: string,
    html: string,
  ): Promise<boolean> {
    try {
      const result = await this.getTransporter(orgId);
      if (!result) {
        this.logger.warn(`Email config not found or inactive for org ${orgId}`);
        return false;
      }

      const { transporter, config } = result;

      await transporter.sendMail({
        from: `"${config.fromName}" <${config.fromEmail}>`,
        to,
        subject,
        html,
      });

      this.logger.log(`Email sent to ${to}: ${subject}`);
      return true;
    } catch (error) {
      this.logger.warn(`Failed to send email to ${to}: ${error.message}`);
      return false;
    }
  }

  async sendTicketCreatedEmail(
    ticket: { ticketNumber: number; title: string; organizationId: string },
    creator: { email: string; firstName: string },
  ): Promise<boolean> {
    try {
      const config = await this.prisma.emailConfig.findUnique({
        where: { organizationId: ticket.organizationId },
      });
      if (!config?.isActive || !config.onTicketCreated) return false;

      const subject = `Ticket #${ticket.ticketNumber} created successfully`;
      const bodyHtml = `
        <p>Hi ${escapeHtml(creator.firstName)},</p>
        <p>Your support ticket has been created successfully.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;">
          <tr>
            <td style="padding:8px 12px;background-color:#f3f4f6;font-weight:600;width:120px;">Ticket</td>
            <td style="padding:8px 12px;background-color:#f3f4f6;">#${ticket.ticketNumber}</td>
          </tr>
          <tr>
            <td style="padding:8px 12px;font-weight:600;">Subject</td>
            <td style="padding:8px 12px;">${escapeHtml(ticket.title)}</td>
          </tr>
        </table>
        <p>We'll get back to you as soon as possible. You will be notified when there are updates.</p>
      `;
      const html = this.buildHtml(subject, bodyHtml, 'This is an automated notification from your support system.');

      return this.sendMail(ticket.organizationId, creator.email, subject, html);
    } catch (error) {
      this.logger.warn(`Failed to send ticket created email: ${error.message}`);
      return false;
    }
  }

  async sendTicketAssignedEmail(
    ticket: { ticketNumber: number; title: string; organizationId: string },
    assignee: { email: string; firstName: string },
  ): Promise<boolean> {
    try {
      const config = await this.prisma.emailConfig.findUnique({
        where: { organizationId: ticket.organizationId },
      });
      if (!config?.isActive || !config.onTicketAssigned) return false;

      const subject = `You've been assigned ticket #${ticket.ticketNumber}`;
      const bodyHtml = `
        <p>Hi ${escapeHtml(assignee.firstName)},</p>
        <p>A support ticket has been assigned to you.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;">
          <tr>
            <td style="padding:8px 12px;background-color:#f3f4f6;font-weight:600;width:120px;">Ticket</td>
            <td style="padding:8px 12px;background-color:#f3f4f6;">#${ticket.ticketNumber}</td>
          </tr>
          <tr>
            <td style="padding:8px 12px;font-weight:600;">Subject</td>
            <td style="padding:8px 12px;">${escapeHtml(ticket.title)}</td>
          </tr>
        </table>
        <p>Please review and respond at your earliest convenience.</p>
      `;
      const html = this.buildHtml(subject, bodyHtml, 'This is an automated notification from your support system.');

      return this.sendMail(ticket.organizationId, assignee.email, subject, html);
    } catch (error) {
      this.logger.warn(`Failed to send ticket assigned email: ${error.message}`);
      return false;
    }
  }

  async sendTicketStatusChangedEmail(
    ticket: { ticketNumber: number; title: string; organizationId: string; creator?: { email: string; firstName: string } },
    oldStatus: string,
    newStatus: string,
  ): Promise<boolean> {
    try {
      const config = await this.prisma.emailConfig.findUnique({
        where: { organizationId: ticket.organizationId },
      });
      if (!config?.isActive || !config.onStatusChanged) return false;

      if (!ticket.creator) {
        this.logger.warn('No creator info provided for status change email');
        return false;
      }

      const subject = `Ticket #${ticket.ticketNumber} status changed`;
      const bodyHtml = `
        <p>Hi ${escapeHtml(ticket.creator.firstName)},</p>
        <p>The status of your support ticket has been updated.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;">
          <tr>
            <td style="padding:8px 12px;background-color:#f3f4f6;font-weight:600;width:120px;">Ticket</td>
            <td style="padding:8px 12px;background-color:#f3f4f6;">#${ticket.ticketNumber}</td>
          </tr>
          <tr>
            <td style="padding:8px 12px;font-weight:600;">Subject</td>
            <td style="padding:8px 12px;">${escapeHtml(ticket.title)}</td>
          </tr>
          <tr>
            <td style="padding:8px 12px;background-color:#f3f4f6;font-weight:600;">Previous Status</td>
            <td style="padding:8px 12px;background-color:#f3f4f6;">${escapeHtml(oldStatus)}</td>
          </tr>
          <tr>
            <td style="padding:8px 12px;font-weight:600;">New Status</td>
            <td style="padding:8px 12px;"><strong style="color:#2563eb;">${escapeHtml(newStatus)}</strong></td>
          </tr>
        </table>
      `;
      const html = this.buildHtml(subject, bodyHtml, 'This is an automated notification from your support system.');

      return this.sendMail(ticket.organizationId, ticket.creator.email, subject, html);
    } catch (error) {
      this.logger.warn(`Failed to send status changed email: ${error.message}`);
      return false;
    }
  }

  async sendNewCommentEmail(
    ticket: { ticketNumber: number; title: string; organizationId: string },
    comment: { body: string; author?: { firstName: string; lastName: string } },
    recipients: { email: string; firstName: string }[],
  ): Promise<boolean> {
    try {
      const config = await this.prisma.emailConfig.findUnique({
        where: { organizationId: ticket.organizationId },
      });
      if (!config?.isActive || !config.onNewComment) return false;

      const authorName = comment.author
        ? `${escapeHtml(comment.author.firstName)} ${escapeHtml(comment.author.lastName)}`
        : 'A team member';

      const subject = `New reply on ticket #${ticket.ticketNumber}`;
      const bodyHtml = `
        <p>${authorName} replied on ticket <strong>#${ticket.ticketNumber} — ${escapeHtml(ticket.title)}</strong>:</p>
        <div style="margin:16px 0;padding:16px;background-color:#f9fafb;border-left:4px solid #2563eb;border-radius:4px;">
          ${escapeHtml(comment.body)}
        </div>
        <p>Log in to your support portal to view the full conversation and respond.</p>
      `;
      const html = this.buildHtml(subject, bodyHtml, 'This is an automated notification from your support system.');

      const results = await Promise.allSettled(
        recipients.map((r) => this.sendMail(ticket.organizationId, r.email, subject, html)),
      );

      const anySuccess = results.some(
        (r) => r.status === 'fulfilled' && r.value === true,
      );
      return anySuccess;
    } catch (error) {
      this.logger.warn(`Failed to send new comment email: ${error.message}`);
      return false;
    }
  }

  async sendSlaBreachEmail(
    ticket: { ticketNumber: number; title: string; organizationId: string },
    assignee: { email: string; firstName: string },
  ): Promise<boolean> {
    try {
      const config = await this.prisma.emailConfig.findUnique({
        where: { organizationId: ticket.organizationId },
      });
      if (!config?.isActive || !config.onSlaBreach) return false;

      const subject = `SLA breach alert for ticket #${ticket.ticketNumber}`;
      const bodyHtml = `
        <p>Hi ${escapeHtml(assignee.firstName)},</p>
        <p style="color:#dc2626;font-weight:600;">&#9888; An SLA breach has occurred on a ticket assigned to you.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;">
          <tr>
            <td style="padding:8px 12px;background-color:#fef2f2;font-weight:600;width:120px;">Ticket</td>
            <td style="padding:8px 12px;background-color:#fef2f2;">#${ticket.ticketNumber}</td>
          </tr>
          <tr>
            <td style="padding:8px 12px;font-weight:600;">Subject</td>
            <td style="padding:8px 12px;">${escapeHtml(ticket.title)}</td>
          </tr>
        </table>
        <p>Please take immediate action to address this ticket.</p>
      `;
      const html = this.buildHtml(subject, bodyHtml, 'This is an automated SLA breach notification.');

      return this.sendMail(ticket.organizationId, assignee.email, subject, html);
    } catch (error) {
      this.logger.warn(`Failed to send SLA breach email: ${error.message}`);
      return false;
    }
  }

  async sendTicketResolvedEmail(
    ticket: { ticketNumber: number; title: string; organizationId: string },
    creator: { email: string; firstName: string },
  ): Promise<boolean> {
    try {
      const config = await this.prisma.emailConfig.findUnique({
        where: { organizationId: ticket.organizationId },
      });
      if (!config?.isActive || !config.onTicketResolved) return false;

      const subject = `Your ticket #${ticket.ticketNumber} has been resolved`;
      const bodyHtml = `
        <p>Hi ${escapeHtml(creator.firstName)},</p>
        <p>Great news! Your support ticket has been resolved.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;">
          <tr>
            <td style="padding:8px 12px;background-color:#f0fdf4;font-weight:600;width:120px;">Ticket</td>
            <td style="padding:8px 12px;background-color:#f0fdf4;">#${ticket.ticketNumber}</td>
          </tr>
          <tr>
            <td style="padding:8px 12px;font-weight:600;">Subject</td>
            <td style="padding:8px 12px;">${escapeHtml(ticket.title)}</td>
          </tr>
          <tr>
            <td style="padding:8px 12px;background-color:#f0fdf4;font-weight:600;">Status</td>
            <td style="padding:8px 12px;background-color:#f0fdf4;"><strong style="color:#16a34a;">Resolved</strong></td>
          </tr>
        </table>
        <p>If you feel this issue has not been fully addressed, please reply or reopen the ticket.</p>
      `;
      const html = this.buildHtml(subject, bodyHtml, 'This is an automated notification from your support system.');

      return this.sendMail(ticket.organizationId, creator.email, subject, html);
    } catch (error) {
      this.logger.warn(`Failed to send ticket resolved email: ${error.message}`);
      return false;
    }
  }

  /**
   * Sends a test email to verify the SMTP configuration works.
   */
  async sendTestEmail(orgId: string, recipientEmail: string): Promise<boolean> {
    const subject = 'Test Email — Support System';
    const bodyHtml = `
      <p>This is a test email from your support ticket system.</p>
      <p>If you received this message, your email configuration is working correctly.</p>
    `;
    const html = this.buildHtml(subject, bodyHtml, 'This is a test email. No action required.');

    return this.sendMail(orgId, recipientEmail, subject, html);
  }

  /**
   * Auto-generate an Ethereal test account and save it as the org's email config.
   * Ethereal is a free fake SMTP service — emails are captured but never delivered.
   * View captured emails at https://ethereal.email/messages
   */
  async setupEtherealAccount(orgId: string): Promise<{
    success: boolean;
    credentials?: { user: string; pass: string; webUrl: string };
    message: string;
  }> {
    try {
      const testAccount = await nodemailer.createTestAccount();

      await this.prisma.emailConfig.upsert({
        where: { organizationId: orgId },
        create: {
          smtpHost: 'smtp.ethereal.email',
          smtpPort: 587,
          smtpUser: testAccount.user,
          smtpPass: testAccount.pass,
          fromEmail: testAccount.user,
          fromName: 'Support Desk (Test)',
          isActive: true,
          onTicketCreated: true,
          onTicketAssigned: true,
          onStatusChanged: true,
          onNewComment: true,
          onSlaBreach: true,
          onTicketResolved: true,
          organizationId: orgId,
        },
        update: {
          smtpHost: 'smtp.ethereal.email',
          smtpPort: 587,
          smtpUser: testAccount.user,
          smtpPass: testAccount.pass,
          fromEmail: testAccount.user,
          fromName: 'Support Desk (Test)',
          isActive: true,
        },
      });

      this.logger.log(`Ethereal test account created for org ${orgId}: ${testAccount.user}`);

      return {
        success: true,
        credentials: {
          user: testAccount.user,
          pass: testAccount.pass,
          webUrl: 'https://ethereal.email/messages',
        },
        message: `Ethereal test account configured. View emails at https://ethereal.email — login with ${testAccount.user}`,
      };
    } catch (error) {
      this.logger.warn(`Failed to create Ethereal account: ${error.message}`);
      return {
        success: false,
        message: `Failed to create Ethereal account: ${error.message}`,
      };
    }
  }

  /**
   * Get list of free SMTP providers with their configuration details.
   */
  getFreeProviders() {
    return FREE_SMTP_PROVIDERS;
  }
}
