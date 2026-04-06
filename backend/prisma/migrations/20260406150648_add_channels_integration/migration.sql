-- AlterTable
ALTER TABLE "tickets" ADD COLUMN "caller_info" TEXT;
ALTER TABLE "tickets" ADD COLUMN "channel_message_id" TEXT;

-- CreateTable
CREATE TABLE "channel_configs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organization_id" TEXT NOT NULL,
    "imap_enabled" BOOLEAN NOT NULL DEFAULT false,
    "imap_host" TEXT,
    "imap_port" INTEGER NOT NULL DEFAULT 993,
    "imap_user" TEXT,
    "imap_pass" TEXT,
    "imap_tls" BOOLEAN NOT NULL DEFAULT true,
    "twilio_enabled" BOOLEAN NOT NULL DEFAULT false,
    "twilio_account_sid" TEXT,
    "twilio_auth_token" TEXT,
    "twilio_phone_number" TEXT,
    "twilio_record_calls" BOOLEAN NOT NULL DEFAULT false,
    "meta_whatsapp_enabled" BOOLEAN NOT NULL DEFAULT false,
    "meta_whatsapp_token" TEXT,
    "meta_whatsapp_phone_id" TEXT,
    "meta_whatsapp_verify_token" TEXT,
    "meta_whatsapp_business_id" TEXT,
    "auto_reply_enabled" BOOLEAN NOT NULL DEFAULT true,
    "deduplicate_minutes" INTEGER NOT NULL DEFAULT 30,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "channel_configs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "inbound_messages" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "channel" TEXT NOT NULL,
    "external_id" TEXT,
    "sender_identity" TEXT NOT NULL,
    "subject" TEXT,
    "body" TEXT,
    "raw_payload" TEXT,
    "ticket_id" TEXT,
    "organization_id" TEXT NOT NULL,
    "processed_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "channel_configs_organization_id_key" ON "channel_configs"("organization_id");

-- CreateIndex
CREATE INDEX "inbound_messages_organization_id_idx" ON "inbound_messages"("organization_id");

-- CreateIndex
CREATE INDEX "inbound_messages_sender_identity_organization_id_idx" ON "inbound_messages"("sender_identity", "organization_id");

-- CreateIndex
CREATE INDEX "inbound_messages_external_id_idx" ON "inbound_messages"("external_id");
