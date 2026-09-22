import { ToolLoopAgent } from 'ai';
import { resolveModel } from '../models/router';
import { getBotDefinition } from '../bots';
import type { SmartModelEnv } from '../models/smart';

/** Platform-accurate social media strategy and critique using a large open-weight model. */
export function createSocialAgent(env: SmartModelEnv) {
  const bot = getBotDefinition('social');
  return new ToolLoopAgent({
    model: resolveModel(bot.modelTier === 'code' ? 'reasoning' : bot.modelTier, env),
    instructions: bot.instructions,
  });
}
