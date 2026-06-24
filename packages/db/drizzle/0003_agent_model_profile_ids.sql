ALTER TABLE "agent_dnas" ADD COLUMN "model_profile_ids" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
UPDATE "agent_dnas"
SET "model_profile_ids" = jsonb_build_array("model_profile_id")
WHERE "model_profile_id" IS NOT NULL
  AND "model_profile_ids" = '[]'::jsonb;
