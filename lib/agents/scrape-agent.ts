import { ToolLoopAgent } from 'ai';
import { requireRunnableBot, resolveBotModel, selectBotTools } from '../bots/runtime';
import type { FastModelEnv } from '../models/router';
import { scrapeTools } from '../tools/scrape/tools';

export type ScrapeAgentEnv = FastModelEnv;

/** Fetches and extracts public web pages for lead enrichment, competitor/market research, or general lookup. */
export function createScrapeAgent(env: ScrapeAgentEnv) {
  const bot = requireRunnableBot('scrape');
  const pack = scrapeTools();
  const tools = selectBotTools(bot, pack) as typeof pack;
  return new ToolLoopAgent({
    model: resolveBotModel(bot, env),
    instructions: bot.instructions,
    tools,
  });
}
