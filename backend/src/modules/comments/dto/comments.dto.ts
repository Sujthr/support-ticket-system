import { IsString, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCommentDto {
  @ApiProperty()
  @IsString()
  body: string;

  @ApiPropertyOptional({ description: 'Internal note (only visible to agents)' })
  @IsOptional()
  @IsBoolean()
  isInternal?: boolean;
}

export class UpdateCommentDto {
  @ApiProperty()
  @IsString()
  body: string;
}
