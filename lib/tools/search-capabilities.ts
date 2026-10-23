/**
 * MIAN discovery tool — compact marketplace capability metadata only.
 */

import { tool } from 'ai';
import { z } from 'zod';
import { searchCapabilities, suggestPresentationProviders } from '@/lib/marketplace/discovery';
import { ensureMarketplaceRegistry } from '@/lib/marketplace/registry';

export function searchCapabilitiesTool(env?: { DB?: D1Database }) {
  return tool({
    description:
      'Discover Marketplace capabilities (presentations, email, CRM, research, etc.). ' +
      'Returns compact metadata only — never secrets or provider internals. ' +
      'Use before planning work that needs PowerPoint/Gamma/Canva/Gmail/HARVYX/etc. ' +
      'Does not execute capabilities.',
    inputSchema: z.object({
      query: z
        .string()
        .min(1)
        .max(80)
        .describe('Search term, e.g. presentation, email, crm, research'),
    }),
    execute: async ({ query }) => {
      ensureMarketplaceRegistry();
      const hits = await searchCapabilities(query, env?.DB, 12);
      const presentations =
        /present|slide|pptx|gamma|canva/i.test(query)
          ? await suggestPresentationProviders(env?.DB)
          : undefined;
      return {
        ok: true as const,
        query,
        count: hits.length,
        capabilities: hits.map((h) => ({
          id: h.capabilityId,
          name: h.name,
          provider: h.providerName,
          providerId: h.providerId,
          category: h.category,
          connection: h.connectionLabel,
          requiresConnection: h.requiresConnection,
          requiresApproval: h.requiresApproval,
          executionMode: h.executionMode,
        })),
        presentationProviders: presentations,
        note:
          hits.length === 0
            ? 'No capabilities matched. Try presentation, email, crm, research.'
            : 'Select a capabilityId from the registry only — never invent provider calls.',
      };
    },
  });
}
