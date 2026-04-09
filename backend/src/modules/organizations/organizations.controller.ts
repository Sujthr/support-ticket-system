import {
  Controller, Get, Patch, Post, Body, UseGuards, UseInterceptors, UploadedFile, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { OrganizationsService } from './organizations.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface';

const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/svg+xml', 'image/webp'];
const MAX_LOGO_SIZE = 2 * 1024 * 1024; // 2MB

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
    @Body() body: { name?: string; logo?: string; domain?: string; autoAssignMode?: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.orgService.update(user, body);
  }

  @Post('logo')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @UseInterceptors(FileInterceptor('logo', { limits: { fileSize: MAX_LOGO_SIZE } }))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload organization logo (Admin only)' })
  async uploadLogo(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }
    if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
      throw new BadRequestException('Invalid file type. Allowed: PNG, JPEG, GIF, SVG, WebP');
    }
    return this.orgService.uploadLogo(user, file);
  }

  @Get('tags')
  @ApiOperation({ summary: 'Get all tags for this organization' })
  async getTags(@CurrentUser() user: AuthenticatedUser) {
    return this.orgService.getTags(user);
  }
}
