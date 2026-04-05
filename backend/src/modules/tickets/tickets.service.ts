import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface';
import { PaginatedResponse } from '../../common/dto/pagination.dto';
import {
  CreateTicketDto,
  UpdateTicketDto,
  TicketFilterDto,
  BulkUpdateTicketsDto,
} from './dto/tickets.dto';
import { EmailService } from '../email/email.service';

@Injectable()
export class TicketsService {
  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
  ) {}

  async create(dto: CreateTicketDto, user: AuthenticatedUser) {
    const lastTicket = await this.prisma.ticket.findFirst({
      where: { organizationId: user.organizationId },
      orderBy: { ticketNumber: 'desc' },
      select: { ticketNumber: true },
    });
    const ticketNumber = (lastTicket?.ticketNumber || 0) + 1;

    // Find matching SLA policy
    const slaPolicy = await this.prisma.slaPolicy.findUnique({
      where: {
        priority_organizationId: {
          priority: (dto.priority || 'MEDIUM'),
          organizationId: user.organizationId,
        },
      },
    });

    const dueAt = slaPolicy
      ? new Date(Date.now() + slaPolicy.resolutionMinutes * 60 * 1000)
      : undefined;

    // Auto-assign if no assignee specified
    let assigneeId = dto.assigneeId;
    if (!assigneeId) {
      assigneeId = await this.autoAssign(user.organizationId);
    }

    const ticket = await this.prisma.ticket.create({
      data: {
        ticketNumber,
        title: dto.title,
        description: dto.description,
        priority: (dto.priority || 'MEDIUM'),
        categoryId: dto.categoryId,
        source: dto.source || 'WEB',
        organizationId: user.organizationId,
        creatorId: user.id,
        assigneeId,
        slaPolicyId: slaPolicy?.id,
        dueAt,
      },
      include: {
        creator: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
        assignee: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
        category: true,
        tags: { include: { tag: true } },
      },
    });

    // Handle tags
    if (dto.tags?.length) {
      await this.syncTags(ticket.id, dto.tags, user.organizationId);
    }

    // Log activity
    await this.prisma.activityLog.create({
      data: {
        action: 'TICKET_CREATED',
        ticketId: ticket.id,
        userId: user.id,
        details: JSON.stringify({ title: dto.title }),
      },
    });

    // Send email notifications
    this.emailService.sendTicketCreatedEmail(ticket, ticket.creator).catch(() => {});
    if (ticket.assignee) {
      this.emailService.sendTicketAssignedEmail(ticket, ticket.assignee).catch(() => {});

      // Create in-app notification for assignee
      if (ticket.assigneeId !== user.id) {
        await this.prisma.notification.create({
          data: {
            type: 'TICKET_ASSIGNED',
            title: 'New ticket assigned',
            message: `Ticket #${ticket.ticketNumber} "${ticket.title}" has been assigned to you`,
            recipientId: ticket.assigneeId!,
            organizationId: user.organizationId,
            metadata: JSON.stringify({ ticketId: ticket.id }),
          },
        });
      }
    }

    return this.findOne(ticket.id, user);
  }

  async findAll(filters: TicketFilterDto, user: AuthenticatedUser) {
    const where: any = {
      organizationId: user.organizationId,
    };

    if (user.role === 'END_USER') {
      where.creatorId = user.id;
    }

    if (filters.status) where.status = filters.status;
    if (filters.priority) where.priority = filters.priority;
    if (filters.assigneeId) where.assigneeId = filters.assigneeId;
    if (filters.categoryId) where.categoryId = filters.categoryId;
    if (filters.slaBreached === 'true') where.slaBreached = true;

    if (filters.search) {
      where.OR = [
        { title: { contains: filters.search } },
        { description: { contains: filters.search } },
      ];
    }

    if (filters.tag) {
      where.tags = { some: { tag: { name: filters.tag } } };
    }

    const skip = (filters.page - 1) * filters.limit;

    const [tickets, total] = await Promise.all([
      this.prisma.ticket.findMany({
        where,
        skip,
        take: filters.limit,
        orderBy: { [filters.sortBy || 'createdAt']: filters.sortOrder || 'desc' },
        include: {
          creator: { select: { id: true, firstName: true, lastName: true, email: true } },
          assignee: { select: { id: true, firstName: true, lastName: true, email: true } },
          category: { select: { id: true, name: true, color: true } },
          tags: { include: { tag: true } },
          _count: { select: { comments: true, watchers: true } },
        },
      }),
      this.prisma.ticket.count({ where }),
    ]);

    return new PaginatedResponse(tickets, total, filters.page, filters.limit);
  }

  async findOne(id: string, user: AuthenticatedUser) {
    const ticket = await this.prisma.ticket.findFirst({
      where: {
        id,
        organizationId: user.organizationId,
      },
      include: {
        creator: { select: { id: true, firstName: true, lastName: true, email: true, role: true, avatar: true } },
        assignee: { select: { id: true, firstName: true, lastName: true, email: true, role: true, avatar: true } },
        category: true,
        tags: { include: { tag: true } },
        comments: {
          where: user.role === 'END_USER' ? { isInternal: false } : {},
          include: {
            author: { select: { id: true, firstName: true, lastName: true, email: true, role: true, avatar: true } },
            attachments: true,
          },
          orderBy: { createdAt: 'asc' },
        },
        attachments: true,
        activityLogs: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
        watchers: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true, avatar: true } },
          },
        },
        satisfactionRating: true,
        timeEntries: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        slaPolicy: true,
      },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    if (user.role === 'END_USER' && ticket.creatorId !== user.id) {
      throw new ForbiddenException();
    }

    return ticket;
  }

  async update(id: string, dto: UpdateTicketDto, user: AuthenticatedUser) {
    const ticket = await this.findOne(id, user);

    if (user.role === 'END_USER') {
      if (ticket.creatorId !== user.id) throw new ForbiddenException();
      if (dto.status && dto.status !== 'CLOSED') {
        throw new ForbiddenException('You can only close your own tickets');
      }
    }

    const updateData: any = {};
    const changes: any = {};

    if (dto.title !== undefined) {
      changes.title = { from: ticket.title, to: dto.title };
      updateData.title = dto.title;
    }
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.categoryId !== undefined) {
      changes.category = { from: ticket.categoryId, to: dto.categoryId };
      updateData.categoryId = dto.categoryId || null;
    }
    if (dto.priority !== undefined) {
      changes.priority = { from: ticket.priority, to: dto.priority };
      updateData.priority = dto.priority;

      const slaPolicy = await this.prisma.slaPolicy.findUnique({
        where: {
          priority_organizationId: {
            priority: dto.priority,
            organizationId: user.organizationId,
          },
        },
      });
      if (slaPolicy) {
        updateData.slaPolicyId = slaPolicy.id;
        updateData.dueAt = new Date(Date.now() + slaPolicy.resolutionMinutes * 60 * 1000);
      }
    }

    const oldStatus = ticket.status;
    if (dto.status !== undefined) {
      changes.status = { from: ticket.status, to: dto.status };
      updateData.status = dto.status;
      if (dto.status === 'RESOLVED') updateData.resolvedAt = new Date();
      if (dto.status === 'CLOSED') updateData.closedAt = new Date();
    }

    const oldAssigneeId = ticket.assigneeId;
    if (dto.assigneeId !== undefined) {
      changes.assigneeId = { from: ticket.assigneeId, to: dto.assigneeId };
      updateData.assigneeId = dto.assigneeId || null;
    }

    await this.prisma.ticket.update({
      where: { id },
      data: updateData,
    });

    if (dto.tags) {
      await this.syncTags(id, dto.tags, user.organizationId);
    }

    await this.prisma.activityLog.create({
      data: {
        action: 'TICKET_UPDATED',
        ticketId: id,
        userId: user.id,
        details: JSON.stringify(changes),
      },
    });

    const updatedTicket = await this.findOne(id, user);

    // Email: assignment changed
    if (dto.assigneeId && dto.assigneeId !== oldAssigneeId && updatedTicket.assignee) {
      this.emailService.sendTicketAssignedEmail(updatedTicket, updatedTicket.assignee).catch(() => {});
      if (dto.assigneeId !== user.id) {
        await this.prisma.notification.create({
          data: {
            type: 'TICKET_ASSIGNED',
            title: 'Ticket assigned to you',
            message: `Ticket #${ticket.ticketNumber} "${ticket.title}" has been assigned to you`,
            recipientId: dto.assigneeId,
            organizationId: user.organizationId,
            metadata: JSON.stringify({ ticketId: id }),
          },
        });
      }
    }

    // Email: status changed
    if (dto.status && dto.status !== oldStatus) {
      this.emailService.sendTicketStatusChangedEmail(updatedTicket, oldStatus, dto.status).catch(() => {});

      if (dto.status === 'RESOLVED') {
        this.emailService.sendTicketResolvedEmail(updatedTicket, updatedTicket.creator).catch(() => {});
        await this.prisma.notification.create({
          data: {
            type: 'TICKET_RESOLVED',
            title: 'Your ticket has been resolved',
            message: `Ticket #${ticket.ticketNumber} "${ticket.title}" has been resolved`,
            recipientId: ticket.creatorId,
            organizationId: user.organizationId,
            metadata: JSON.stringify({ ticketId: id }),
          },
        });
      }
    }

    return updatedTicket;
  }

  async bulkUpdate(dto: BulkUpdateTicketsDto, user: AuthenticatedUser) {
    if (user.role === 'END_USER') throw new ForbiddenException();

    const updateData: any = {};
    if (dto.status) updateData.status = dto.status;
    if (dto.priority) updateData.priority = dto.priority;
    if (dto.assigneeId) updateData.assigneeId = dto.assigneeId;
    if (dto.categoryId) updateData.categoryId = dto.categoryId;

    await this.prisma.ticket.updateMany({
      where: {
        id: { in: dto.ticketIds },
        organizationId: user.organizationId,
      },
      data: updateData,
    });

    return { message: `Updated ${dto.ticketIds.length} tickets` };
  }

  async getMyTickets(user: AuthenticatedUser, filters: TicketFilterDto) {
    const modifiedFilters = { ...filters };
    if (user.role === 'AGENT' || user.role === 'ADMIN') {
      modifiedFilters.assigneeId = user.id;
    }
    return this.findAll(modifiedFilters, user);
  }

  // Round-robin auto-assignment
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
      // Assign to agent with fewest open tickets
      agents.sort((a, b) => a._count.assignedTickets - b._count.assignedTickets);
      return agents[0].id;
    }

    // ROUND_ROBIN: assign to agent who was assigned least recently
    const lastAssigned = await this.prisma.ticket.findFirst({
      where: {
        organizationId,
        assigneeId: { not: null },
      },
      orderBy: { createdAt: 'desc' },
      select: { assigneeId: true },
    });

    if (!lastAssigned?.assigneeId) return agents[0].id;

    const lastIdx = agents.findIndex(a => a.id === lastAssigned.assigneeId);
    const nextIdx = (lastIdx + 1) % agents.length;
    return agents[nextIdx].id;
  }

  private async syncTags(ticketId: string, tagNames: string[], organizationId: string) {
    await this.prisma.ticketTag.deleteMany({ where: { ticketId } });

    for (const name of tagNames) {
      const tag = await this.prisma.tag.upsert({
        where: { name_organizationId: { name, organizationId } },
        create: { name, organizationId },
        update: {},
      });

      await this.prisma.ticketTag.create({
        data: { ticketId, tagId: tag.id },
      });
    }
  }
}
