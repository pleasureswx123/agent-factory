ALTER TABLE "agent_dnas" ADD COLUMN "rules" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_dnas" ADD COLUMN "guidelines" jsonb DEFAULT '[]'::jsonb NOT NULL;