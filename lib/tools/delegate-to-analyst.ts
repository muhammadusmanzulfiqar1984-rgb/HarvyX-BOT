import { tool } from 'ai';
import { z } from 'zod';
import { createAnalystAgent } from '../agents/analyst-agent';
import {
  formatSpecialistResult,
  specialistFail,
  specialistOk,
} from '../agents/specialist-result';
import type { SmartModelEnv } from '../models/smart';
import { logSafe } from '../observability';

export function delegateToAnalystTool(env: SmartModelEnv) {
  return tool({
    description:
      'Delegate to the Analyst agent for hard reasoning, drafting, research, or analysis.',
    inputSchema: z.object({
      task: z.string().min(1).max(8000).describe('The reasoning/drafting/analysis task to complete'),
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
        const analystAgent = createAnalystAgent(env);
        const result = await analystAgent.generate({ prompt: task, abortSignal });
        logSafe('specialist_ok', {
          agent: 'Analyst',
          operation: 'generate',
          provider,
          elapsedMs: Date.now() - started,
        });
        return formatSpecialistResult(specialistOk('Analyst', result.text));
      } catch (err) {
        return formatSpecialistResult(
          specialistFail('Analyst', err, 'generate', provider),
        );
      }
    },
  });
}
