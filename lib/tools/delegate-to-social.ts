import { tool } from 'ai';
import { z } from 'zod';
import { createSocialAgent } from '../agents/social-agent';
import {
  formatSpecialistResult,
  specialistFail,
  specialistOk,
} from '../agents/specialist-result';
import type { SmartModelEnv } from '../models/smart';
import { resolveSmartProviderLogId } from '../models/router';
import { requireRunnableBot, logBotExecution } from '../bots/runtime';

export function delegateToSocialTool(env: SmartModelEnv) {
  return tool({
    description:
      'Delegate to the Social Media agent for platform-accurate strategy and critique — hooks, ' +
      'hashtag/cadence strategy, format mismatches, campaign structuring across LinkedIn, Instagram, ' +
      'X, Facebook, TikTok, and WhatsApp. Not a source of on-brand drafts — get those from Ops first.',
    inputSchema: z.object({
      task: z.string().min(1).max(8000).describe('The social media strategy/critique task to complete'),
    }),
    execute: async ({ task }, { abortSignal }) => {
      const started = Date.now();
      const bot = requireRunnableBot('social');
      const provider = resolveSmartProviderLogId(env);
      logBotExecution('bot_execute_start', bot, { operation: 'delegate', provider });
      try {
        const socialAgent = createSocialAgent(env);
        const result = await socialAgent.generate({ prompt: task, abortSignal });
        logBotExecution('bot_execute_ok', bot, {
          operation: 'generate',
          provider,
          elapsedMs: Date.now() - started,
        });
        return formatSpecialistResult(specialistOk('Social', result.text));
      } catch (err) {
        logBotExecution('bot_execute_fail', bot, {
          operation: 'generate',
          provider,
          elapsedMs: Date.now() - started,
          category: 'provider',
          message: err instanceof Error ? err.message : 'unknown',
        });
        return formatSpecialistResult(specialistFail('Social', err, 'generate', provider));
      }
    },
  });
}
