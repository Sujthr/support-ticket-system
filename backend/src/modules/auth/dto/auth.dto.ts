import { IsEmail, IsString, MinLength, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SignupDto {
  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty()
  @IsString()
  firstName: string;

  @ApiProperty()
  @IsString()
  lastName: string;

  @ApiProperty({ description: 'Organization name (creates new org)' })
  @IsString()
  organizationName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  organizationSlug?: string;
}

export class LoginDto {
  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  password: string;

  @ApiProperty({ description: 'Organization slug to login to' })
  @IsString()
  organizationSlug: string;
}

export class RefreshTokenDto {
  @ApiProperty()
  @IsString()
  refreshToken: string;
}

export class InviteUserDto {
  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  firstName: string;

  @ApiProperty()
  @IsString()
  lastName: string;

  @ApiProperty({ enum: ['ADMIN', 'AGENT', 'END_USER'] })
  @IsString()
  role: string;
}
