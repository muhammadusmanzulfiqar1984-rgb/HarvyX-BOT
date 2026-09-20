import { tool } from 'ai';
import { z } from 'zod';
import { createOpsAgent, type OpsAgentEnv } from '../agents/ops-agent';
import {
  formatSpecialistResult,
  specialistFail,
  specialistOk,
} from '../agents/specialist-result';
import { logSafe } from '../observability';

export function delegateToOpsTool(env: OpsAgentEnv) {
  return tool({
    description:
      'Delegate to the Ops agent for anything about HarvyX leads, campaigns, CRM, or pipeline data.',
    inputSchema: z.object({
      task: z.string().min(1).max(4000).describe('What to look up or do in HarvyX, in plain language'),
    }),
    execute: async ({ task }, { abortSignal }) => {
      const started = Date.now();
      try {
        const opsAgent = createOpsAgent(env);
        const result = await opsAgent.generate({ prompt: task, abortSignal });
        logSafe('specialist_ok', {
          agent: 'OPS',
          operation: 'generate',
          provider: 'groq',
          elapsedMs: Date.now() - started,
        });
        return formatSpecialistResult(specialistOk('OPS', result.text));
      } catch (err) {
        return formatSpecialistResult(
          specialistFail('OPS', err, 'generate', 'groq'),
        );
      }
    },
  });
}
