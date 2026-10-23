import type {
  CapabilityDefinition,
  ExecuteContext,
  IntegrationProvider,
  MarketplaceConnection,
  ProviderDefinition,
  ProviderHealth,
} from '../types';
import { getCatalogCapability, getCatalogProvider } from '../catalog';
import { upsertConnection, deleteConnection, getActiveConnection } from '../persist';
import { validatePresentationCreate } from '../schemas';

export function createMockProvider(): IntegrationProvider {
  const definition = getCatalogProvider('mock') as ProviderDefinition;
  const capabilities = [
    getCatalogCapability('mock.presentation.create'),
    getCatalogCapability('mock.health.ping'),
  ].filter(Boolean) as CapabilityDefinition[];

  return {
    id: 'mock',
    definition,
    capabilities,
    async connect(db, opts) {
      return upsertConnection(db, {
        providerId: 'mock',
        accountId: opts?.accountId || 'local-mock',
        status: 'active',
        scopes: ['internal.mock'],
        metadata: { kind: 'mock', ...(opts?.metadata || {}) },
      });
    },
    async disconnect(db, connectionId) {
      await deleteConnection(db, connectionId);
    },
    async health(db): Promise<ProviderHealth> {
      const conn = await getActiveConnection(db, 'mock');
      return {
        ok: true,
        status: conn ? 'connected' : 'available',
        detail: conn ? 'Mock provider ready.' : 'Mock provider idle (not connected).',
      };
    },
    async execute(capabilityId, input, ctx: ExecuteContext) {
      if (capabilityId === 'mock.health.ping') {
        return { ok: true, pong: true, at: new Date().toISOString() };
      }
      if (capabilityId === 'mock.presentation.create') {
        const parsed = validatePresentationCreate(input);
        if (!parsed.ok) throw new Error(parsed.error);
        const conn = await getActiveConnection(ctx.db, 'mock');
        if (!conn) throw new Error('Provider requires connection.');
        const fileId = `mock_pptx_${crypto.randomUUID().slice(0, 8)}`;
        return {
          fileId,
          fileName: `${parsed.data.title.replace(/[^\w.-]+/g, '_').slice(0, 40)}.mock.json`,
          mimeType: 'application/vnd.harvyx.mock-presentation+json',
          reference: `memory://mock/${fileId}`,
          slideCount: parsed.data.slides.length,
          theme: parsed.data.theme ?? 'default',
          provider: 'mock',
          status: 'created',
        };
      }
      throw new Error(`Unknown mock capability: ${capabilityId}`);
    },
  };
}

export type { MarketplaceConnection };
