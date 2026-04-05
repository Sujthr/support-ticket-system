import { Controller, Get, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { SlaService } from './sla.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface';

@ApiTags('SLA Policies')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('sla-policies')
export class SlaController {
  constructor(private slaService: SlaService) {}

  @Get()
  @ApiOperation({ summary: 'Get SLA policies for organization' })
  async findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.slaService.getSlaPolicies(user.organizationId);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Update SLA policy (Admin only)' })
  async update(
    @Param('id') id: string,
    @Body() body: { firstResponseMinutes?: number; resolutionMinutes?: number; isActive?: boolean },
  ) {
    return this.slaService.updateSlaPolicy(id, body);
  }
}
