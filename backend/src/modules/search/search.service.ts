import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

// Meilisearch integration - falls back to Prisma full-text search if Meilisearch is unavailable
@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);
  private meiliClient: any = null;

  constructor(private prisma: PrismaService) {
    this.initMeilisearch();
  }

  private async initMeilisearch() {
    try {
      const { MeiliSearch } = await import('meilisearch');
      this.meiliClient = new MeiliSearch({
        host: process.env.MEILI_HOST || 'http://localhost:7700',
        apiKey: process.env.MEILI_API_KEY,
      });
      await this.meiliClient.health();
      this.logger.log('Meilisearch connected');
    } catch {
      this.logger.warn('Meilisearch unavailable, using database search fallback');
      this.meiliClient = null;
    }
  }

  async searchTickets(organizationId: string, query: string, page = 1, limit = 20) {
    if (this.meiliClient) {
      try {
        const index = this.meiliClient.index('tickets');
        const results = await index.search(query, {
          filter: [`organizationId = "${organizationId}"`],
          limit,
          offset: (page - 1) * limit,
        });
        return {
          data: results.hits,
          meta: { total: results.estimatedTotalHits, page, limit },
        };
      } catch {
        this.logger.warn('Meilisearch query failed, falling back to DB');
      }
    }

    // Fallback: PostgreSQL search
    const where = {
      organizationId,
      OR: [
        { title: { contains: query } },
        { description: { contains: query } },
      ],
    };

    const [tickets, total] = await Promise.all([
      this.prisma.ticket.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          creator: { select: { id: true, firstName: true, lastName: true } },
          assignee: { select: { id: true, firstName: true, lastName: true } },
          tags: { include: { tag: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.ticket.count({ where }),
    ]);

    return {
      data: tickets,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // Index a ticket in Meilisearch (called after create/update)
  async indexTicket(ticket: any) {
    if (!this.meiliClient) return;
    try {
      const index = this.meiliClient.index('tickets');
      await index.addDocuments([{
        id: ticket.id,
        ticketNumber: ticket.ticketNumber,
        title: ticket.title,
        description: ticket.description,
        status: ticket.status,
        priority: ticket.priority,
        organizationId: ticket.organizationId,
        createdAt: ticket.createdAt,
      }]);
    } catch (error) {
      this.logger.error('Failed to index ticket', error);
    }
  }
}
