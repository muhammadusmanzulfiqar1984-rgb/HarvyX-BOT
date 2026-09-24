import { ToolLoopAgent } from 'ai';
import { requireRunnableBot, resolveBotModel } from '../bots/runtime';
import type { SmartModelEnv } from '../models/smart';

/** Platform-accurate social media strategy and critique using a large open-weight model. */
export function createSocialAgent(env: SmartModelEnv) {
  const bot = requireRunnableBot('social');
  return new ToolLoopAgent({
    model: resolveBotModel(bot, env),
    instructions: bot.instructions,
  });
}
