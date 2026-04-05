import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

interface SubmitRatingDto {
  rating: number;
  feedback?: string;
}

@Injectable()
export class SatisfactionService {
  constructor(private prisma: PrismaService) {}

  async submitRating(ticketId: string, userId: string, data: SubmitRatingDto) {
    if (data.rating < 1 || data.rating > 5 || !Number.isInteger(data.rating)) {
      throw new BadRequestException('Rating must be an integer between 1 and 5');
    }

    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { id: true, creatorId: true, status: true, organizationId: true },
    });

    if (!ticket) throw new NotFoundException('Ticket not found');

    if (ticket.creatorId !== userId) {
      throw new ForbiddenException('Only the ticket creator can submit a rating');
    }

    if (!['RESOLVED', 'CLOSED'].includes(ticket.status)) {
      throw new BadRequestException('Ratings can only be submitted for resolved or closed tickets');
    }

    const existing = await this.prisma.satisfactionRating.findUnique({
      where: { ticketId },
    });
    if (existing) {
      throw new ConflictException('A rating has already been submitted for this ticket');
    }

    return this.prisma.satisfactionRating.create({
      data: {
        rating: data.rating,
        feedback: data.feedback || null,
        ticketId,
        userId,
      },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });
  }

  async getRating(ticketId: string) {
    const rating = await this.prisma.satisfactionRating.findUnique({
      where: { ticketId },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });

    if (!rating) throw new NotFoundException('No rating found for this ticket');

    return rating;
  }

  async getAgentCsat(agentId: string, organizationId: string) {
    const ratings = await this.prisma.satisfactionRating.findMany({
      where: {
        ticket: {
          assigneeId: agentId,
          organizationId,
        },
      },
      select: { rating: true },
    });

    if (ratings.length === 0) {
      return { averageRating: null, totalRatings: 0 };
    }

    const sum = ratings.reduce((acc, r) => acc + r.rating, 0);
    const averageRating = Math.round((sum / ratings.length) * 100) / 100;

    return {
      averageRating,
      totalRatings: ratings.length,
    };
  }

  async getOrgCsat(organizationId: string) {
    const ratings = await this.prisma.satisfactionRating.findMany({
      where: {
        ticket: { organizationId },
      },
      select: { rating: true },
    });

    if (ratings.length === 0) {
      return {
        averageRating: null,
        totalRatings: 0,
        distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      };
    }

    const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let sum = 0;

    for (const r of ratings) {
      sum += r.rating;
      distribution[r.rating]++;
    }

    const averageRating = Math.round((sum / ratings.length) * 100) / 100;

    return {
      averageRating,
      totalRatings: ratings.length,
      distribution,
    };
  }
}
