import { ToolLoopAgent } from 'ai';
import { requireRunnableBot, resolveBotModel } from '../bots/runtime';
import type { SmartModelEnv } from '../models/smart';

/** Handles hard reasoning, drafting, and analysis using a large open-weight model. */
export function createAnalystAgent(env: SmartModelEnv) {
  const bot = requireRunnableBot('analyst');
  return new ToolLoopAgent({
    model: resolveBotModel(bot, env),
    instructions: bot.instructions,
  });
}
