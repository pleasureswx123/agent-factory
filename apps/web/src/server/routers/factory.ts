import { factoryDnas } from '@agent-os/db';
import { DEFAULT_FACTORY_DNA, normalizeFactoryDna, updateFactoryDnaSchema } from '@agent-os/shared';
import { desc } from 'drizzle-orm';
import { publicProcedure, router } from '../trpc';

function rowToDna(row: typeof factoryDnas.$inferSelect | null) {
  if (!row) return normalizeFactoryDna(DEFAULT_FACTORY_DNA);
  return normalizeFactoryDna({
    name: row.name,
    icon: row.icon,
    description: row.description,
    prompt: row.prompt,
    rules: row.rules,
    guidelines: row.guidelines,
    skills: row.skills,
    tools: row.tools,
    modelProfileId: row.modelProfileId,
    reasoningMode: row.reasoningMode,
    memoryPolicy: row.memoryPolicy,
  });
}

export const factoryRouter = router({
  getDna: publicProcedure.query(async ({ ctx }) => {
    const [current] = await ctx.db
      .select()
      .from(factoryDnas)
      .orderBy(desc(factoryDnas.version))
      .limit(1);
    return {
      version: current?.version ?? 0,
      dna: rowToDna(current ?? null),
      changeNote: current?.changeNote ?? null,
      createdAt: current?.createdAt ?? null,
    };
  }),

  history: publicProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select()
      .from(factoryDnas)
      .orderBy(desc(factoryDnas.version))
      .limit(20);
    return rows.map((row) => ({
      id: row.id,
      version: row.version,
      dna: rowToDna(row),
      changeNote: row.changeNote,
      createdAt: row.createdAt,
    }));
  }),

  updateDna: publicProcedure.input(updateFactoryDnaSchema).mutation(async ({ ctx, input }) => {
    const dna = normalizeFactoryDna(input.dna);
    const [latest] = await ctx.db
      .select({ version: factoryDnas.version })
      .from(factoryDnas)
      .orderBy(desc(factoryDnas.version))
      .limit(1);
    const [created] = await ctx.db
      .insert(factoryDnas)
      .values({
        version: (latest?.version ?? 0) + 1,
        name: dna.name,
        icon: dna.icon,
        description: dna.description,
        prompt: dna.prompt,
        rules: dna.rules,
        guidelines: dna.guidelines,
        skills: dna.skills,
        tools: dna.tools,
        modelProfileId: dna.modelProfileId ?? null,
        reasoningMode: dna.reasoningMode,
        memoryPolicy: dna.memoryPolicy,
        changeNote: input.changeNote,
      })
      .returning();
    return {
      version: created?.version ?? (latest?.version ?? 0) + 1,
      dna,
      changeNote: created?.changeNote ?? null,
      createdAt: created?.createdAt ?? null,
    };
  }),
});
