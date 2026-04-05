import {
  Controller, Get, Post, Body, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { PrismaService } from '../../database/prisma.service';
import { EmailService } from './email.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface';

@ApiTags('Email Config')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('email-config')
export class EmailController {
  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
  ) {}

  @Get('config')
  @ApiOperation({ summary: 'Get email configuration (Admin only)' })
  async getConfig(@CurrentUser() user: AuthenticatedUser) {
    const config = await this.prisma.emailConfig.findUnique({
      where: { organizationId: user.organizationId },
    });

    if (!config) {
      return null;
    }

    // Mask the SMTP password
    return {
      ...config,
      smtpPass: config.smtpPass ? '••••••••' : '',
    };
  }

  @Post('config')
  @ApiOperation({ summary: 'Save/update email configuration (Admin only)' })
  async saveConfig(
    @Body() dto: {
      smtpHost: string;
      smtpPort: number;
      smtpUser: string;
      smtpPass?: string;
      fromEmail: string;
      fromName: string;
      isActive?: boolean;
      onTicketCreated?: boolean;
      onTicketAssigned?: boolean;
      onStatusChanged?: boolean;
      onNewComment?: boolean;
      onSlaBreach?: boolean;
      onTicketResolved?: boolean;
    },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    // If password is masked or empty, preserve existing password
    let smtpPass = dto.smtpPass;
    if (!smtpPass || smtpPass === '••••••••') {
      const existing = await this.prisma.emailConfig.findUnique({
        where: { organizationId: user.organizationId },
      });
      smtpPass = existing?.smtpPass ?? '';
    }

    const config = await this.prisma.emailConfig.upsert({
      where: { organizationId: user.organizationId },
      create: {
        smtpHost: dto.smtpHost,
        smtpPort: dto.smtpPort,
        smtpUser: dto.smtpUser,
        smtpPass,
        fromEmail: dto.fromEmail,
        fromName: dto.fromName,
        isActive: dto.isActive ?? true,
        onTicketCreated: dto.onTicketCreated ?? true,
        onTicketAssigned: dto.onTicketAssigned ?? true,
        onStatusChanged: dto.onStatusChanged ?? true,
        onNewComment: dto.onNewComment ?? true,
        onSlaBreach: dto.onSlaBreach ?? true,
        onTicketResolved: dto.onTicketResolved ?? true,
        organizationId: user.organizationId,
      },
      update: {
        smtpHost: dto.smtpHost,
        smtpPort: dto.smtpPort,
        smtpUser: dto.smtpUser,
        smtpPass,
        fromEmail: dto.fromEmail,
        fromName: dto.fromName,
        isActive: dto.isActive,
        onTicketCreated: dto.onTicketCreated,
        onTicketAssigned: dto.onTicketAssigned,
        onStatusChanged: dto.onStatusChanged,
        onNewComment: dto.onNewComment,
        onSlaBreach: dto.onSlaBreach,
        onTicketResolved: dto.onTicketResolved,
      },
    });

    return {
      ...config,
      smtpPass: '••••••••',
    };
  }

  @Post('test')
  @ApiOperation({ summary: 'Send a test email to the current user' })
  async sendTestEmail(@CurrentUser() user: AuthenticatedUser) {
    const success = await this.emailService.sendTestEmail(
      user.organizationId,
      user.email,
    );

    return {
      success,
      message: success
        ? `Test email sent to ${user.email}`
        : 'Failed to send test email. Check your SMTP configuration.',
    };
  }
}
