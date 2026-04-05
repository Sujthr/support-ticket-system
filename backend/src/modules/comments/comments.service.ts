import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface';
import { CreateCommentDto, UpdateCommentDto } from './dto/comments.dto';
import { EmailService } from '../email/email.service';

@Injectable()
export class CommentsService {
  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
  ) {}

  async create(ticketId: string, dto: CreateCommentDto, user: AuthenticatedUser) {
    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId, organizationId: user.organizationId },
      include: {
        creator: { select: { id: true, firstName: true, lastName: true, email: true } },
        assignee: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');

    if (user.role === 'END_USER' && dto.isInternal) {
      throw new ForbiddenException('End users cannot create internal notes');
    }
    if (user.role === 'END_USER' && ticket.creatorId !== user.id) {
      throw new ForbiddenException();
    }

    const comment = await this.prisma.comment.create({
      data: {
        body: dto.body,
        isInternal: dto.isInternal || false,
        ticketId,
        authorId: user.id,
      },
      include: {
        author: { select: { id: true, firstName: true, lastName: true, email: true, role: true, avatar: true } },
        attachments: true,
      },
    });

    // Track first response time
    if (!ticket.firstResponseAt && user.role !== 'END_USER' && !dto.isInternal) {
      await this.prisma.ticket.update({
        where: { id: ticketId },
        data: { firstResponseAt: new Date() },
      });
    }

    await this.prisma.activityLog.create({
      data: {
        action: dto.isInternal ? 'INTERNAL_NOTE_ADDED' : 'COMMENT_ADDED',
        ticketId,
        userId: user.id,
        details: JSON.stringify({ commentId: comment.id }),
      },
    });

    // Send email notifications for public replies (not internal notes)
    if (!dto.isInternal) {
      // Collect recipients: creator, assignee, watchers (excluding the comment author)
      const watcherRecords = await this.prisma.ticketWatcher.findMany({
        where: { ticketId },
        include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
      });

      const recipients = new Map<string, any>();
      if (ticket.creator && ticket.creator.id !== user.id) {
        recipients.set(ticket.creator.id, ticket.creator);
      }
      if (ticket.assignee && ticket.assignee.id !== user.id) {
        recipients.set(ticket.assignee.id, ticket.assignee);
      }
      for (const w of watcherRecords) {
        if (w.user.id !== user.id) {
          recipients.set(w.user.id, w.user);
        }
      }

      if (recipients.size > 0) {
        this.emailService.sendNewCommentEmail(
          ticket, comment, Array.from(recipients.values()),
        ).catch(() => {});
      }

      // In-app notification for non-author stakeholders
      for (const [recipientId] of recipients) {
        await this.prisma.notification.create({
          data: {
            type: 'COMMENT_ADDED',
            title: 'New reply on your ticket',
            message: `${comment.author.firstName} replied on ticket #${ticket.ticketNumber}`,
            recipientId,
            organizationId: user.organizationId,
            metadata: JSON.stringify({ ticketId, commentId: comment.id }),
          },
        });
      }
    }

    return comment;
  }

  async update(commentId: string, dto: UpdateCommentDto, user: AuthenticatedUser) {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
      include: { ticket: true },
    });

    if (!comment || comment.ticket.organizationId !== user.organizationId) {
      throw new NotFoundException('Comment not found');
    }
    if (comment.authorId !== user.id && user.role !== 'ADMIN') {
      throw new ForbiddenException();
    }

    return this.prisma.comment.update({
      where: { id: commentId },
      data: { body: dto.body },
      include: {
        author: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
      },
    });
  }

  async delete(commentId: string, user: AuthenticatedUser) {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
      include: { ticket: true },
    });

    if (!comment || comment.ticket.organizationId !== user.organizationId) {
      throw new NotFoundException('Comment not found');
    }
    if (comment.authorId !== user.id && user.role !== 'ADMIN') {
      throw new ForbiddenException();
    }

    await this.prisma.comment.delete({ where: { id: commentId } });
    return { message: 'Comment deleted' };
  }
}
