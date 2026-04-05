import {
  Controller, Get, Post, Delete, Param, Body, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JiraService } from './jira.service';
import { SaveJiraConfigDto, CreateJiraIssueDto } from './dto/jira.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface';

@ApiTags('JIRA Integration')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('jira')
export class JiraController {
  constructor(private jiraService: JiraService) {}

  @Get('config')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Get JIRA configuration (Admin only)' })
  async getConfig(@CurrentUser() user: AuthenticatedUser) {
    return this.jiraService.getConfig(user.organizationId);
  }

  @Post('config')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Save/update JIRA configuration (Admin only)' })
  async saveConfig(
    @Body() dto: SaveJiraConfigDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.jiraService.saveConfig(user.organizationId, dto);
  }

  @Delete('config')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Remove JIRA configuration (Admin only)' })
  async deleteConfig(@CurrentUser() user: AuthenticatedUser) {
    return this.jiraService.deleteConfig(user.organizationId);
  }

  @Post('create-issue')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'AGENT')
  @ApiOperation({ summary: 'Create a JIRA issue from a support ticket' })
  async createIssue(
    @Body() dto: CreateJiraIssueDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.jiraService.createIssue(dto, user.organizationId, user.id);
  }

  @Get('sync/:ticketId')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'AGENT')
  @ApiOperation({ summary: 'Sync JIRA issue status for a ticket' })
  async syncStatus(
    @Param('ticketId') ticketId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.jiraService.syncJiraStatus(ticketId, user.organizationId);
  }
}
