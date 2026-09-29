/**
 * Capability execution pipeline — registry only, never model-invented providers.
 */

import {
  createJob,
  findJobByIdempotency,
  getActiveConnection,
  updateJob,
  writeAudit,
} from './persist';
import { hasAllPermissions, missingPermissions } from './permissions';
import { containsCredentialLike, validateAgainstJsonSchema } from './schemas';
import { getCapability, getProvider, requireCapability } from './registry';
import type { ExecuteContext, ExecuteOutcome, MarketplaceJob } from './types';

async function runJob(
  job: MarketplaceJob,
  ctx: ExecuteContext,
): Promise<MarketplaceJob> {
  const started = Date.now();
  await updateJob(ctx.db, job.id, {
    status: 'RUNNING',
    startedAt: new Date().toISOString(),
    attempt: job.attempt + 1,
    progress: 10,
  });

  try {
    const provider = getProvider(job.providerId);
    if (!provider) throw new Error(`Unknown provider: ${job.providerId}`);
    const output = await provider.execute(job.capabilityId, job.input, ctx);
    const done = await updateJob(ctx.db, job.id, {
      status: 'COMPLETED',
      progress: 100,
      output,
      completedAt: new Date().toISOString(),
    });
    await writeAudit(ctx.db, {
      sessionId: ctx.sessionId,
      userId: ctx.userId,
      providerId: job.providerId,
      capabilityId: job.capabilityId,
      missionId: ctx.missionId,
      taskId: ctx.taskId,
      jobId: job.id,
      status: 'COMPLETED',
      durationMs: Date.now() - started,
      approval: ctx.approved ? 'granted' : 'none',
      resultMeta: { keys: Object.keys(output || {}) },
    });
    return done!;
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Execution failed.';
    const failed = await updateJob(ctx.db, job.id, {
      status: 'FAILED',
      errorMessage: msg.slice(0, 400),
      completedAt: new Date().toISOString(),
    });
    await writeAudit(ctx.db, {
      sessionId: ctx.sessionId,
      userId: ctx.userId,
      providerId: job.providerId,
      capabilityId: job.capabilityId,
      missionId: ctx.missionId,
      taskId: ctx.taskId,
      jobId: job.id,
      status: 'FAILED',
      durationMs: Date.now() - started,
      approval: ctx.approved ? 'granted' : 'none',
      resultMeta: { error: msg.slice(0, 200) },
    });
    return failed!;
  }
}

export async function executeCapability(
  capabilityId: string,
  input: Record<string, unknown>,
  ctx: ExecuteContext,
): Promise<ExecuteOutcome> {
  const started = Date.now();

  if (!capabilityId || typeof capabilityId !== 'string') {
    return { ok: false, error: 'capabilityId is required.', code: 'unknown_capability' };
  }

  const capability = getCapability(capabilityId);
  if (!capability || !capability.enabled) {
    return {
      ok: false,
      error: `Unknown or disabled capability: ${capabilityId}`,
      code: 'unknown_capability',
    };
  }

  const provider = getProvider(capability.providerId);
  if (!provider || provider.definition.catalogStatus === 'disabled') {
    return {
      ok: false,
      error: `Provider unavailable for ${capabilityId}`,
      code: 'provider_disabled',
    };
  }

  if (containsCredentialLike(input)) {
    const audit = await writeAudit(ctx.db, {
      sessionId: ctx.sessionId,
      userId: ctx.userId,
      providerId: capability.providerId,
      capabilityId,
      missionId: ctx.missionId,
      taskId: ctx.taskId,
      status: 'CREDENTIAL_REJECTED',
      durationMs: Date.now() - started,
      approval: 'none',
      resultMeta: { reason: 'credential_like_input' },
    });
    return {
      ok: false,
      error: 'Input appears to contain credentials — rejected.',
      code: 'credential_rejected',
      auditId: audit.id,
    };
  }

  const validated = validateAgainstJsonSchema(capability.inputSchema, input);
  if (!validated.ok) {
    return { ok: false, error: validated.error, code: 'invalid_input' };
  }

  if (!hasAllPermissions(ctx.grantedPermissions, capability.permissions)) {
    const missing = missingPermissions(ctx.grantedPermissions, capability.permissions);
    const audit = await writeAudit(ctx.db, {
      sessionId: ctx.sessionId,
      userId: ctx.userId,
      providerId: capability.providerId,
      capabilityId,
      missionId: ctx.missionId,
      taskId: ctx.taskId,
      status: 'PERMISSION_DENIED',
      durationMs: Date.now() - started,
      approval: 'none',
      resultMeta: { missing },
    });
    return {
      ok: false,
      error: `Permission denied. Missing: ${missing.join(', ')}`,
      code: 'permission_denied',
      auditId: audit.id,
    };
  }

  if (capability.requiresApproval && !ctx.approved) {
    const job = await createJob(ctx.db, {
      capabilityId,
      providerId: capability.providerId,
      missionId: ctx.missionId,
      taskId: ctx.taskId,
      status: 'REQUIRES_APPROVAL',
      input: validated.data,
      maxAttempts: 2,
      idempotencyKey: ctx.idempotencyKey,
      createdBy: ctx.userId || 'operator',
    });
    const audit = await writeAudit(ctx.db, {
      sessionId: ctx.sessionId,
      userId: ctx.userId,
      providerId: capability.providerId,
      capabilityId,
      missionId: ctx.missionId,
      taskId: ctx.taskId,
      jobId: job.id,
      status: 'REQUIRES_APPROVAL',
      durationMs: Date.now() - started,
      approval: 'required',
      resultMeta: {},
    });
    return {
      ok: false,
      error: 'This capability requires explicit approval before execution.',
      code: 'approval_required',
      auditId: audit.id,
    };
  }

  if (capability.requiresConnection) {
    const conn = await getActiveConnection(ctx.db, capability.providerId);
    if (!conn) {
      return {
        ok: false,
        error: 'Provider requires connection.',
        code: 'requires_connection',
      };
    }
  }

  if (provider.definition.catalogStatus === 'coming_soon') {
    return {
      ok: false,
      error: 'Provider requires connection.',
      code: 'not_implemented',
    };
  }

  if (ctx.idempotencyKey) {
    const existing = await findJobByIdempotency(ctx.db, ctx.idempotencyKey);
    if (existing?.status === 'COMPLETED') {
      return {
        ok: true,
        sync: true,
        capabilityId,
        providerId: capability.providerId,
        output: existing.output,
        jobId: existing.id,
        auditId: 'idempotent',
      };
    }
  }

  const wantAsync =
    ctx.async === true ||
    (ctx.async !== false &&
      capability.supportsAsync &&
      (capability.executionMode === 'async' || capability.executionMode === 'either'));

  const job = await createJob(ctx.db, {
    capabilityId,
    providerId: capability.providerId,
    missionId: ctx.missionId,
    taskId: ctx.taskId,
    status: 'QUEUED',
    input: validated.data,
    maxAttempts: 2,
    idempotencyKey: ctx.idempotencyKey,
    createdBy: ctx.userId || 'operator',
  });

  if (wantAsync && ctx.async !== false && capability.supportsAsync && ctx.async === true) {
    // Queue-style: return job; caller / Mission Control drains.
    // For local E2E convenience, also process immediately when no separate worker.
    const finished = await runJob(job, ctx);
    if (finished.status === 'FAILED') {
      return {
        ok: false,
        error: finished.errorMessage || 'Job failed.',
        code: 'execution_failed',
      };
    }
    return {
      ok: true,
      sync: false,
      capabilityId,
      providerId: capability.providerId,
      job: finished,
      auditId: 'job',
    };
  }

  const finished = await runJob(job, ctx);
  if (finished.status === 'FAILED') {
    return {
      ok: false,
      error: finished.errorMessage || 'Execution failed.',
      code: 'execution_failed',
    };
  }

  if (wantAsync || capability.executionMode === 'async') {
    return {
      ok: true,
      sync: false,
      capabilityId,
      providerId: capability.providerId,
      job: finished,
      auditId: 'job',
    };
  }

  return {
    ok: true,
    sync: true,
    capabilityId,
    providerId: capability.providerId,
    output: finished.output,
    jobId: finished.id,
    auditId: 'job',
  };
}

/** Mission Control bridge — execute capabilityId from task.input. */
export async function executeCapabilityForMissionTask(
  task: {
    id: string;
    missionId: string;
    input: Record<string, unknown>;
    assignedBot: string;
  },
  ctx: Omit<ExecuteContext, 'missionId' | 'taskId'>,
): Promise<ExecuteOutcome> {
  const capabilityId =
    typeof task.input.capabilityId === 'string' ? task.input.capabilityId : '';
  if (!capabilityId) {
    return { ok: false, error: 'Task input missing capabilityId.', code: 'unknown_capability' };
  }
  // Verify capability exists before any work
  try {
    requireCapability(capabilityId);
  } catch {
    return {
      ok: false,
      error: `Unknown capability: ${capabilityId}`,
      code: 'unknown_capability',
    };
  }
  const providerId =
    typeof task.input.providerId === 'string' ? task.input.providerId : undefined;
  const cap = requireCapability(capabilityId);
  if (providerId && providerId !== cap.providerId) {
    return {
      ok: false,
      error: `Capability ${capabilityId} belongs to ${cap.providerId}, not ${providerId}.`,
      code: 'unknown_capability',
    };
  }
  const { capabilityId: _c, providerId: _p, ...rest } = task.input;
  return executeCapability(capabilityId, rest as Record<string, unknown>, {
    ...ctx,
    missionId: task.missionId,
    taskId: task.id,
  });
}

/** Process a queued job (retry-aware). */
export async function processMarketplaceJob(
  jobId: string,
  ctx: ExecuteContext,
): Promise<MarketplaceJob | null> {
  const { getJob } = await import('./persist');
  const job = await getJob(ctx.db, jobId);
  if (!job) return null;
  if (job.status === 'COMPLETED' || job.status === 'CANCELLED') return job;
  if (job.attempt >= job.maxAttempts && job.status === 'FAILED') return job;
  return runJob(job, ctx);
}
