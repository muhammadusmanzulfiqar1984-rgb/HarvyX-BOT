import { tool } from 'ai';
import { z } from 'zod';
import { createOpsAgent, type OpsAgentEnv } from '../agents/ops-agent';
import {
  formatSpecialistResult,
  specialistFail,
  specialistOk,
} from '../agents/specialist-result';
import { getBotDefinition } from '../bots';
import { logBotExecution, requireRunnableBot } from '../bots/runtime';

export function delegateToOpsTool(env: OpsAgentEnv) {
  return tool({
    description:
      'Delegate to the Ops agent for anything about HarvyX leads, campaigns, CRM, or pipeline data.',
    inputSchema: z.object({
      task: z.string().min(1).max(4000).describe('What to look up or do in HarvyX, in plain language'),
    }),
    execute: async ({ task }, { abortSignal }) => {
      const started = Date.now();
      const bot = requireRunnableBot('ops');
      logBotExecution('bot_execute_start', bot, { operation: 'delegate', provider: 'groq' });
      try {
        const opsAgent = createOpsAgent(env);
        const result = await opsAgent.generate({ prompt: task, abortSignal });
        logBotExecution('bot_execute_ok', bot, {
          operation: 'generate',
          provider: 'groq',
          elapsedMs: Date.now() - started,
        });
        return formatSpecialistResult(specialistOk('OPS', result.text));
      } catch (err) {
        logBotExecution('bot_execute_fail', bot, {
          operation: 'generate',
          provider: 'groq',
          elapsedMs: Date.now() - started,
          category: 'provider',
          message: err instanceof Error ? err.message : 'unknown',
        });
        return formatSpecialistResult(specialistFail('OPS', err, 'generate', 'groq'));
      }
    },
  });
}

/** Registry slug this delegate targets (for tests / Factory). */
export function opsDelegateTargetSlug(): string {
  return getBotDefinition('ops').slug;
}
