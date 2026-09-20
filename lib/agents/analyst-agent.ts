import { ToolLoopAgent } from 'ai';
import { resolveModel } from '../models/router';
import { getBotDefinition } from '../bots';
import type { SmartModelEnv } from '../models/smart';

/** Handles hard reasoning, drafting, and analysis using a large open-weight model. */
export function createAnalystAgent(env: SmartModelEnv) {
  const bot = getBotDefinition('analyst');
  return new ToolLoopAgent({
    model: resolveModel(bot.modelTier === 'code' ? 'reasoning' : bot.modelTier, env),
    instructions: bot.instructions,
  });
}
