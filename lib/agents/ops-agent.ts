import { ToolLoopAgent } from 'ai';
import { getBotDefinition } from '../bots';
import { resolveBotModel, requireRunnableBot, selectBotTools } from '../bots/runtime';
import { harvyxTools, type HarvyxEnv } from '../tools/harvyx';

export interface OpsAgentEnv extends HarvyxEnv {
  GROQ_API_KEY: string;
  GROQ_FAST_MODEL?: string;
}

/** Reads and writes HarvyX lead/campaign data via the REST API connector. */
export function createOpsAgent(env: OpsAgentEnv) {
  const bot = requireRunnableBot('ops');
  const pack = harvyxTools(env);
  const tools = selectBotTools(bot, pack) as typeof pack;
  return new ToolLoopAgent({
    model: resolveBotModel(bot, env),
    instructions: bot.instructions,
    tools,
  });
}

/** @deprecated Prefer getBotDefinition('ops') — retained for callers that only need instructions. */
export function getOpsInstructions(): string {
  return getBotDefinition('ops').instructions;
}
