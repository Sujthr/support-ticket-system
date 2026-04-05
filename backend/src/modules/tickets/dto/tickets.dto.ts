import { IsString, IsOptional, IsEnum, IsArray, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class CreateTicketDto {
  @ApiProperty()
  @IsString()
  title: string;

  @ApiProperty()
  @IsString()
  description: string;

  @ApiPropertyOptional({ enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] })
  @IsOptional()
  @IsEnum(['LOW', 'MEDIUM', 'HIGH', 'URGENT'])
  priority?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  assigneeId?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

export class UpdateTicketDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] })
  @IsOptional()
  @IsEnum(['LOW', 'MEDIUM', 'HIGH', 'URGENT'])
  priority?: string;

  @ApiPropertyOptional({ enum: ['OPEN', 'PENDING', 'RESOLVED', 'CLOSED'] })
  @IsOptional()
  @IsEnum(['OPEN', 'PENDING', 'RESOLVED', 'CLOSED'])
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  assigneeId?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

export class TicketFilterDto extends PaginationDto {
  @ApiPropertyOptional({ enum: ['OPEN', 'PENDING', 'RESOLVED', 'CLOSED'] })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] })
  @IsOptional()
  @IsString()
  priority?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  assigneeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  tag?: string;

  @ApiPropertyOptional({ enum: ['true', 'false'] })
  @IsOptional()
  @IsString()
  slaBreached?: string;
}

export class BulkUpdateTicketsDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsUUID('4', { each: true })
  ticketIds: string[];

  @ApiPropertyOptional({ enum: ['OPEN', 'PENDING', 'RESOLVED', 'CLOSED'] })
  @IsOptional()
  @IsEnum(['OPEN', 'PENDING', 'RESOLVED', 'CLOSED'])
  status?: string;

  @ApiPropertyOptional({ enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] })
  @IsOptional()
  @IsEnum(['LOW', 'MEDIUM', 'HIGH', 'URGENT'])
  priority?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  assigneeId?: string;
}
