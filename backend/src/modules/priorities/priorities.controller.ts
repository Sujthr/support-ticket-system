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
import { PrioritiesService } from './priorities.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface';

@ApiTags('Priorities')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('priorities')
export class PrioritiesController {
  constructor(private prioritiesService: PrioritiesService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Create a custom priority (Admin only)' })
  async create(
    @Body() body: { name: string; level: number; color?: string; icon?: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.prioritiesService.create(user.organizationId, body);
  }

  @Get()
  @ApiOperation({ summary: 'List all custom priorities' })
  async findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.prioritiesService.findAll(user.organizationId);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Update a custom priority (Admin only)' })
  async update(
    @Param('id') id: string,
    @Body() body: { name?: string; level?: number; color?: string; icon?: string },
  ) {
    return this.prioritiesService.update(id, body);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Delete a custom priority (Admin only)' })
  async delete(@Param('id') id: string) {
    return this.prioritiesService.delete(id);
  }
}
