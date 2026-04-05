-- CreateTable
CREATE TABLE "ticket_categories" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT NOT NULL DEFAULT '#6B7280',
    "icon" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "organization_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "ticket_categories_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "custom_priorities" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6B7280',
    "icon" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "organization_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "custom_priorities_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ticket_watchers" (
    "ticket_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "added_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("ticket_id", "user_id"),
    CONSTRAINT "ticket_watchers_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ticket_watchers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "satisfaction_ratings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "rating" INTEGER NOT NULL,
    "feedback" TEXT,
    "ticket_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "satisfaction_ratings_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "satisfaction_ratings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "time_entries" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "minutes" INTEGER NOT NULL,
    "description" TEXT,
    "ticket_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "time_entries_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "time_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "canned_responses" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "shortcut" TEXT,
    "category_tag" TEXT,
    "is_shared" BOOLEAN NOT NULL DEFAULT true,
    "author_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "canned_responses_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "canned_responses_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "email_configs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "smtp_host" TEXT NOT NULL,
    "smtp_port" INTEGER NOT NULL,
    "smtp_user" TEXT NOT NULL,
    "smtp_pass" TEXT NOT NULL,
    "from_email" TEXT NOT NULL,
    "from_name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "on_ticket_created" BOOLEAN NOT NULL DEFAULT true,
    "on_ticket_assigned" BOOLEAN NOT NULL DEFAULT true,
    "on_status_changed" BOOLEAN NOT NULL DEFAULT true,
    "on_new_comment" BOOLEAN NOT NULL DEFAULT true,
    "on_sla_breach" BOOLEAN NOT NULL DEFAULT true,
    "on_ticket_resolved" BOOLEAN NOT NULL DEFAULT true,
    "organization_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "email_configs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_organizations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "domain" TEXT,
    "logo" TEXT,
    "plan" TEXT NOT NULL DEFAULT 'FREE',
    "auto_assign_mode" TEXT NOT NULL DEFAULT 'MANUAL',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);
INSERT INTO "new_organizations" ("created_at", "domain", "id", "logo", "name", "plan", "slug", "updated_at") SELECT "created_at", "domain", "id", "logo", "name", "plan", "slug", "updated_at" FROM "organizations";
DROP TABLE "organizations";
ALTER TABLE "new_organizations" RENAME TO "organizations";
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");
CREATE TABLE "new_tickets" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ticket_number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "category_id" TEXT,
    "organization_id" TEXT NOT NULL,
    "creator_id" TEXT NOT NULL,
    "assignee_id" TEXT,
    "sla_policy_id" TEXT,
    "sla_breached" BOOLEAN NOT NULL DEFAULT false,
    "due_at" DATETIME,
    "resolved_at" DATETIME,
    "closed_at" DATETIME,
    "first_response_at" DATETIME,
    "total_time_minutes" INTEGER NOT NULL DEFAULT 0,
    "source" TEXT NOT NULL DEFAULT 'WEB',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "jira_issue_key" TEXT,
    "jira_issue_url" TEXT,
    "jira_status" TEXT,
    CONSTRAINT "tickets_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "tickets_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "tickets_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "tickets_sla_policy_id_fkey" FOREIGN KEY ("sla_policy_id") REFERENCES "sla_policies" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "tickets_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "ticket_categories" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_tickets" ("assignee_id", "closed_at", "created_at", "creator_id", "description", "due_at", "first_response_at", "id", "jira_issue_key", "jira_issue_url", "jira_status", "organization_id", "priority", "resolved_at", "sla_breached", "sla_policy_id", "status", "ticket_number", "title", "updated_at") SELECT "assignee_id", "closed_at", "created_at", "creator_id", "description", "due_at", "first_response_at", "id", "jira_issue_key", "jira_issue_url", "jira_status", "organization_id", "priority", "resolved_at", "sla_breached", "sla_policy_id", "status", "ticket_number", "title", "updated_at" FROM "tickets";
DROP TABLE "tickets";
ALTER TABLE "new_tickets" RENAME TO "tickets";
CREATE INDEX "tickets_organization_id_idx" ON "tickets"("organization_id");
CREATE INDEX "tickets_status_idx" ON "tickets"("status");
CREATE INDEX "tickets_priority_idx" ON "tickets"("priority");
CREATE INDEX "tickets_assignee_id_idx" ON "tickets"("assignee_id");
CREATE INDEX "tickets_creator_id_idx" ON "tickets"("creator_id");
CREATE INDEX "tickets_category_id_idx" ON "tickets"("category_id");
CREATE INDEX "tickets_created_at_idx" ON "tickets"("created_at");
CREATE INDEX "tickets_organization_id_status_idx" ON "tickets"("organization_id", "status");
CREATE INDEX "tickets_organization_id_assignee_id_idx" ON "tickets"("organization_id", "assignee_id");
CREATE UNIQUE INDEX "tickets_ticket_number_organization_id_key" ON "tickets"("ticket_number", "organization_id");
CREATE TABLE "new_users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "avatar" TEXT,
    "role" TEXT NOT NULL DEFAULT 'END_USER',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_available_for_assign" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" DATETIME,
    "organization_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "users_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_users" ("avatar", "created_at", "email", "first_name", "id", "is_active", "last_login_at", "last_name", "organization_id", "password_hash", "role", "updated_at") SELECT "avatar", "created_at", "email", "first_name", "id", "is_active", "last_login_at", "last_name", "organization_id", "password_hash", "role", "updated_at" FROM "users";
DROP TABLE "users";
ALTER TABLE "new_users" RENAME TO "users";
CREATE INDEX "users_organization_id_idx" ON "users"("organization_id");
CREATE INDEX "users_email_idx" ON "users"("email");
CREATE UNIQUE INDEX "users_email_organization_id_key" ON "users"("email", "organization_id");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "ticket_categories_organization_id_idx" ON "ticket_categories"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "ticket_categories_name_organization_id_key" ON "ticket_categories"("name", "organization_id");

-- CreateIndex
CREATE INDEX "custom_priorities_organization_id_idx" ON "custom_priorities"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "custom_priorities_name_organization_id_key" ON "custom_priorities"("name", "organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "custom_priorities_level_organization_id_key" ON "custom_priorities"("level", "organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "satisfaction_ratings_ticket_id_key" ON "satisfaction_ratings"("ticket_id");

-- CreateIndex
CREATE INDEX "satisfaction_ratings_user_id_idx" ON "satisfaction_ratings"("user_id");

-- CreateIndex
CREATE INDEX "time_entries_ticket_id_idx" ON "time_entries"("ticket_id");

-- CreateIndex
CREATE INDEX "time_entries_user_id_idx" ON "time_entries"("user_id");

-- CreateIndex
CREATE INDEX "canned_responses_organization_id_idx" ON "canned_responses"("organization_id");

-- CreateIndex
CREATE INDEX "canned_responses_author_id_idx" ON "canned_responses"("author_id");

-- CreateIndex
CREATE UNIQUE INDEX "email_configs_organization_id_key" ON "email_configs"("organization_id");
