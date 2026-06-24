CREATE TABLE IF NOT EXISTS "factory_dnas" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "version" integer NOT NULL,
  "name" varchar(128) NOT NULL,
  "icon" varchar(64) DEFAULT 'factory' NOT NULL,
  "description" text DEFAULT '' NOT NULL,
  "prompt" text NOT NULL,
  "rules" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "guidelines" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "skills" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "tools" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "model_profile_id" uuid,
  "reasoning_mode" jsonb DEFAULT '{"strategy":"plan_then_answer","selfCheck":true,"toolUse":"when_needed","maxIterations":3,"verboseTrace":false,"exposeReasoning":false}'::jsonb NOT NULL,
  "memory_policy" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "change_note" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
 ALTER TABLE "factory_dnas" ADD CONSTRAINT "factory_dnas_model_profile_id_resources_id_fk" FOREIGN KEY ("model_profile_id") REFERENCES "public"."resources"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "factory_dnas_version_uq" ON "factory_dnas" USING btree ("version");
