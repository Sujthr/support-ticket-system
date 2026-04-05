import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { SearchService } from './search.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface';

@ApiTags('Search')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('search')
export class SearchController {
  constructor(private searchService: SearchService) {}

  @Get('tickets')
  @ApiOperation({ summary: 'Full-text search tickets' })
  async searchTickets(
    @Query('q') query: string,
    @Query('page') page: string,
    @Query('limit') limit: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.searchService.searchTickets(
      user.organizationId,
      query || '',
      parseInt(page) || 1,
      parseInt(limit) || 20,
    );
  }
}
