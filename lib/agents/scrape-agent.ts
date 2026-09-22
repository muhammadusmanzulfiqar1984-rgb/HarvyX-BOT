import { ToolLoopAgent } from 'ai';
import { resolveModel, type FastModelEnv } from '../models/router';
import { getBotDefinition } from '../bots';
import { scrapeTools } from '../tools/scrape/tools';

export type ScrapeAgentEnv = FastModelEnv;

/** Fetches and extracts public web pages for lead enrichment, competitor/market research, or general lookup. */
export function createScrapeAgent(env: ScrapeAgentEnv) {
  const bot = getBotDefinition('scrape');
  return new ToolLoopAgent({
    model: resolveModel(bot.modelTier === 'code' ? 'fast' : bot.modelTier, env),
    instructions: bot.instructions,
    tools: scrapeTools(),
  });
}
