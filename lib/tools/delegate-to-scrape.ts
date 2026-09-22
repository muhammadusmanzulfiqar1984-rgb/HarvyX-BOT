import { tool } from 'ai';
import { z } from 'zod';
import { createScrapeAgent, type ScrapeAgentEnv } from '../agents/scrape-agent';
import {
  formatSpecialistResult,
  specialistFail,
  specialistOk,
} from '../agents/specialist-result';
import { logSafe } from '../observability';

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
      try {
        const scrapeAgent = createScrapeAgent(env);
        const result = await scrapeAgent.generate({ prompt: task, abortSignal });
        logSafe('specialist_ok', {
          agent: 'Scrape',
          operation: 'generate',
          provider: 'groq',
          elapsedMs: Date.now() - started,
        });
        return formatSpecialistResult(specialistOk('Scrape', result.text));
      } catch (err) {
        return formatSpecialistResult(specialistFail('Scrape', err, 'generate', 'groq'));
      }
    },
  });
}
