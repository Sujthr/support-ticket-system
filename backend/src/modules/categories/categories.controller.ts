import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CategoriesService } from './categories.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface';

@ApiTags('Categories')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('categories')
export class CategoriesController {
  constructor(private categoriesService: CategoriesService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Create a ticket category (Admin only)' })
  async create(
    @Body() body: { name: string; description?: string; color?: string; icon?: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.categoriesService.create(user.organizationId, body);
  }

  @Get()
  @ApiOperation({ summary: 'List all ticket categories' })
  async findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.categoriesService.findAll(user.organizationId);
  }

  @Patch('reorder')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Reorder categories (Admin only)' })
  async reorder(
    @Body() body: { ids: string[] },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.categoriesService.reorder(user.organizationId, body.ids);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Update a ticket category (Admin only)' })
  async update(
    @Param('id') id: string,
    @Body() body: { name?: string; description?: string; color?: string; icon?: string; isActive?: boolean },
  ) {
    return this.categoriesService.update(id, body);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Delete a ticket category (Admin only)' })
  async delete(@Param('id') id: string) {
    return this.categoriesService.delete(id);
  }
}
