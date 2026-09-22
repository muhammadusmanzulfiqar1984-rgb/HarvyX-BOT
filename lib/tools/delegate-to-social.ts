import { tool } from 'ai';
import { z } from 'zod';
import { createSocialAgent } from '../agents/social-agent';
import {
  formatSpecialistResult,
  specialistFail,
  specialistOk,
} from '../agents/specialist-result';
import type { SmartModelEnv } from '../models/smart';
import { logSafe } from '../observability';

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
      const provider =
        env.SMART_PROVIDER === 'nebius'
          ? 'nebius'
          : env.SMART_PROVIDER === 'pareto' ||
              env.SMART_PROVIDER === 'cloudflare-pareto' ||
              env.SMART_PROVIDER === 'cloudflare'
            ? 'cloudflare-pareto'
            : 'nvidia';
      try {
        const socialAgent = createSocialAgent(env);
        const result = await socialAgent.generate({ prompt: task, abortSignal });
        logSafe('specialist_ok', {
          agent: 'Social',
          operation: 'generate',
          provider,
          elapsedMs: Date.now() - started,
        });
        return formatSpecialistResult(specialistOk('Social', result.text));
      } catch (err) {
        return formatSpecialistResult(specialistFail('Social', err, 'generate', provider));
      }
    },
  });
}
