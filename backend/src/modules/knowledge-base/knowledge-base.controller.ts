import {
  Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { KnowledgeBaseService } from './knowledge-base.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface';
import { PaginationDto } from '../../common/dto/pagination.dto';

@ApiTags('Knowledge Base')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('knowledge-base')
export class KnowledgeBaseController {
  constructor(private kbService: KnowledgeBaseService) {}

  // ── Categories ──

  @Post('categories')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'AGENT')
  @ApiOperation({ summary: 'Create a category' })
  async createCategory(
    @Body() body: { name: string; description?: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.kbService.createCategory(user.organizationId, body);
  }

  @Get('categories')
  @ApiOperation({ summary: 'List categories' })
  async getCategories(@CurrentUser() user: AuthenticatedUser) {
    return this.kbService.getCategories(user.organizationId);
  }

  // ── Articles ──

  @Post('articles')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'AGENT')
  @ApiOperation({ summary: 'Create an article' })
  async createArticle(
    @Body() body: { title: string; content: string; categoryId: string; isPublished?: boolean },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.kbService.createArticle(user.organizationId, body);
  }

  @Get('articles')
  @ApiOperation({ summary: 'List articles' })
  async getArticles(
    @Query() query: PaginationDto & { categoryId?: string; search?: string; publishedOnly?: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.kbService.getArticles(user.organizationId, query);
  }

  @Get('articles/:id')
  @ApiOperation({ summary: 'Get article' })
  async getArticle(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.kbService.getArticle(id, user.organizationId);
  }

  @Patch('articles/:id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'AGENT')
  @ApiOperation({ summary: 'Update article' })
  async updateArticle(
    @Param('id') id: string,
    @Body() body: { title?: string; content?: string; categoryId?: string; isPublished?: boolean },
  ) {
    return this.kbService.updateArticle(id, body);
  }

  @Delete('articles/:id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Delete article' })
  async deleteArticle(@Param('id') id: string) {
    return this.kbService.deleteArticle(id);
  }
}
