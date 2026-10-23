/** Marketplace / Integration Gateway — shared types. */

export type MarketplaceCategoryId =
  | 'presentations'
  | 'documents'
  | 'spreadsheets'
  | 'design'
  | 'research'
  | 'communication'
  | 'meetings'
  | 'crm'
  | 'marketing'
  | 'development'
  | 'data'
  | 'storage'
  | 'automation'
  | 'ai'
  | 'media'
  | 'commerce'
  | 'finance'
  | 'web'
  | 'harvyx'
  | 'internal';

export type ProviderMode =
  | 'NATIVE_API'
  | 'MCP'
  | 'WEB'
  | 'LOCAL'
  | 'INTERNAL'
  | 'WEBHOOK'
  | 'CATALOG';

export type CatalogStatus = 'available' | 'coming_soon' | 'disabled';

export type AuthType = 'none' | 'oauth' | 'api_key' | 'mcp' | 'internal';

export type ConnectionStatus = 'active' | 'expired' | 'error' | 'revoked' | 'pending';

export type ExecutionMode = 'sync' | 'async' | 'either';

export type JobStatus =
  | 'QUEUED'
  | 'RUNNING'
  | 'WAITING'
  | 'REQUIRES_APPROVAL'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

/** Effective UI connection label — never invent "connected" without a row. */
export type EffectiveConnectionLabel =
  | 'connected'
  | 'requires_connection'
  | 'available'
  | 'coming_soon'
  | 'disabled';

export type MarketplacePermission =
  | 'research.read'
  | 'files.read'
  | 'files.write'
  | 'email.read'
  | 'email.send'
  | 'calendar.read'
  | 'calendar.write'
  | 'crm.read'
  | 'crm.write'
  | 'social.publish'
  | 'github.write'
  | 'github.read'
  | 'content.write'
  | 'media.generate'
  | 'automation.execute'
  | 'webhooks.receive'
  | 'ai.invoke'
  | 'storage.read'
  | 'storage.write'
  | 'internal.mock';

export interface JsonSchemaLike {
  type?: string;
  properties?: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
  [key: string]: unknown;
}

export interface CapabilityDefinition {
  id: string;
  providerId: string;
  name: string;
  description: string;
  category: MarketplaceCategoryId;
  version: string;
  inputSchema: JsonSchemaLike;
  outputSchema: JsonSchemaLike;
  permissions: MarketplacePermission[];
  executionMode: ExecutionMode;
  requiresConnection: boolean;
  supportsAsync: boolean;
  supportsWebhook: boolean;
  requiresApproval: boolean;
  enabled: boolean;
}

export interface ProviderDefinition {
  id: string;
  name: string;
  category: MarketplaceCategoryId;
  description: string;
  icon: string;
  mode: ProviderMode;
  catalogStatus: CatalogStatus;
  auth: AuthType;
  /** True when connect()/OAuth/API-key flow is implemented (not fake). */
  connectSupported: boolean;
  tags?: string[];
}

export interface MarketplaceConnection {
  id: string;
  providerId: string;
  accountId: string;
  status: ConnectionStatus;
  scopes: string[];
  metadata: Record<string, unknown>;
  connectorAccountId?: string | null;
  createdAt: string;
  updatedAt: string;
  lastHealthCheck?: string | null;
}

export interface MarketplaceJob {
  id: string;
  capabilityId: string;
  providerId: string;
  missionId?: string | null;
  taskId?: string | null;
  status: JobStatus;
  progress: number;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  errorMessage: string;
  attempt: number;
  maxAttempts: number;
  idempotencyKey?: string | null;
  createdBy: string;
  createdAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
  updatedAt: string;
}

export interface MarketplaceAuditEvent {
  id: string;
  sessionId?: string | null;
  userId?: string | null;
  providerId: string;
  capabilityId: string;
  missionId?: string | null;
  taskId?: string | null;
  jobId?: string | null;
  status: string;
  durationMs: number;
  approval: string;
  resultMeta: Record<string, unknown>;
  createdAt: string;
}

export interface MarketplaceWebhook {
  id: string;
  providerId: string;
  capabilityId?: string | null;
  urlPath: string;
  secretRef: string;
  status: 'active' | 'paused' | 'revoked';
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CapabilityDiscoveryHit {
  capabilityId: string;
  name: string;
  description: string;
  providerId: string;
  providerName: string;
  category: MarketplaceCategoryId;
  permissions: MarketplacePermission[];
  executionMode: ExecutionMode;
  requiresConnection: boolean;
  connectionLabel: EffectiveConnectionLabel;
  requiresApproval: boolean;
}

export interface ExecuteContext {
  db?: D1Database;
  sessionId?: string;
  userId?: string;
  missionId?: string;
  taskId?: string;
  /** Session/user granted permissions (operator defaults to broad internal set). */
  grantedPermissions: MarketplacePermission[];
  /** Explicit approval already obtained for gated actions. */
  approved?: boolean;
  idempotencyKey?: string;
  async?: boolean;
}

export type ExecuteOutcome =
  | {
      ok: true;
      sync: true;
      capabilityId: string;
      providerId: string;
      output: Record<string, unknown>;
      jobId?: string;
      auditId: string;
    }
  | {
      ok: true;
      sync: false;
      capabilityId: string;
      providerId: string;
      job: MarketplaceJob;
      auditId: string;
    }
  | {
      ok: false;
      error: string;
      code:
        | 'unknown_capability'
        | 'provider_disabled'
        | 'requires_connection'
        | 'permission_denied'
        | 'approval_required'
        | 'invalid_input'
        | 'credential_rejected'
        | 'execution_failed'
        | 'not_implemented';
      auditId?: string;
    };

export interface ProviderHealth {
  ok: boolean;
  status: string;
  detail?: string;
}

export interface IntegrationProvider {
  id: string;
  definition: ProviderDefinition;
  capabilities: CapabilityDefinition[];
  connect?(
    db: D1Database | undefined,
    opts?: { accountId?: string; metadata?: Record<string, unknown> },
  ): Promise<MarketplaceConnection>;
  disconnect?(db: D1Database | undefined, connectionId: string): Promise<void>;
  health?(
    db: D1Database | undefined,
    connection?: MarketplaceConnection | null,
  ): Promise<ProviderHealth>;
  execute(
    capabilityId: string,
    input: Record<string, unknown>,
    ctx: ExecuteContext,
  ): Promise<Record<string, unknown>>;
}
