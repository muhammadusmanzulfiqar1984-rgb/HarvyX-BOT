/**
 * Compact capability discovery for MIAN — no provider internals leaked.
 */

import { listCapabilities, listProviders, resolveConnectionLabel } from './registry';
import type { CapabilityDiscoveryHit, MarketplaceCategoryId } from './types';

const QUERY_ALIASES: Record<string, string[]> = {
  presentation: ['presentation', 'pptx', 'slides', 'powerpoint', 'gamma', 'canva', 'deck'],
  email: ['email', 'gmail', 'outlook', 'mail'],
  crm: ['crm', 'harvyx', 'hubspot', 'salesforce', 'leads', 'campaign'],
  research: ['research', 'search', 'scrape', 'knowledge'],
  storage: ['storage', 'drive', 'dropbox', 'onedrive', 'box'],
  calendar: ['calendar', 'meeting', 'zoom', 'meet'],
};

export async function searchCapabilities(
  query: string,
  db?: D1Database,
  limit = 20,
): Promise<CapabilityDiscoveryHit[]> {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const aliases = QUERY_ALIASES[q] ?? [q];
  const providers = listProviders();
  const providerName = new Map(providers.map((p) => [p.id, p.name]));

  const caps = listCapabilities().filter((c) => {
    const hay = `${c.id} ${c.name} ${c.description} ${c.category} ${c.providerId}`.toLowerCase();
    return aliases.some((a) => hay.includes(a));
  });

  const hits: CapabilityDiscoveryHit[] = [];
  for (const c of caps.slice(0, limit * 2)) {
    const provider = providers.find((p) => p.id === c.providerId);
    if (!provider) continue;
    const connectionLabel = await resolveConnectionLabel(db, provider);
    hits.push({
      capabilityId: c.id,
      name: c.name,
      description: c.description,
      providerId: c.providerId,
      providerName: providerName.get(c.providerId) || c.providerId,
      category: c.category as MarketplaceCategoryId,
      permissions: c.permissions,
      executionMode: c.executionMode,
      requiresConnection: c.requiresConnection,
      connectionLabel,
      requiresApproval: c.requiresApproval,
    });
    if (hits.length >= limit) break;
  }
  return hits;
}

/** Suggest presentation providers for a planned presentation.create step. */
export async function suggestPresentationProviders(db?: D1Database) {
  const ids = ['powerpoint', 'gamma', 'canva', 'mock'];
  const out = [];
  for (const id of ids) {
    const p = listProviders().find((x) => x.id === id);
    if (!p) continue;
    out.push({
      providerId: p.id,
      name: p.name,
      connectionLabel: await resolveConnectionLabel(db, p),
      connectSupported: p.connectSupported,
      catalogStatus: p.catalogStatus,
    });
  }
  return out;
}
