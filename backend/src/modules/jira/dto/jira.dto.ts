import { IsString, IsOptional, IsBoolean, IsUrl } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SaveJiraConfigDto {
  @ApiProperty({ description: 'JIRA instance URL (e.g. https://yourcompany.atlassian.net)' })
  @IsString()
  baseUrl: string;

  @ApiProperty({ description: 'JIRA account email' })
  @IsString()
  email: string;

  @ApiProperty({ description: 'JIRA API token (from https://id.atlassian.com/manage-profile/security/api-tokens)' })
  @IsString()
  apiToken: string;

  @ApiProperty({ description: 'JIRA project key (e.g. DEV, PROJ)' })
  @IsString()
  projectKey: string;

  @ApiPropertyOptional({ description: 'Issue type (default: Task)' })
  @IsOptional()
  @IsString()
  issueType?: string;
}

export class CreateJiraIssueDto {
  @ApiProperty({ description: 'Support ticket ID to link' })
  @IsString()
  ticketId: string;

  @ApiPropertyOptional({ description: 'Override summary (defaults to ticket title)' })
  @IsOptional()
  @IsString()
  summary?: string;

  @ApiPropertyOptional({ description: 'Override description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'JIRA priority (Highest, High, Medium, Low, Lowest)' })
  @IsOptional()
  @IsString()
  priority?: string;

  @ApiPropertyOptional({ description: 'Override issue type' })
  @IsOptional()
  @IsString()
  issueType?: string;
}
