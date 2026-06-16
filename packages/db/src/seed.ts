// Seed：默认本地用户 + 内置 Skills 资源（幂等，可重复执行）
import { eq } from 'drizzle-orm';
import { getDb } from './client';
import { resources, users } from './schema';

const DEFAULT_USER_ID = '00000000-0000-0000-0000-000000000001';

const BUILTIN_SKILLS = [
  { key: 'file-parse', name: '文件解析', description: '解析用户上传的文本类文件内容' },
  { key: 'summarize', name: '总结', description: '对长文本进行结构化总结' },
  {
    key: 'web-search',
    name: '网络检索',
    description: '检索网络信息（占位，MVP 暂不执行真实检索）',
  },
];

async function main() {
  const db = getDb();

  await db
    .insert(users)
    .values({ id: DEFAULT_USER_ID, email: 'local@agent-os.dev', name: '本地用户' })
    .onConflictDoNothing();
  console.log('[seed] 默认用户就绪:', DEFAULT_USER_ID);

  const existing = await db
    .select({ name: resources.name })
    .from(resources)
    .where(eq(resources.type, 'skill'));
  const existingNames = new Set(existing.map((r) => r.name));

  for (const skill of BUILTIN_SKILLS) {
    if (existingNames.has(skill.name)) continue;
    await db.insert(resources).values({
      ownerId: DEFAULT_USER_ID,
      type: 'skill',
      name: skill.name,
      status: 'active',
      config: { key: skill.key, description: skill.description, builtin: true },
    });
    console.log('[seed] 内置 Skill:', skill.name);
  }

  console.log('[seed] 完成');
  process.exit(0);
}

main().catch((err) => {
  console.error('[seed] 失败:', err);
  process.exit(1);
});
