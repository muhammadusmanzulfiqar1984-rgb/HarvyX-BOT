import { requireOperator } from '@/lib/api/shell';
import { OPERATOR_DEFAULT_PERMISSIONS } from './permissions';
import type { ExecuteContext, MarketplacePermission } from './types';
import { seedMarketplaceCatalogToD1 } from './persist';
import { ensureMarketplaceRegistry } from './registry';

export function publicProvider(p: {
  id: string;
  name: string;
  category: string;
  description: string;
  icon: string;
  mode: string;
  catalogStatus: string;
  auth: string;
  connectSupported: boolean;
  tags?: string[];
}) {
  return {
    id: p.id,
    name: p.name,
    category: p.category,
    description: p.description,
    icon: p.icon,
    mode: p.mode,
    catalogStatus: p.catalogStatus,
    auth: p.auth,
    connectSupported: p.connectSupported,
    tags: p.tags ?? [],
  };
}

export function publicCapability(c: {
  id: string;
  providerId: string;
  name: string;
  description: string;
  category: string;
  version: string;
  permissions: string[];
  executionMode: string;
  requiresConnection: boolean;
  supportsAsync: boolean;
  supportsWebhook: boolean;
  requiresApproval: boolean;
  enabled: boolean;
  inputSchema: unknown;
  outputSchema: unknown;
}) {
  return {
    id: c.id,
    providerId: c.providerId,
    name: c.name,
    description: c.description,
    category: c.category,
    version: c.version,
    permissions: c.permissions,
    executionMode: c.executionMode,
    requiresConnection: c.requiresConnection,
    supportsAsync: c.supportsAsync,
    supportsWebhook: c.supportsWebhook,
    requiresApproval: c.requiresApproval,
    enabled: c.enabled,
    inputSchema: c.inputSchema,
    outputSchema: c.outputSchema,
  };
}

/** Never include tokens/secrets. */
export function publicConnection(c: {
  id: string;
  providerId: string;
  accountId: string;
  status: string;
  scopes: string[];
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  lastHealthCheck?: string | null;
}) {
  return {
    id: c.id,
    providerId: c.providerId,
    accountId: c.accountId,
    status: c.status,
    scopes: c.scopes,
    metadata: c.metadata,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    lastHealthCheck: c.lastHealthCheck ?? null,
  };
}

export async function marketplaceAuth(request: Request): Promise<
  | { ctx: ExecuteContext; db: D1Database; error?: undefined }
  | { ctx?: undefined; db?: undefined; error: Response }
> {
  ensureMarketplaceRegistry();
  const auth = await requireOperator(request);
  if (auth.error) return { error: auth.error };
  await seedMarketplaceCatalogToD1(auth.db);
  const ctx: ExecuteContext = {
    db: auth.db,
    sessionId: auth.session.id,
    userId: auth.session.account?.email || auth.session.account_id || 'operator',
    grantedPermissions: [...OPERATOR_DEFAULT_PERMISSIONS] as MarketplacePermission[],
  };
  return { ctx, db: auth.db };
}
