import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './database/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { TicketsModule } from './modules/tickets/tickets.module';
import { CommentsModule } from './modules/comments/comments.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { SlaModule } from './modules/sla/sla.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { KnowledgeBaseModule } from './modules/knowledge-base/knowledge-base.module';
import { SearchModule } from './modules/search/search.module';
import { AttachmentsModule } from './modules/attachments/attachments.module';
import { JiraModule } from './modules/jira/jira.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    UsersModule,
    OrganizationsModule,
    TicketsModule,
    CommentsModule,
    NotificationsModule,
    SlaModule,
    AnalyticsModule,
    KnowledgeBaseModule,
    SearchModule,
    AttachmentsModule,
    JiraModule,
  ],
})
export class AppModule {}
