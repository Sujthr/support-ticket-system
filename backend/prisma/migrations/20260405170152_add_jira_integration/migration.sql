-- AlterTable
ALTER TABLE "tickets" ADD COLUMN "jira_issue_key" TEXT;
ALTER TABLE "tickets" ADD COLUMN "jira_issue_url" TEXT;
ALTER TABLE "tickets" ADD COLUMN "jira_status" TEXT;

-- CreateTable
CREATE TABLE "jira_configs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "base_url" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "api_token" TEXT NOT NULL,
    "project_key" TEXT NOT NULL,
    "issue_type" TEXT NOT NULL DEFAULT 'Task',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "organization_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "jira_configs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "jira_configs_organization_id_key" ON "jira_configs"("organization_id");
