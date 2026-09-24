import { ToolLoopAgent, InferAgentUIMessage } from 'ai';
import type { ManagerProvider } from '../models/router';
import { getBotDefinition } from '../bots';
import {
  resolveBotModel,
  requireRunnableBot,
  selectBotTools,
  logBotExecution,
} from '../bots/runtime';
import { delegateToOpsTool } from '../tools/delegate-to-ops';
import { delegateToAnalystTool } from '../tools/delegate-to-analyst';
import { delegateToSocialTool } from '../tools/delegate-to-social';
import { delegateToScrapeTool } from '../tools/delegate-to-scrape';
import { delegateToGmailTool, type GmailToolEnv } from '../tools/delegate-to-gmail';
import { delegateToHarvyxSendTool } from '../tools/delegate-to-harvyx-send';
import { delegateToCalendarTool, type CalendarToolEnv } from '../tools/delegate-to-calendar';
import type { OpsAgentEnv } from './ops-agent';
import type { SmartModelEnv } from '../models/smart';
import { createApprovalGate } from '../policy/approval';

export type ManagerEnv = OpsAgentEnv & SmartModelEnv & GmailToolEnv & CalendarToolEnv;

/** @deprecated Prefer getBotDefinition('mian').instructions — kept for import stability. */
export const MIAN_INSTRUCTIONS = getBotDefinition('mian').instructions;

export type ManagerOptions = {
  /** Explicit backend. Omitted or 'groq' = current default path (bot tier → Groq). */
  provider?: ManagerProvider;
};

/** Resolve the Manager's model from BotDefinition.modelPolicy → Model Router. */
export function resolveManagerModel(env: ManagerEnv, options: ManagerOptions = {}) {
  const bot = requireRunnableBot('mian');
  return resolveBotModel(bot, env, { provider: options.provider });
}

/** Manager — the only agent the user talks to. Answers directly or delegates. */
export function createManagerAgent(env: ManagerEnv, options: ManagerOptions = {}) {
  const bot = requireRunnableBot('mian');
  // One send budget per request (= per user turn), shared across every send-capable tool:
  // a single approval authorises exactly one outbound action, whichever channel it uses.
  const sendGate = createApprovalGate(1);

  const available = {
    delegateToOps: delegateToOpsTool(env),
    delegateToAnalyst: delegateToAnalystTool(env),
    delegateToSocial: delegateToSocialTool(env),
    delegateToScrape: delegateToScrapeTool(env),
    gmail: delegateToGmailTool(env, sendGate),
    harvyxSend: delegateToHarvyxSendTool(env, sendGate),
    calendar: delegateToCalendarTool(env, sendGate),
  };

  const tools = selectBotTools(bot, available) as typeof available;

  logBotExecution('bot_execute_start', bot, {
    operation: 'createManagerAgent',
    provider: options.provider ?? bot.modelPolicy.provider ?? 'groq',
  });

  return new ToolLoopAgent({
    model: resolveBotModel(bot, env, { provider: options.provider }),
    instructions: bot.instructions,
    tools,
  });
}

export type ManagerAgent = ReturnType<typeof createManagerAgent>;
export type ManagerUIMessage = InferAgentUIMessage<ManagerAgent>;
