-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "domain" TEXT,
    "logo" TEXT,
    "plan" TEXT NOT NULL DEFAULT 'FREE',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "avatar" TEXT,
    "role" TEXT NOT NULL DEFAULT 'END_USER',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" DATETIME,
    "organization_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "users_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "token" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "expires_at" DATETIME NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "tickets" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ticket_number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "organization_id" TEXT NOT NULL,
    "creator_id" TEXT NOT NULL,
    "assignee_id" TEXT,
    "sla_policy_id" TEXT,
    "sla_breached" BOOLEAN NOT NULL DEFAULT false,
    "due_at" DATETIME,
    "resolved_at" DATETIME,
    "closed_at" DATETIME,
    "first_response_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "tickets_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "tickets_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "tickets_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "tickets_sla_policy_id_fkey" FOREIGN KEY ("sla_policy_id") REFERENCES "sla_policies" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "comments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "body" TEXT NOT NULL,
    "is_internal" BOOLEAN NOT NULL DEFAULT false,
    "ticket_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "comments_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "file_name" TEXT NOT NULL,
    "file_url" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "mime_type" TEXT NOT NULL,
    "ticket_id" TEXT,
    "comment_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "attachments_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "attachments_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "comments" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "tags" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6B7280',
    "organization_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tags_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ticket_tags" (
    "ticket_id" TEXT NOT NULL,
    "tag_id" TEXT NOT NULL,

    PRIMARY KEY ("ticket_id", "tag_id"),
    CONSTRAINT "ticket_tags_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ticket_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "sla_policies" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "priority" TEXT NOT NULL,
    "first_response_minutes" INTEGER NOT NULL,
    "resolution_minutes" INTEGER NOT NULL,
    "organization_id" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "sla_policies_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "activity_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "action" TEXT NOT NULL,
    "details" TEXT,
    "ticket_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "activity_logs_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "activity_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "recipient_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "metadata" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notifications_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "notifications_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "article_categories" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "organization_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "article_categories_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "articles" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "category_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "articles_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "article_categories" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "articles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE INDEX "users_organization_id_idx" ON "users"("organization_id");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_organization_id_key" ON "users"("email", "organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_key" ON "refresh_tokens"("token");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_token_idx" ON "refresh_tokens"("token");

-- CreateIndex
CREATE INDEX "tickets_organization_id_idx" ON "tickets"("organization_id");

-- CreateIndex
CREATE INDEX "tickets_status_idx" ON "tickets"("status");

-- CreateIndex
CREATE INDEX "tickets_priority_idx" ON "tickets"("priority");

-- CreateIndex
CREATE INDEX "tickets_assignee_id_idx" ON "tickets"("assignee_id");

-- CreateIndex
CREATE INDEX "tickets_creator_id_idx" ON "tickets"("creator_id");

-- CreateIndex
CREATE INDEX "tickets_created_at_idx" ON "tickets"("created_at");

-- CreateIndex
CREATE INDEX "tickets_organization_id_status_idx" ON "tickets"("organization_id", "status");

-- CreateIndex
CREATE INDEX "tickets_organization_id_assignee_id_idx" ON "tickets"("organization_id", "assignee_id");

-- CreateIndex
CREATE UNIQUE INDEX "tickets_ticket_number_organization_id_key" ON "tickets"("ticket_number", "organization_id");

-- CreateIndex
CREATE INDEX "comments_ticket_id_idx" ON "comments"("ticket_id");

-- CreateIndex
CREATE INDEX "comments_author_id_idx" ON "comments"("author_id");

-- CreateIndex
CREATE INDEX "attachments_ticket_id_idx" ON "attachments"("ticket_id");

-- CreateIndex
CREATE INDEX "attachments_comment_id_idx" ON "attachments"("comment_id");

-- CreateIndex
CREATE UNIQUE INDEX "tags_name_organization_id_key" ON "tags"("name", "organization_id");

-- CreateIndex
CREATE INDEX "sla_policies_organization_id_idx" ON "sla_policies"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "sla_policies_priority_organization_id_key" ON "sla_policies"("priority", "organization_id");

-- CreateIndex
CREATE INDEX "activity_logs_ticket_id_idx" ON "activity_logs"("ticket_id");

-- CreateIndex
CREATE INDEX "activity_logs_created_at_idx" ON "activity_logs"("created_at");

-- CreateIndex
CREATE INDEX "notifications_recipient_id_is_read_idx" ON "notifications"("recipient_id", "is_read");

-- CreateIndex
CREATE INDEX "notifications_organization_id_idx" ON "notifications"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "article_categories_slug_organization_id_key" ON "article_categories"("slug", "organization_id");

-- CreateIndex
CREATE INDEX "articles_organization_id_is_published_idx" ON "articles"("organization_id", "is_published");

-- CreateIndex
CREATE UNIQUE INDEX "articles_slug_organization_id_key" ON "articles"("slug", "organization_id");
