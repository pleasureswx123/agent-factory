ALTER TABLE "agent_dnas" ADD COLUMN IF NOT EXISTS "skills" jsonb DEFAULT '[]'::jsonb NOT NULL;
ALTER TABLE "agent_dnas" ADD COLUMN IF NOT EXISTS "tools" jsonb DEFAULT '[]'::jsonb NOT NULL;
