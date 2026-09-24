/**
 * Bot Runtime — Phase 2 end-to-end wiring.
 *
 * BotDefinition → Model Router → tools (capabilities) → policy/approval
 *
 * Does NOT replace agent factories or create a second registry.
 * Preserves slug "mian" for the Manager orchestrator.
 */

import type { BotDefinition, BotModelTier } from './types';
import { isRunnableStatus } from './types';
import { getBotDefinition } from './registry';
import { getBotRegistry, BotRegistryError } from './bot-registry';
import { resolveBotParticleAgent } from './registry';
import {
  resolveModel,
  type ExplicitProvider,
  type FastModelEnv,
  type ManagerProvider,
  type SmartModelEnv,
} from '../models/router';
import { isLocalH100Provider, LOCAL_H100_PROVIDER } from '../models/local-h100';
import { classify } from '../policy/classes';
import type { ApprovalDecision } from '../policy/approval';
import { logSafe, type ErrorCategory } from '../observability';

export type BotModelEnv = FastModelEnv | SmartModelEnv;

export type ResolveBotModelOptions = {
  /** Request-level override (e.g. MANAGER_PROVIDER). Wins over bot.modelPolicy.provider. */
  provider?: ManagerProvider | string;
};

/** Map BotDefinition.modelPolicy → Model Router. */
export function resolveBotModel(
  botOrSlug: BotDefinition | string,
  env: BotModelEnv,
  options: ResolveBotModelOptions = {},
) {
  const bot = typeof botOrSlug === 'string' ? getBotDefinition(botOrSlug) : botOrSlug;
  const tier = effectiveTier(bot);
  const requested =
    options.provider && options.provider !== 'groq'
      ? String(options.provider)
      : bot.modelPolicy.provider?.trim() || undefined;

  if (requested) {
    assertProviderAllowed(bot, requested);
    if (isLocalH100Provider(requested)) {
      return resolveModel(tier, env, { provider: LOCAL_H100_PROVIDER as ExplicitProvider });
    }
    // Non-explicit providers (groq / nvidia / nebius / pareto) stay on the tier path.
    // Env SMART_PROVIDER / GROQ_* still select the concrete backend inside the router.
  }

  return resolveModel(tier, env);
}

function effectiveTier(bot: BotDefinition): Exclude<BotModelTier, 'code'> {
  const tier = bot.modelPolicy.tier ?? bot.modelTier;
  if (tier === 'code') {
    // Code tier not configured — specialists that mistakenly list it fall back safely.
    return bot.kind === 'orchestrator' ? 'fast' : 'reasoning';
  }
  return tier;
}

function assertProviderAllowed(bot: BotDefinition, provider: string): void {
  const allowed = bot.modelPolicy.routingPolicy?.allowedProviders;
  if (!allowed || allowed.length === 0) return;
  const p = provider.trim().toLowerCase();
  const ok = allowed.some((a) => a.toLowerCase() === p);
  if (!ok) {
    throw new BotRegistryError(
      `Provider "${provider}" is not allowed for bot "${bot.slug}". Allowed: ${allowed.join(', ')}`,
    );
  }
}

/** Ensure the bot exists and is runnable (active/testing). */
export function requireRunnableBot(slug: string): BotDefinition {
  const bot = getBotRegistry().get(slug);
  if (!bot) throw new BotRegistryError(`Unknown bot: ${slug}`);
  if (!isRunnableStatus(bot.status)) {
    throw new BotRegistryError(
      `Bot "${slug}" is not runnable (status=${bot.status}).`,
    );
  }
  return bot;
}

/**
 * Select tools a bot may use from an available map.
 * - Empty/missing capabilities.tools → entire pack (factory already scoped).
 * - Pack tokens `harvyx` / `scrape` → entire pack.
 * - Explicit names → intersection with available keys only.
 */
export function selectBotTools<T extends Record<string, unknown>>(
  bot: BotDefinition,
  available: T,
): Partial<T> {
  const requested = bot.capabilities.tools;
  if (!requested || requested.length === 0) {
    return available;
  }

  if (
    requested.length === 1 &&
    (requested[0] === 'harvyx' ||
      requested[0] === 'scrape' ||
      requested[0] === bot.capabilities.toolPack)
  ) {
    return available;
  }

  const out: Partial<T> = {};
  for (const name of requested) {
    if (Object.prototype.hasOwnProperty.call(available, name)) {
      out[name as keyof T] = available[name as keyof T];
    }
  }
  return out;
}

/** Whether this bot's permissions/policy require approval for an action key. */
export function botRequiresApproval(bot: BotDefinition, actionKey: string): boolean {
  const listed = bot.permissions.requiresApproval ?? [];
  if (listed.includes(actionKey)) return true;
  const entry = classify(actionKey);
  return Boolean(entry?.requiresApproval);
}

/**
 * Permission gate before a send-class (or otherwise restricted) action.
 * Does not replace checkSendApproval — call both for outbound sends.
 */
export function assertBotMayPerform(
  botOrSlug: BotDefinition | string,
  actionKey: string,
): ApprovalDecision {
  const bot = typeof botOrSlug === 'string' ? getBotDefinition(botOrSlug) : botOrSlug;
  const entry = classify(actionKey);
  const allowed = bot.permissions.allowedActions;

  if (allowed && allowed.length > 0 && entry) {
    const need =
      entry.cls === 'send'
        ? 'send'
        : entry.cls === 'write'
          ? 'write'
          : entry.cls === 'delegate'
            ? 'delegate'
            : entry.cls === 'external'
              ? 'external'
              : 'read';
    if (!allowed.includes(need) && !allowed.includes(entry.cls)) {
      return {
        ok: false,
        error: `Bot "${bot.slug}" is not permitted to perform "${actionKey}" (${entry.cls}).`,
      };
    }
  }

  const connectors = bot.permissions.allowedConnectors;
  if (connectors && connectors.length > 0) {
    const connector = actionKey.split('.')[0];
    if (
      (connector === 'gmail' || connector === 'calendar' || connector === 'harvyxSend') &&
      !connectors.includes(connector === 'harvyxSend' ? 'harvyx' : connector) &&
      !connectors.includes(connector)
    ) {
      // harvyxSend is Manager-owned, not a CRM connector — allow if 'send' action permitted
      if (connector === 'harvyxSend') {
        /* fall through — covered by allowedActions */
      } else if (!connectors.includes(connector)) {
        return {
          ok: false,
          error: `Bot "${bot.slug}" is not permitted to use connector "${connector}".`,
        };
      }
    }
  }

  return { ok: true };
}

/** Traceable execution log — request → bot → model → (tools later). */
export function logBotExecution(
  event: 'bot_execute_start' | 'bot_execute_ok' | 'bot_execute_fail',
  bot: BotDefinition,
  extra: {
    operation: string;
    provider?: string;
    elapsedMs?: number;
    category?: ErrorCategory;
    message?: string;
  },
): void {
  logSafe(event, {
    agent: bot.name,
    bot: bot.slug,
    particle: resolveBotParticleAgent(bot.slug) ?? bot.visual.particleAgent,
    modelTier: bot.modelPolicy.tier,
    operation: extra.operation,
    provider: extra.provider,
    elapsedMs: extra.elapsedMs,
    category: extra.category,
    message: extra.message,
  });
}

/** Resolve specialist factory slug from Manager delegate tool name. */
export const DELEGATE_TARGET_SLUG = {
  delegateToOps: 'ops',
  delegateToAnalyst: 'analyst',
  delegateToSocial: 'social',
  delegateToScrape: 'scrape',
} as const;

export type DelegateToolName = keyof typeof DELEGATE_TARGET_SLUG;
