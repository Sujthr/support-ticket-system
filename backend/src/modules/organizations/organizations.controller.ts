import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { OrganizationsService } from './organizations.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface';

@ApiTags('Organizations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('organizations')
export class OrganizationsController {
  constructor(private orgService: OrganizationsService) {}

  @Get('current')
  @ApiOperation({ summary: 'Get current organization details' })
  async getCurrent(@CurrentUser() user: AuthenticatedUser) {
    return this.orgService.findOne(user);
  }

  @Patch('current')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Update organization (Admin only)' })
  async update(
    @Body() body: { name?: string; logo?: string; domain?: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.orgService.update(user, body);
  }

  @Get('tags')
  @ApiOperation({ summary: 'Get all tags for this organization' })
  async getTags(@CurrentUser() user: AuthenticatedUser) {
    return this.orgService.getTags(user);
  }
}
