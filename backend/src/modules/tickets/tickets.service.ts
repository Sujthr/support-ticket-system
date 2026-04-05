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

@Injectable()
export class TicketsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateTicketDto, user: AuthenticatedUser) {
    // Get the next ticket number for this org
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
          priority: (dto.priority || 'MEDIUM') as any,
          organizationId: user.organizationId,
        },
      },
    });

    const dueAt = slaPolicy
      ? new Date(Date.now() + slaPolicy.resolutionMinutes * 60 * 1000)
      : undefined;

    const ticket = await this.prisma.ticket.create({
      data: {
        ticketNumber,
        title: dto.title,
        description: dto.description,
        priority: (dto.priority || 'MEDIUM') as any,
        organizationId: user.organizationId,
        creatorId: user.id,
        assigneeId: dto.assigneeId,
        slaPolicyId: slaPolicy?.id,
        dueAt,
      },
      include: {
        creator: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
        assignee: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
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

    return this.findOne(ticket.id, user);
  }

  async findAll(filters: TicketFilterDto, user: AuthenticatedUser) {
    const where: any = {
      organizationId: user.organizationId,
    };

    // End users can only see their own tickets
    if (user.role === 'END_USER') {
      where.creatorId = user.id;
    }

    if (filters.status) where.status = filters.status;
    if (filters.priority) where.priority = filters.priority;
    if (filters.assigneeId) where.assigneeId = filters.assigneeId;
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
          tags: { include: { tag: true } },
          _count: { select: { comments: true } },
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
        slaPolicy: true,
      },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    // End users can only see their own tickets
    if (user.role === 'END_USER' && ticket.creatorId !== user.id) {
      throw new ForbiddenException();
    }

    return ticket;
  }

  async update(id: string, dto: UpdateTicketDto, user: AuthenticatedUser) {
    const ticket = await this.findOne(id, user);

    // End users can only update certain fields of their own tickets
    if (user.role === 'END_USER') {
      if (ticket.creatorId !== user.id) throw new ForbiddenException();
      // Only allow closing their own tickets
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
    if (dto.priority !== undefined) {
      changes.priority = { from: ticket.priority, to: dto.priority };
      updateData.priority = dto.priority;

      // Update SLA when priority changes
      const slaPolicy = await this.prisma.slaPolicy.findUnique({
        where: {
          priority_organizationId: {
            priority: dto.priority as any,
            organizationId: user.organizationId,
          },
        },
      });
      if (slaPolicy) {
        updateData.slaPolicyId = slaPolicy.id;
        updateData.dueAt = new Date(Date.now() + slaPolicy.resolutionMinutes * 60 * 1000);
      }
    }
    if (dto.status !== undefined) {
      changes.status = { from: ticket.status, to: dto.status };
      updateData.status = dto.status;
      if (dto.status === 'RESOLVED') updateData.resolvedAt = new Date();
      if (dto.status === 'CLOSED') updateData.closedAt = new Date();
    }
    if (dto.assigneeId !== undefined) {
      changes.assigneeId = { from: ticket.assigneeId, to: dto.assigneeId };
      updateData.assigneeId = dto.assigneeId;
    }

    const updated = await this.prisma.ticket.update({
      where: { id },
      data: updateData,
    });

    if (dto.tags) {
      await this.syncTags(id, dto.tags, user.organizationId);
    }

    // Log activity
    await this.prisma.activityLog.create({
      data: {
        action: 'TICKET_UPDATED',
        ticketId: id,
        userId: user.id,
        details: JSON.stringify(changes),
      },
    });

    return this.findOne(id, user);
  }

  async bulkUpdate(dto: BulkUpdateTicketsDto, user: AuthenticatedUser) {
    if (user.role === 'END_USER') throw new ForbiddenException();

    const updateData: any = {};
    if (dto.status) updateData.status = dto.status;
    if (dto.priority) updateData.priority = dto.priority;
    if (dto.assigneeId) updateData.assigneeId = dto.assigneeId;

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

  private async syncTags(ticketId: string, tagNames: string[], organizationId: string) {
    // Remove existing tags
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
