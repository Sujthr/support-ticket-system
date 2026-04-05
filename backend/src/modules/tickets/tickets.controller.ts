import {
  Controller, Get, Post, Patch, Param, Body, Query,
  UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { TicketsService } from './tickets.service';
import {
  CreateTicketDto, UpdateTicketDto, TicketFilterDto, BulkUpdateTicketsDto,
} from './dto/tickets.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface';

@ApiTags('Tickets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('tickets')
export class TicketsController {
  constructor(private ticketsService: TicketsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new ticket' })
  async create(
    @Body() dto: CreateTicketDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.ticketsService.create(dto, user);
  }

  @Get()
  @ApiOperation({ summary: 'List tickets with filters' })
  async findAll(
    @Query() filters: TicketFilterDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.ticketsService.findAll(filters, user);
  }

  @Get('my')
  @ApiOperation({ summary: 'Get tickets assigned to me (agent) or created by me (end user)' })
  async getMyTickets(
    @Query() filters: TicketFilterDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.ticketsService.getMyTickets(user, filters);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get ticket details' })
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.ticketsService.findOne(id, user);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a ticket' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateTicketDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.ticketsService.update(id, dto, user);
  }

  @Patch('bulk/update')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'AGENT')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Bulk update tickets (Admin/Agent only)' })
  async bulkUpdate(
    @Body() dto: BulkUpdateTicketsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.ticketsService.bulkUpdate(dto, user);
  }
}
