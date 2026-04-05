import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { SaveJiraConfigDto, CreateJiraIssueDto } from './dto/jira.dto';

@Injectable()
export class JiraService {
  private readonly logger = new Logger(JiraService.name);

  constructor(private prisma: PrismaService) {}

  // ── Config Management ──

  async getConfig(organizationId: string) {
    const config = await this.prisma.jiraConfig.findUnique({
      where: { organizationId },
    });
    if (config) {
      // Mask the API token for security
      return { ...config, apiToken: '••••••••' + config.apiToken.slice(-4) };
    }
    return null;
  }

  async saveConfig(organizationId: string, dto: SaveJiraConfigDto) {
    // Validate connection before saving
    const isValid = await this.testConnection(dto.baseUrl, dto.email, dto.apiToken);
    if (!isValid) {
      throw new BadRequestException('Could not connect to JIRA. Check your credentials.');
    }

    return this.prisma.jiraConfig.upsert({
      where: { organizationId },
      create: {
        baseUrl: dto.baseUrl.replace(/\/$/, ''), // strip trailing slash
        email: dto.email,
        apiToken: dto.apiToken,
        projectKey: dto.projectKey.toUpperCase(),
        issueType: dto.issueType || 'Task',
        organizationId,
      },
      update: {
        baseUrl: dto.baseUrl.replace(/\/$/, ''),
        email: dto.email,
        apiToken: dto.apiToken,
        projectKey: dto.projectKey.toUpperCase(),
        issueType: dto.issueType || 'Task',
      },
    });
  }

  async deleteConfig(organizationId: string) {
    await this.prisma.jiraConfig.deleteMany({ where: { organizationId } });
    return { message: 'JIRA configuration removed' };
  }

  // ── Create JIRA Issue ──

  async createIssue(dto: CreateJiraIssueDto, organizationId: string, userId: string) {
    const config = await this.prisma.jiraConfig.findUnique({
      where: { organizationId },
    });
    if (!config || !config.isActive) {
      throw new BadRequestException('JIRA integration is not configured');
    }

    const ticket = await this.prisma.ticket.findFirst({
      where: { id: dto.ticketId, organizationId },
      include: {
        creator: { select: { firstName: true, lastName: true, email: true } },
        tags: { include: { tag: true } },
      },
    });
    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    if (ticket.jiraIssueKey) {
      throw new BadRequestException(`Ticket already linked to JIRA issue ${ticket.jiraIssueKey}`);
    }

    // Map support ticket priority to JIRA priority
    const priorityMap: Record<string, string> = {
      URGENT: 'Highest',
      HIGH: 'High',
      MEDIUM: 'Medium',
      LOW: 'Low',
    };

    const summary = dto.summary || `[Support #${ticket.ticketNumber}] ${ticket.title}`;
    const description = dto.description || this.buildJiraDescription(ticket);
    const priority = dto.priority || priorityMap[ticket.priority] || 'Medium';
    const issueType = dto.issueType || config.issueType;

    // Call JIRA REST API
    const jiraPayload = {
      fields: {
        project: { key: config.projectKey },
        summary,
        description,
        issuetype: { name: issueType },
        priority: { name: priority },
        labels: ['support-ticket'],
      },
    };

    try {
      const response = await this.callJiraApi(
        config, 'POST', '/rest/api/2/issue', jiraPayload,
      );

      const jiraIssueKey = response.key;
      const jiraIssueUrl = `${config.baseUrl}/browse/${jiraIssueKey}`;

      // Update the support ticket with JIRA link
      await this.prisma.ticket.update({
        where: { id: ticket.id },
        data: {
          jiraIssueKey,
          jiraIssueUrl,
          jiraStatus: 'To Do',
        },
      });

      // Log activity
      await this.prisma.activityLog.create({
        data: {
          action: 'JIRA_ISSUE_CREATED',
          ticketId: ticket.id,
          userId,
          details: JSON.stringify({ jiraIssueKey, jiraIssueUrl }),
        },
      });

      return {
        jiraIssueKey,
        jiraIssueUrl,
        message: `JIRA issue ${jiraIssueKey} created successfully`,
      };
    } catch (error: any) {
      this.logger.error('Failed to create JIRA issue', error?.message);
      throw new BadRequestException(
        `Failed to create JIRA issue: ${error?.message || 'Unknown error'}`,
      );
    }
  }

  // ── Sync JIRA Status ──

  async syncJiraStatus(ticketId: string, organizationId: string) {
    const config = await this.prisma.jiraConfig.findUnique({
      where: { organizationId },
    });
    if (!config) return null;

    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId, organizationId },
    });
    if (!ticket?.jiraIssueKey) return null;

    try {
      const response = await this.callJiraApi(
        config, 'GET', `/rest/api/2/issue/${ticket.jiraIssueKey}?fields=status`,
      );

      const jiraStatus = response.fields?.status?.name;
      if (jiraStatus) {
        await this.prisma.ticket.update({
          where: { id: ticketId },
          data: { jiraStatus },
        });
      }

      return { jiraIssueKey: ticket.jiraIssueKey, jiraStatus };
    } catch (error: any) {
      this.logger.warn(`Failed to sync JIRA status for ${ticket.jiraIssueKey}: ${error?.message}`);
      return null;
    }
  }

  // ── Helpers ──

  private buildJiraDescription(ticket: any): string {
    const tags = ticket.tags?.map((t: any) => t.tag.name).join(', ') || 'None';
    return [
      `*Support Ticket #${ticket.ticketNumber}*`,
      '',
      `*Reporter:* ${ticket.creator.firstName} ${ticket.creator.lastName} (${ticket.creator.email})`,
      `*Priority:* ${ticket.priority}`,
      `*Tags:* ${tags}`,
      '',
      '*Description:*',
      ticket.description,
      '',
      `_Created from SupportDesk ticket system_`,
    ].join('\n');
  }

  private async testConnection(baseUrl: string, email: string, apiToken: string): Promise<boolean> {
    try {
      const url = `${baseUrl.replace(/\/$/, '')}/rest/api/2/myself`;
      const auth = Buffer.from(`${email}:${apiToken}`).toString('base64');
      const response = await fetch(url, {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  private async callJiraApi(config: any, method: string, path: string, body?: any): Promise<any> {
    const url = `${config.baseUrl}${path}`;
    const auth = Buffer.from(`${config.email}:${config.apiToken}`).toString('base64');

    const options: RequestInit = {
      method,
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`JIRA API ${response.status}: ${errorBody}`);
    }

    return response.json();
  }
}
