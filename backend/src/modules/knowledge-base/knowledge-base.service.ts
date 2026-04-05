import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { PaginatedResponse, PaginationDto } from '../../common/dto/pagination.dto';

@Injectable()
export class KnowledgeBaseService {
  constructor(private prisma: PrismaService) {}

  // ── Categories ──

  async createCategory(organizationId: string, data: { name: string; description?: string }) {
    const slug = data.name.toLowerCase().replace(/\s+/g, '-');
    return this.prisma.articleCategory.create({
      data: { ...data, slug, organizationId },
    });
  }

  async getCategories(organizationId: string) {
    return this.prisma.articleCategory.findMany({
      where: { organizationId },
      include: { _count: { select: { articles: true } } },
      orderBy: { name: 'asc' },
    });
  }

  // ── Articles ──

  async createArticle(organizationId: string, data: {
    title: string; content: string; categoryId: string; isPublished?: boolean;
  }) {
    const slug = data.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    return this.prisma.article.create({
      data: { ...data, slug, organizationId },
      include: { category: true },
    });
  }

  async getArticles(organizationId: string, query: PaginationDto & { categoryId?: string; search?: string; publishedOnly?: string }) {
    const where: any = { organizationId };
    if (query.categoryId) where.categoryId = query.categoryId;
    if (query.publishedOnly === 'true') where.isPublished = true;
    if (query.search) {
      where.OR = [
        { title: { contains: query.search } },
        { content: { contains: query.search } },
      ];
    }

    const skip = (query.page - 1) * query.limit;
    const [articles, total] = await Promise.all([
      this.prisma.article.findMany({
        where, skip, take: query.limit,
        include: { category: true },
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.article.count({ where }),
    ]);

    return new PaginatedResponse(articles, total, query.page, query.limit);
  }

  async getArticle(id: string, organizationId: string) {
    const article = await this.prisma.article.findFirst({
      where: { id, organizationId },
      include: { category: true },
    });
    if (!article) throw new NotFoundException('Article not found');
    return article;
  }

  async updateArticle(id: string, data: { title?: string; content?: string; categoryId?: string; isPublished?: boolean }) {
    const updateData: any = { ...data };
    if (data.title) updateData.slug = data.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    return this.prisma.article.update({ where: { id }, data: updateData, include: { category: true } });
  }

  async deleteArticle(id: string) {
    await this.prisma.article.delete({ where: { id } });
    return { message: 'Article deleted' };
  }
}
