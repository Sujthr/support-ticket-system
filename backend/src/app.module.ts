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
import { CategoriesModule } from './modules/categories/categories.module';
import { PrioritiesModule } from './modules/priorities/priorities.module';
import { WatchersModule } from './modules/watchers/watchers.module';
import { SatisfactionModule } from './modules/satisfaction/satisfaction.module';
import { TimeTrackingModule } from './modules/time-tracking/time-tracking.module';
import { EmailModule } from './modules/email/email.module';
import { CannedResponsesModule } from './modules/canned-responses/canned-responses.module';

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
    CategoriesModule,
    PrioritiesModule,
    WatchersModule,
    SatisfactionModule,
    TimeTrackingModule,
    EmailModule,
    CannedResponsesModule,
  ],
})
export class AppModule {}
