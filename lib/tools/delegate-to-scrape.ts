import { tool } from 'ai';
import { z } from 'zod';
import { createScrapeAgent, type ScrapeAgentEnv } from '../agents/scrape-agent';
import {
  formatSpecialistResult,
  specialistFail,
  specialistOk,
} from '../agents/specialist-result';
import { requireRunnableBot, logBotExecution } from '../bots/runtime';

export function delegateToScrapeTool(env: ScrapeAgentEnv) {
  return tool({
    description:
      'Delegate to the Scrape agent to fetch and extract public web pages — company/lead ' +
      'enrichment from a website, competitor/market pages, or a general URL lookup. Cannot ' +
      'render JavaScript and will not target LinkedIn/Instagram/Facebook/X/TikTok directly.',
    inputSchema: z.object({
      task: z.string().min(1).max(4000).describe('What to fetch/extract and why, including the URL(s) if known'),
    }),
    execute: async ({ task }, { abortSignal }) => {
      const started = Date.now();
      const bot = requireRunnableBot('scrape');
      logBotExecution('bot_execute_start', bot, { operation: 'delegate', provider: 'groq' });
      try {
        const scrapeAgent = createScrapeAgent(env);
        const result = await scrapeAgent.generate({ prompt: task, abortSignal });
        logBotExecution('bot_execute_ok', bot, {
          operation: 'generate',
          provider: 'groq',
          elapsedMs: Date.now() - started,
        });
        return formatSpecialistResult(specialistOk('Scrape', result.text));
      } catch (err) {
        logBotExecution('bot_execute_fail', bot, {
          operation: 'generate',
          provider: 'groq',
          elapsedMs: Date.now() - started,
          category: 'provider',
          message: err instanceof Error ? err.message : 'unknown',
        });
        return formatSpecialistResult(specialistFail('Scrape', err, 'generate', 'groq'));
      }
    },
  });
}
