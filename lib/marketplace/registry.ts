/**
 * Strict provider + capability registries.
 * Unknown ids are rejected — models cannot invent provider calls.
 */

import { CATALOG_CAPABILITIES, CATALOG_PROVIDERS } from './catalog';
import { createMockProvider } from './providers/mock';
import { createCatalogOnlyProvider } from './providers/catalog-only';
import { createMcpAdapterProvider } from './providers/mcp-adapter';
import type {
  CapabilityDefinition,
  EffectiveConnectionLabel,
  IntegrationProvider,
  ProviderDefinition,
} from './types';
import { getActiveConnection } from './persist';

const providers = new Map<string, IntegrationProvider>();
const capabilities = new Map<string, CapabilityDefinition>();
let seeded = false;

export function resetMarketplaceRegistryForTests() {
  providers.clear();
  capabilities.clear();
  seeded = false;
}

function registerProvider(p: IntegrationProvider) {
  providers.set(p.id, p);
  for (const c of p.capabilities) {
    capabilities.set(c.id, c);
  }
}

export function ensureMarketplaceRegistry(): void {
  if (seeded) return;
  seeded = true;

  registerProvider(createMockProvider());
  registerProvider(createMcpAdapterProvider());

  for (const def of CATALOG_PROVIDERS) {
    if (providers.has(def.id)) continue;
    const p = createCatalogOnlyProvider(def.id);
    if (p) registerProvider(p);
  }

  // Ensure every catalog capability is addressable even if adapter omitted it
  for (const c of CATALOG_CAPABILITIES) {
    if (!capabilities.has(c.id)) capabilities.set(c.id, c);
  }
}

export function getProvider(id: string): IntegrationProvider | undefined {
  ensureMarketplaceRegistry();
  return providers.get(id);
}

export function requireProvider(id: string): IntegrationProvider {
  const p = getProvider(id);
  if (!p) throw new Error(`Unknown marketplace provider: ${id}`);
  return p;
}

export function getCapability(id: string): CapabilityDefinition | undefined {
  ensureMarketplaceRegistry();
  return capabilities.get(id);
}

export function requireCapability(id: string): CapabilityDefinition {
  const c = getCapability(id);
  if (!c) throw new Error(`Unknown marketplace capability: ${id}`);
  return c;
}

export function listProviders(filter?: {
  category?: string;
  q?: string;
}): ProviderDefinition[] {
  ensureMarketplaceRegistry();
  let list = CATALOG_PROVIDERS.slice();
  if (filter?.category) {
    list = list.filter((p) => p.category === filter.category);
  }
  if (filter?.q) {
    const q = filter.q.toLowerCase();
    list = list.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.id.includes(q) ||
        p.tags?.some((t) => t.includes(q)),
    );
  }
  return list;
}

export function listCapabilities(filter?: {
  providerId?: string;
  category?: string;
  q?: string;
}): CapabilityDefinition[] {
  ensureMarketplaceRegistry();
  let list = [...capabilities.values()].filter((c) => c.enabled);
  if (filter?.providerId) list = list.filter((c) => c.providerId === filter.providerId);
  if (filter?.category) list = list.filter((c) => c.category === filter.category);
  if (filter?.q) {
    const q = filter.q.toLowerCase();
    list = list.filter(
      (c) =>
        c.id.includes(q) ||
        c.name.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q),
    );
  }
  return list;
}

export async function resolveConnectionLabel(
  db: D1Database | undefined,
  provider: ProviderDefinition,
): Promise<EffectiveConnectionLabel> {
  if (provider.catalogStatus === 'coming_soon') return 'coming_soon';
  if (provider.catalogStatus === 'disabled') return 'disabled';

  const conn = await getActiveConnection(db, provider.id);
  if (conn?.status === 'active') return 'connected';

  if (provider.auth === 'none' || provider.auth === 'internal') {
    // Internal providers that never need a connection row
    const caps = listCapabilities({ providerId: provider.id });
    const needs = caps.some((c) => c.requiresConnection);
    if (!needs) return 'available';
    // Mock etc. require explicit connect
    return provider.connectSupported ? 'requires_connection' : 'available';
  }

  return 'requires_connection';
}

export function isKnownCapabilityId(id: string): boolean {
  ensureMarketplaceRegistry();
  return capabilities.has(id);
}
