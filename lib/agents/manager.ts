import { ToolLoopAgent, InferAgentUIMessage } from 'ai';
import type { ManagerProvider } from '../models/router';
import { isLocalH100Provider, LOCAL_H100_PROVIDER } from '../models/local-h100';
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

export type ManagerRuntimeStatus = {
  provider: ManagerProvider;
  modelId: string;
  onH100: boolean;
};

/**
 * Actual Manager backend for this request — from resolved options + env model ids.
 * No secrets. Used so Manager can answer model/provider/H100 questions truthfully.
 */
export function resolveManagerRuntimeStatus(
  env: ManagerEnv,
  options: ManagerOptions = {},
): ManagerRuntimeStatus {
  const provider: ManagerProvider = isLocalH100Provider(options.provider)
    ? LOCAL_H100_PROVIDER
    : 'groq';
  const onH100 = provider === LOCAL_H100_PROVIDER;
  const modelId = onH100
    ? (env.HARVYX_H100_MODEL?.trim() || '(HARVYX_H100_MODEL unset)')
    : (env.GROQ_FAST_MODEL?.trim() || 'openai/gpt-oss-120b');
  return { provider, modelId, onH100 };
}

/** Append-only runtime block — never replaces canonical BotDefinition instructions. */
export function buildManagerRuntimeStatusBlock(status: ManagerRuntimeStatus): string {
  return (
    '\n\nRUNTIME STATUS (authoritative for this request — answer truthfully; do not invent or deny these facts):\n' +
    `- Provider: ${status.provider}\n` +
    `- Model: ${status.modelId}\n` +
    `- Running on HARVYX H100: ${status.onH100 ? 'yes' : 'no'}\n` +
    'When asked what model or provider you are using, or whether you are running on the H100, ' +
    'state these values plainly. Do not claim lack of visibility into your own runtime.'
  );
}

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
  const runtime = resolveManagerRuntimeStatus(env, options);
  const effectiveProvider = options.provider ?? bot.modelPolicy.provider ?? 'groq';

  logBotExecution('bot_execute_start', bot, {
    operation: 'createManagerAgent',
    provider: effectiveProvider,
  });

  return new ToolLoopAgent({
    model: resolveBotModel(bot, env, { provider: options.provider }),
    instructions: bot.instructions + buildManagerRuntimeStatusBlock(runtime),
    tools,
  });
}

export type ManagerAgent = ReturnType<typeof createManagerAgent>;
export type ManagerUIMessage = InferAgentUIMessage<ManagerAgent>;
