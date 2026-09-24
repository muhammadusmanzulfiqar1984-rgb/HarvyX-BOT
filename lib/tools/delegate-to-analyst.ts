import { tool } from 'ai';
import { z } from 'zod';
import { createAnalystAgent } from '../agents/analyst-agent';
import {
  formatSpecialistResult,
  specialistFail,
  specialistOk,
} from '../agents/specialist-result';
import type { SmartModelEnv } from '../models/smart';
import { resolveSmartProviderLogId } from '../models/router';
import { requireRunnableBot, logBotExecution } from '../bots/runtime';

export function delegateToAnalystTool(env: SmartModelEnv) {
  return tool({
    description:
      'Delegate to the Analyst agent for hard reasoning, drafting, research, or analysis.',
    inputSchema: z.object({
      task: z.string().min(1).max(8000).describe('The reasoning/drafting/analysis task to complete'),
    }),
    execute: async ({ task }, { abortSignal }) => {
      const started = Date.now();
      const bot = requireRunnableBot('analyst');
      const provider = resolveSmartProviderLogId(env);
      logBotExecution('bot_execute_start', bot, { operation: 'delegate', provider });
      try {
        const analystAgent = createAnalystAgent(env);
        const result = await analystAgent.generate({ prompt: task, abortSignal });
        logBotExecution('bot_execute_ok', bot, {
          operation: 'generate',
          provider,
          elapsedMs: Date.now() - started,
        });
        return formatSpecialistResult(specialistOk('Analyst', result.text));
      } catch (err) {
        logBotExecution('bot_execute_fail', bot, {
          operation: 'generate',
          provider,
          elapsedMs: Date.now() - started,
          category: 'provider',
          message: err instanceof Error ? err.message : 'unknown',
        });
        return formatSpecialistResult(specialistFail('Analyst', err, 'generate', provider));
      }
    },
  });
}
