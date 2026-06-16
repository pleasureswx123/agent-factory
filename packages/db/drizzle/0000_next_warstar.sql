CREATE TYPE "public"."agent_status" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "public"."artifact_status" AS ENUM('saved', 'archived');--> statement-breakpoint
CREATE TYPE "public"."artifact_type" AS ENUM('text', 'json', 'image', 'audio', 'video', 'report', 'file');--> statement-breakpoint
CREATE TYPE "public"."dna_status" AS ENUM('draft', 'published');--> statement-breakpoint
CREATE TYPE "public"."memory_scope" AS ENUM('agent', 'conversation');--> statement-breakpoint
CREATE TYPE "public"."message_role" AS ENUM('user', 'assistant', 'system', 'tool');--> statement-breakpoint
CREATE TYPE "public"."resource_status" AS ENUM('active', 'disabled', 'configuring');--> statement-breakpoint
CREATE TYPE "public"."resource_type" AS ENUM('provider', 'api_key', 'skill', 'tool', 'knowledge_base');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "agent_dnas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"prompt_version_id" uuid NOT NULL,
	"model_profile_id" uuid,
	"skill_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"tool_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"knowledge_base_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"memory_policy" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" "dna_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "agent_memory" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"conversation_id" uuid,
	"scope" "memory_scope" NOT NULL,
	"key" varchar(256) NOT NULL,
	"value" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "agents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"name" varchar(128) NOT NULL,
	"description" text,
	"avatar_url" text,
	"status" "agent_status" DEFAULT 'draft' NOT NULL,
	"current_dna_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "artifacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"agent_id" uuid,
	"conversation_id" uuid,
	"message_id" uuid,
	"name" varchar(256) NOT NULL,
	"type" "artifact_type" NOT NULL,
	"status" "artifact_status" DEFAULT 'saved' NOT NULL,
	"content" text,
	"file_url" text,
	"thumbnail_url" text,
	"mime_type" varchar(128),
	"size_bytes" integer,
	"source_agent_deleted" boolean DEFAULT false NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"action" varchar(64) NOT NULL,
	"entity_type" varchar(64) NOT NULL,
	"entity_id" uuid NOT NULL,
	"payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"title" varchar(256),
	"pinned" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"role" "message_role" NOT NULL,
	"content" jsonb NOT NULL,
	"artifact_refs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"tool_calls" jsonb,
	"token_usage" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "prompt_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"content" text NOT NULL,
	"change_note" text,
	"author_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "resources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"type" "resource_type" NOT NULL,
	"name" varchar(128) NOT NULL,
	"status" "resource_status" DEFAULT 'configuring' NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"secret_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "secrets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"alias" varchar(128) NOT NULL,
	"ciphertext" text NOT NULL,
	"iv" text NOT NULL,
	"auth_tag" text NOT NULL,
	"encrypted_dek" text NOT NULL,
	"kms_key_id" varchar(256),
	"hint" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"rotated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(256) NOT NULL,
	"name" varchar(128),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "agent_dnas" ADD CONSTRAINT "agent_dnas_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "agent_dnas" ADD CONSTRAINT "agent_dnas_prompt_version_id_prompt_versions_id_fk" FOREIGN KEY ("prompt_version_id") REFERENCES "public"."prompt_versions"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "agent_dnas" ADD CONSTRAINT "agent_dnas_model_profile_id_resources_id_fk" FOREIGN KEY ("model_profile_id") REFERENCES "public"."resources"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "agent_memory" ADD CONSTRAINT "agent_memory_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "agent_memory" ADD CONSTRAINT "agent_memory_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "agents" ADD CONSTRAINT "agents_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "agents" ADD CONSTRAINT "agents_current_dna_id_agent_dnas_id_fk" FOREIGN KEY ("current_dna_id") REFERENCES "public"."agent_dnas"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "conversations" ADD CONSTRAINT "conversations_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "conversations" ADD CONSTRAINT "conversations_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "prompt_versions" ADD CONSTRAINT "prompt_versions_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "prompt_versions" ADD CONSTRAINT "prompt_versions_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "resources" ADD CONSTRAINT "resources_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "resources" ADD CONSTRAINT "resources_secret_id_secrets_id_fk" FOREIGN KEY ("secret_id") REFERENCES "public"."secrets"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "secrets" ADD CONSTRAINT "secrets_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "agent_dnas_agent_version_uq" ON "agent_dnas" USING btree ("agent_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "agent_memory_agent_scope_key_uq" ON "agent_memory" USING btree ("agent_id","scope","key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agents_owner_idx" ON "agents" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agents_owner_name_idx" ON "agents" USING btree ("owner_id","name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "artifacts_owner_created_idx" ON "artifacts" USING btree ("owner_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "artifacts_agent_created_idx" ON "artifacts" USING btree ("agent_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_logs_entity_created_idx" ON "audit_logs" USING btree ("entity_type","entity_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "conversations_agent_updated_idx" ON "conversations" USING btree ("agent_id","updated_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "messages_conversation_created_idx" ON "messages" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "prompt_versions_agent_version_uq" ON "prompt_versions" USING btree ("agent_id","version");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "resources_owner_type_idx" ON "resources" USING btree ("owner_id","type");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_uq" ON "users" USING btree ("email");