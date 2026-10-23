/**
 * Programmatic bot-to-bot delegation (outside the Manager's tool loop).
 * Returns the same formatted string the delegate tools return, so callers can
 * detect failure via the `[<Agent> failed · …]` prefix.
 */
import { createAnalystAgent } from '../agents/analyst-agent';
import { createOpsAgent, type OpsAgentEnv } from '../agents/ops-agent';
import { createScrapeAgent } from '../agents/scrape-agent';
import { createSocialAgent } from '../agents/social-agent';
import {
  formatSpecialistResult,
  specialistFail,
  specialistOk,
  type SpecialistAgentName,
} from '../agents/specialist-result';
import { logBotExecution, requireRunnableBot } from '../bots/runtime';
import type { SmartModelEnv } from '../models/smart';
import type { FastModelEnv } from '../models/router';

export type DelegateEnv = OpsAgentEnv & SmartModelEnv & FastModelEnv;

export type DelegateTarget = 'ops' | 'analyst' | 'social' | 'scrape';

const AGENT_NAME: Record<DelegateTarget, SpecialistAgentName> = {
  ops: 'OPS',
  analyst: 'Analyst',
  social: 'Social',
  scrape: 'Scrape',
};

function createAgent(target: DelegateTarget, env: DelegateEnv) {
  switch (target) {
    case 'ops':
      return createOpsAgent(env);
    case 'analyst':
      return createAnalystAgent(env);
    case 'social':
      return createSocialAgent(env);
    case 'scrape':
      return createScrapeAgent(env);
  }
}

export async function runAgentDelegation(opts: {
  fromSlug: string;
  toSlug: DelegateTarget;
  task: string;
  env: DelegateEnv;
  abortSignal?: AbortSignal;
}): Promise<string> {
  const { fromSlug, toSlug, task, env, abortSignal } = opts;
  const agentName = AGENT_NAME[toSlug];
  const bot = requireRunnableBot(toSlug);
  const started = Date.now();
  logBotExecution('bot_execute_start', bot, { operation: `delegate:${fromSlug}` });
  try {
    const agent = createAgent(toSlug, env);
    const result = await agent.generate({ prompt: task, abortSignal });
    logBotExecution('bot_execute_ok', bot, {
      operation: 'generate',
      elapsedMs: Date.now() - started,
    });
    return formatSpecialistResult(specialistOk(agentName, result.text));
  } catch (err) {
    logBotExecution('bot_execute_fail', bot, {
      operation: 'generate',
      elapsedMs: Date.now() - started,
      category: 'provider',
      message: err instanceof Error ? err.message : 'unknown',
    });
    return formatSpecialistResult(specialistFail(agentName, err, 'generate'));
  }
}
