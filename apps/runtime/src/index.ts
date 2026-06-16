import { getDb } from '@agent-os/db';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { handleChat } from './routes/chat';
import { handleFactoryChat, handleTestRun } from './routes/factory';

const app = new Hono();
const db = getDb();

// 本地单用户工具：仅放行本机 web 端
app.use(
  '*',
  cors({
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
    exposeHeaders: ['x-message-id'],
  }),
);

app.get('/health', (c) =>
  c.json({ status: 'ok', service: 'agent-os-runtime', timestamp: Date.now() }),
);

app.post('/chat', (c) => handleChat(c, db));
app.post('/factory/chat', (c) => handleFactoryChat(c, db));
app.post('/test-run', (c) => handleTestRun(c, db));

app.onError((err, c) => {
  console.error('[runtime] error:', err);
  return c.json({ error: err.message || '服务内部错误' }, 500);
});

const port = Number(process.env.PORT ?? 4001);

serve({ fetch: app.fetch, port, hostname: '127.0.0.1' }, ({ port }) => {
  console.log(`[runtime] listening on http://127.0.0.1:${port}`);
});
