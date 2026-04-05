import {
  Controller, Get, Post, Patch, Delete, Param, Body, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CannedResponsesService } from './canned-responses.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface';

@ApiTags('Canned Responses')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('canned-responses')
export class CannedResponsesController {
  constructor(private cannedResponsesService: CannedResponsesService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'AGENT')
  @ApiOperation({ summary: 'Create a canned response' })
  async create(
    @Body() dto: {
      title: string;
      content: string;
      shortcut?: string;
      categoryTag?: string;
      isShared?: boolean;
    },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.cannedResponsesService.create(user, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all canned responses available to the user' })
  async findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.cannedResponsesService.findAll(user);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'AGENT')
  @ApiOperation({ summary: 'Update a canned response (author or admin)' })
  async update(
    @Param('id') id: string,
    @Body() dto: {
      title?: string;
      content?: string;
      shortcut?: string;
      categoryTag?: string;
      isShared?: boolean;
    },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.cannedResponsesService.update(id, user.id, dto, user.role);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'AGENT')
  @ApiOperation({ summary: 'Delete a canned response (author or admin)' })
  async delete(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.cannedResponsesService.delete(id, user.id, user.role);
  }
}
