import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface';
import { CreateCommentDto, UpdateCommentDto } from './dto/comments.dto';

@Injectable()
export class CommentsService {
  constructor(private prisma: PrismaService) {}

  async create(ticketId: string, dto: CreateCommentDto, user: AuthenticatedUser) {
    // Verify ticket belongs to user's org
    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId, organizationId: user.organizationId },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');

    // End users cannot create internal notes
    if (user.role === 'END_USER' && dto.isInternal) {
      throw new ForbiddenException('End users cannot create internal notes');
    }

    // End users can only comment on their own tickets
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

    // Log activity
    await this.prisma.activityLog.create({
      data: {
        action: dto.isInternal ? 'INTERNAL_NOTE_ADDED' : 'COMMENT_ADDED',
        ticketId,
        userId: user.id,
        details: JSON.stringify({ commentId: comment.id }),
      },
    });

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
