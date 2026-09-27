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
  /** Tool names actually attached to the Manager for this request. */
  availableTools: string[];
};

/**
 * Actual Manager backend for this request — from resolved options + env model ids.
 * No secrets. Used so Manager can answer model/provider/H100 questions truthfully.
 */
export function resolveManagerRuntimeStatus(
  env: ManagerEnv,
  options: ManagerOptions = {},
  availableTools: string[] = [],
): ManagerRuntimeStatus {
  const provider: ManagerProvider = isLocalH100Provider(options.provider)
    ? LOCAL_H100_PROVIDER
    : 'groq';
  const onH100 = provider === LOCAL_H100_PROVIDER;
  const modelId = onH100
    ? (env.HARVYX_H100_MODEL?.trim() || '(HARVYX_H100_MODEL unset)')
    : (env.GROQ_FAST_MODEL?.trim() || 'openai/gpt-oss-120b');
  return {
    provider,
    modelId,
    onH100,
    availableTools: [...availableTools].sort(),
  };
}

/** Append-only runtime block — never replaces canonical BotDefinition instructions. */
export function buildManagerRuntimeStatusBlock(status: ManagerRuntimeStatus): string {
  const tools =
    status.availableTools.length > 0
      ? status.availableTools.join(', ')
      : '(none attached this request)';

  return (
    '\n\nRUNTIME ACCESS (authoritative for this request — answer "what can you access?" from this list only):\n' +
    `- Available tools: ${tools}\n` +
    '- Tool presence means you may attempt that tool. It does NOT mean a connector is connected, that CRM/email/calendar/SMS data is already loaded, or that you have live access to every Harvics venture system.\n' +
    '- Gmail / Calendar / harvyxSend require a working connector or API result this turn before you claim inbox/calendar/send access.\n' +
    '- Ops/HARVYX CRM data is available only via Ops delegation tools after a successful tool result — not because HARVYX exists in the ecosystem.\n' +
    '- Never claim HR, textile manufacturing, business forum, trade-network, employee, financial, or proprietary-database access from ecosystem context alone.\n' +
    '\nRUNTIME MODEL (internal — disclose only if the user asks about model, provider, or infrastructure):\n' +
    `- Provider: ${status.provider}\n` +
    `- Model: ${status.modelId}\n` +
    `- Running on HARVYX H100: ${status.onH100 ? 'yes' : 'no'}\n` +
    'Do not volunteer provider/model/H100/vLLM/local-coder details in identity or access answers. If asked about model/provider/H100, state these values plainly and do not invent or deny them.'
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
  const runtime = resolveManagerRuntimeStatus(env, options, Object.keys(tools));
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
