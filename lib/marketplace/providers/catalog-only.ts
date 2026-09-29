/**
 * Catalog-only / coming-soon provider adapter.
 * Declares capabilities but refuses execution until a real connector is wired.
 */

import type {
  CapabilityDefinition,
  IntegrationProvider,
  ProviderDefinition,
  ProviderHealth,
} from '../types';
import { CATALOG_CAPABILITIES, getCatalogProvider } from '../catalog';
import { deleteConnection, getActiveConnection, upsertConnection } from '../persist';

export function createCatalogOnlyProvider(providerId: string): IntegrationProvider | null {
  const definition = getCatalogProvider(providerId);
  if (!definition) return null;
  const capabilities = CATALOG_CAPABILITIES.filter((c) => c.providerId === providerId);

  return {
    id: providerId,
    definition,
    capabilities,
    async connect(db, opts) {
      if (!definition.connectSupported) {
        throw new Error(`Provider "${providerId}" does not support connection yet.`);
      }
      // Gmail / Calendar: metadata-only row; real tokens stay in connector_accounts.
      if (providerId === 'gmail' || providerId === 'google_calendar') {
        return upsertConnection(db, {
          providerId,
          accountId: opts?.accountId || 'linked',
          status: 'pending',
          scopes: [],
          metadata: {
            note: 'Use existing /api/connectors OAuth flow. Marketplace row is metadata only.',
            ...(opts?.metadata || {}),
          },
        });
      }
      if (providerId === 'mcp_generic') {
        return upsertConnection(db, {
          providerId,
          accountId: opts?.accountId || 'mcp-default',
          status: 'active',
          scopes: ['mcp'],
          metadata: { transport: 'mcp', ...(opts?.metadata || {}) },
        });
      }
      throw new Error(`Provider "${providerId}" does not support connection yet.`);
    },
    async disconnect(db, connectionId) {
      await deleteConnection(db, connectionId);
    },
    async health(db): Promise<ProviderHealth> {
      const conn = await getActiveConnection(db, providerId);
      if (definition.catalogStatus === 'coming_soon') {
        return { ok: false, status: 'coming_soon', detail: 'Connector not implemented.' };
      }
      if (definition.auth !== 'none' && definition.auth !== 'internal' && !conn) {
        return { ok: false, status: 'requires_connection', detail: 'Provider requires connection.' };
      }
      return {
        ok: true,
        status: conn ? 'connected' : 'available',
        detail: conn ? 'Connection metadata present.' : 'Catalog available; no live connector.',
      };
    },
    async execute() {
      throw new Error('Provider requires connection.');
    },
  };
}

export function wrapDefinition(
  definition: ProviderDefinition,
  capabilities: CapabilityDefinition[],
): IntegrationProvider {
  return createCatalogOnlyProvider(definition.id) ?? {
    id: definition.id,
    definition,
    capabilities,
    async execute() {
      throw new Error('Provider requires connection.');
    },
  };
}
