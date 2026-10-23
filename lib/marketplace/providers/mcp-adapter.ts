/**
 * Generic MCP provider adapter — provider-neutral.
 * Does not hard-code a single MCP server into Manager.
 * Actual MCP tool calls require an active marketplace connection with server metadata.
 */

import type { IntegrationProvider, ProviderHealth } from '../types';
import { CATALOG_CAPABILITIES, getCatalogProvider } from '../catalog';
import { deleteConnection, getActiveConnection, upsertConnection } from '../persist';

export type McpConnectionMeta = {
  transport: 'mcp';
  /** Logical server id — not a secret. */
  serverId?: string;
  /** Allowlisted tool names on that server. */
  allowedTools?: string[];
};

export function createMcpAdapterProvider(): IntegrationProvider {
  const definition = getCatalogProvider('mcp_generic')!;
  const capabilities = CATALOG_CAPABILITIES.filter((c) => c.providerId === 'mcp_generic');

  return {
    id: 'mcp_generic',
    definition,
    capabilities,
    async connect(db, opts) {
      const meta = (opts?.metadata || {}) as McpConnectionMeta;
      if (!meta.serverId || typeof meta.serverId !== 'string') {
        throw new Error('MCP connect requires metadata.serverId (non-secret).');
      }
      return upsertConnection(db, {
        providerId: 'mcp_generic',
        accountId: opts?.accountId || meta.serverId,
        status: 'active',
        scopes: ['mcp'],
        metadata: {
          transport: 'mcp',
          serverId: meta.serverId,
          allowedTools: Array.isArray(meta.allowedTools) ? meta.allowedTools : [],
        },
      });
    },
    async disconnect(db, connectionId) {
      await deleteConnection(db, connectionId);
    },
    async health(db): Promise<ProviderHealth> {
      const conn = await getActiveConnection(db, 'mcp_generic');
      return {
        ok: Boolean(conn),
        status: conn ? 'connected' : 'requires_connection',
        detail: conn
          ? `MCP server "${(conn.metadata as McpConnectionMeta).serverId}" registered.`
          : 'No MCP server connected.',
      };
    },
    async execute(capabilityId, input, ctx) {
      if (capabilityId !== 'mcp_generic.invoke') {
        throw new Error(`Unknown MCP capability: ${capabilityId}`);
      }
      const conn = await getActiveConnection(ctx.db, 'mcp_generic');
      if (!conn) throw new Error('Provider requires connection.');
      const meta = conn.metadata as McpConnectionMeta;
      const toolName = typeof input.tool === 'string' ? input.tool : String(input.title || '');
      if (!toolName) throw new Error('MCP invoke requires tool or title.');
      const allowed = meta.allowedTools ?? [];
      if (allowed.length > 0 && !allowed.includes(toolName)) {
        throw new Error(`MCP tool "${toolName}" is not allowlisted for this connection.`);
      }
      // Safe stub — no arbitrary network/shell. Real MCP bridge plugs in here later.
      return {
        status: 'accepted',
        transport: 'mcp',
        serverId: meta.serverId,
        tool: toolName,
        note: 'MCP adapter registered invocation; live MCP bridge not configured in this environment.',
      };
    },
  };
}
