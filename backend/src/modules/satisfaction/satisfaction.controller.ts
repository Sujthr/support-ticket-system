import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { SatisfactionService } from './satisfaction.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface';

@ApiTags('Satisfaction Ratings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('satisfaction')
export class SatisfactionController {
  constructor(private satisfactionService: SatisfactionService) {}

  @Post('tickets/:ticketId')
  @UseGuards(RolesGuard)
  @Roles('END_USER')
  @ApiOperation({ summary: 'Submit a satisfaction rating for a ticket (End User, ticket creator only)' })
  async submitRating(
    @Param('ticketId') ticketId: string,
    @Body() body: { rating: number; feedback?: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.satisfactionService.submitRating(ticketId, user.id, body);
  }

  @Get('tickets/:ticketId')
  @ApiOperation({ summary: 'Get the satisfaction rating for a ticket' })
  async getRating(@Param('ticketId') ticketId: string) {
    return this.satisfactionService.getRating(ticketId);
  }

  @Get('agents/:agentId')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'AGENT')
  @ApiOperation({ summary: 'Get CSAT stats for an agent (Admin/Agent)' })
  async getAgentCsat(
    @Param('agentId') agentId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.satisfactionService.getAgentCsat(agentId, user.organizationId);
  }

  @Get('overview')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'AGENT')
  @ApiOperation({ summary: 'Get organization-wide CSAT stats (Admin/Agent)' })
  async getOrgCsat(@CurrentUser() user: AuthenticatedUser) {
    return this.satisfactionService.getOrgCsat(user.organizationId);
  }
}
