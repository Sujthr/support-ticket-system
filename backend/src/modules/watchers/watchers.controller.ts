import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { WatchersService } from './watchers.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface';

@ApiTags('Ticket Watchers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('tickets/:ticketId/watchers')
export class WatchersController {
  constructor(private watchersService: WatchersService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'AGENT')
  @ApiOperation({ summary: 'Add a watcher to a ticket (Agent/Admin)' })
  async addWatcher(
    @Param('ticketId') ticketId: string,
    @Body() body: { userId: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.watchersService.addWatcher(ticketId, body.userId, user.organizationId);
  }

  @Delete(':userId')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'AGENT')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove a watcher from a ticket (Agent/Admin)' })
  async removeWatcher(
    @Param('ticketId') ticketId: string,
    @Param('userId') userId: string,
  ) {
    return this.watchersService.removeWatcher(ticketId, userId);
  }

  @Get()
  @ApiOperation({ summary: 'List watchers of a ticket' })
  async getWatchers(@Param('ticketId') ticketId: string) {
    return this.watchersService.getWatchers(ticketId);
  }

  @Post('me')
  @ApiOperation({ summary: 'Watch a ticket (add self as watcher)' })
  async watchTicket(
    @Param('ticketId') ticketId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.watchersService.addWatcher(ticketId, user.id, user.organizationId);
  }

  @Delete('me')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unwatch a ticket (remove self as watcher)' })
  async unwatchTicket(
    @Param('ticketId') ticketId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.watchersService.removeWatcher(ticketId, user.id);
  }
}
