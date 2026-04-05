import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface';

@ApiTags('Analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'AGENT')
@Controller('analytics')
export class AnalyticsController {
  constructor(private analyticsService: AnalyticsService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Get dashboard stats' })
  async getDashboard(@CurrentUser() user: AuthenticatedUser) {
    return this.analyticsService.getDashboardStats(user.organizationId);
  }

  @Get('volume')
  @ApiOperation({ summary: 'Get ticket volume by day' })
  async getVolume(
    @Query('days') days: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.analyticsService.getTicketVolumeByDay(user.organizationId, parseInt(days) || 30);
  }

  @Get('agent-performance')
  @ApiOperation({ summary: 'Get agent performance metrics' })
  async getAgentPerformance(@CurrentUser() user: AuthenticatedUser) {
    return this.analyticsService.getAgentPerformance(user.organizationId);
  }

  @Get('by-priority')
  @ApiOperation({ summary: 'Get tickets grouped by priority' })
  async getByPriority(@CurrentUser() user: AuthenticatedUser) {
    return this.analyticsService.getTicketsByPriority(user.organizationId);
  }

  @Get('by-status')
  @ApiOperation({ summary: 'Get tickets grouped by status' })
  async getByStatus(@CurrentUser() user: AuthenticatedUser) {
    return this.analyticsService.getTicketsByStatus(user.organizationId);
  }

  @Get('agent/:agentId')
  @ApiOperation({ summary: 'Get detailed KPI for a specific agent' })
  async getAgentKpi(
    @Param('agentId') agentId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.analyticsService.getAgentKpiDetail(agentId, user.organizationId);
  }
}
