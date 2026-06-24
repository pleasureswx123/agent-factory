import { router } from '../trpc';
import { agentRouter } from './agent';
import { artifactRouter } from './artifact';
import { conversationRouter } from './conversation';
import { factoryRouter } from './factory';
import { resourceRouter } from './resource';

export const appRouter = router({
  agent: agentRouter,
  conversation: conversationRouter,
  artifact: artifactRouter,
  factory: factoryRouter,
  resource: resourceRouter,
});

export type AppRouter = typeof appRouter;
