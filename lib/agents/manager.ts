import { ToolLoopAgent, InferAgentUIMessage } from 'ai';
import { resolveModel } from '../models/router';
import { getBotDefinition } from '../bots';
import { delegateToOpsTool } from '../tools/delegate-to-ops';
import { delegateToAnalystTool } from '../tools/delegate-to-analyst';
import { delegateToGmailTool, type GmailToolEnv } from '../tools/delegate-to-gmail';
import { delegateToHarvyxSendTool } from '../tools/delegate-to-harvyx-send';
import type { OpsAgentEnv } from './ops-agent';
import type { SmartModelEnv } from '../models/smart';

export type ManagerEnv = OpsAgentEnv & SmartModelEnv & GmailToolEnv;

/** @deprecated Prefer getBotDefinition('mian').instructions — kept for import stability. */
export const MIAN_INSTRUCTIONS = getBotDefinition('mian').instructions;

/** Manager — the only agent the user talks to. Answers directly or delegates. */
export function createManagerAgent(env: ManagerEnv) {
  const bot = getBotDefinition('mian');
  return new ToolLoopAgent({
    model: resolveModel(bot.modelTier === 'code' ? 'fast' : bot.modelTier, env),
    instructions: bot.instructions,
    tools: {
      delegateToOps: delegateToOpsTool(env),
      delegateToAnalyst: delegateToAnalystTool(env),
      gmail: delegateToGmailTool(env),
      harvyxSend: delegateToHarvyxSendTool(env),
    },
  });
}

export type ManagerAgent = ReturnType<typeof createManagerAgent>;
export type ManagerUIMessage = InferAgentUIMessage<ManagerAgent>;
