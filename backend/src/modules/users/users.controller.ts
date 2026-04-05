import {
  Controller, Get, Patch, Param, Body, Query, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface';
import { PaginationDto } from '../../common/dto/pagination.dto';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get()
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'AGENT')
  @ApiOperation({ summary: 'List users in organization' })
  async findAll(
    @Query() query: PaginationDto & { role?: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.usersService.findAll(query, user);
  }

  @Get('agents')
  @ApiOperation({ summary: 'List agents (for assignment dropdown)' })
  async getAgents(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.getAgents(user);
  }

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  async getMe(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.findOne(user.id, user);
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'AGENT')
  @ApiOperation({ summary: 'Get user details' })
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.usersService.findOne(id, user);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update own profile' })
  async updateProfile(
    @Body() body: { firstName?: string; lastName?: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.usersService.updateProfile(user.id, body);
  }

  @Patch(':id/toggle-active')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Activate/deactivate a user (Admin only)' })
  async toggleActive(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.usersService.toggleActive(id, user);
  }
}
