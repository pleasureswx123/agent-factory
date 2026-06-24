import { getDb } from '@agent-os/db';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { handleChat } from './routes/chat';
import {
  handleFactoryChat,
  handleFactoryEvolve,
  handleTestEvaluate,
  handleTestRun,
} from './routes/factory';

const app = new Hono();
const db = getDb();

const corsOrigins = (
  process.env.RUNTIME_CORS_ORIGINS ?? 'http://localhost:3000,http://127.0.0.1:3000'
)
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

// 本地单用户工具：默认仅放行本机 web 端，容器部署时通过环境变量补充访问地址
app.use(
  '*',
  cors({
    origin: corsOrigins,
    exposeHeaders: ['x-message-id'],
  }),
);

app.get('/health', (c) =>
  c.json({ status: 'ok', service: 'agent-os-runtime', timestamp: Date.now() }),
);

app.post('/chat', (c) => handleChat(c, db));
app.post('/factory/chat', (c) => handleFactoryChat(c, db));
app.post('/factory/evolve', (c) => handleFactoryEvolve(c, db));
app.post('/test-run', (c) => handleTestRun(c, db));
app.post('/test-evaluate', (c) => handleTestEvaluate(c, db));

app.onError((err, c) => {
  console.error('[runtime] error:', err);
  return c.json({ error: err.message || '服务内部错误' }, 500);
});

const port = Number(process.env.PORT ?? 4001);
const hostname = process.env.HOST ?? '127.0.0.1';

serve({ fetch: app.fetch, port, hostname }, ({ port }) => {
  console.log(`[runtime] listening on http://${hostname}:${port}`);
});
