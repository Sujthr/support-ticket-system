import {
  Controller, Post, Patch, Delete, Param, Body, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CommentsService } from './comments.service';
import { CreateCommentDto, UpdateCommentDto } from './dto/comments.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface';

@ApiTags('Comments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('tickets/:ticketId/comments')
export class CommentsController {
  constructor(private commentsService: CommentsService) {}

  @Post()
  @ApiOperation({ summary: 'Add a comment to a ticket' })
  async create(
    @Param('ticketId') ticketId: string,
    @Body() dto: CreateCommentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.commentsService.create(ticketId, dto, user);
  }

  @Patch(':commentId')
  @ApiOperation({ summary: 'Update a comment' })
  async update(
    @Param('commentId') commentId: string,
    @Body() dto: UpdateCommentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.commentsService.update(commentId, dto, user);
  }

  @Delete(':commentId')
  @ApiOperation({ summary: 'Delete a comment' })
  async delete(
    @Param('commentId') commentId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.commentsService.delete(commentId, user);
  }
}
