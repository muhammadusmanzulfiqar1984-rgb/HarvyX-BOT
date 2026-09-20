import { ToolLoopAgent } from 'ai';
import { resolveModel } from '../models/router';
import { getBotDefinition } from '../bots';
import { harvyxTools, type HarvyxEnv } from '../tools/harvyx';

export interface OpsAgentEnv extends HarvyxEnv {
  GROQ_API_KEY: string;
  GROQ_FAST_MODEL?: string;
}

/** Reads and writes HarvyX lead/campaign data via the REST API connector. */
export function createOpsAgent(env: OpsAgentEnv) {
  const bot = getBotDefinition('ops');
  return new ToolLoopAgent({
    model: resolveModel(bot.modelTier === 'code' ? 'fast' : bot.modelTier, env),
    instructions: bot.instructions,
    tools: harvyxTools(env),
  });
}
