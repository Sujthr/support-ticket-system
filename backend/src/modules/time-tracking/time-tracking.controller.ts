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
import { TimeTrackingService } from './time-tracking.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface';

@ApiTags('Time Tracking')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('tickets/:ticketId/time')
export class TimeTrackingController {
  constructor(private timeTrackingService: TimeTrackingService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'AGENT')
  @ApiOperation({ summary: 'Log time on a ticket (Agent/Admin)' })
  async logTime(
    @Param('ticketId') ticketId: string,
    @Body() body: { minutes: number; description?: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.timeTrackingService.logTime(ticketId, user.id, body);
  }

  @Get()
  @ApiOperation({ summary: 'List time entries for a ticket' })
  async getEntries(@Param('ticketId') ticketId: string) {
    return this.timeTrackingService.getEntries(ticketId);
  }

  @Delete(':entryId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a time entry' })
  async deleteEntry(
    @Param('entryId') entryId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.timeTrackingService.deleteEntry(entryId, user);
  }
}
