import { tool } from 'ai';
import { z } from 'zod';
import { logSafe, logSafeError } from '../../observability';
import { fetchAndExtract, ScrapeBlockedError } from './fetch';

export function scrapeTools() {
  return {
    scrapeUrl: tool({
      description:
        'Fetch a single public web page and extract clean text, title, description, and any ' +
        'emails/phone numbers/social links found on it. Plain HTTP fetch — does NOT render ' +
        'JavaScript, so heavy single-page-app sites may return thin results. Does not follow ' +
        'redirects automatically or accept LinkedIn/Instagram/Facebook/X/TikTok as a direct target.',
      inputSchema: z.object({
        url: z.string().min(1).max(2000).describe('Full URL including https://'),
      }),
      execute: async ({ url }) => {
        const started = Date.now();
        try {
          const result = await fetchAndExtract(url);
          logSafe('scrape_ok', { operation: 'scrapeUrl', elapsedMs: Date.now() - started });
          return { ok: true, data: result };
        } catch (err) {
          if (err instanceof ScrapeBlockedError) {
            logSafe('scrape_blocked', { operation: 'scrapeUrl', message: err.message });
            return { ok: false, error: err.message };
          }
          logSafeError('scrape_failed', err, { operation: 'scrapeUrl', elapsedMs: Date.now() - started });
          const message = err instanceof Error ? err.message : 'Fetch failed.';
          return { ok: false, error: message };
        }
      },
    }),
  };
}
