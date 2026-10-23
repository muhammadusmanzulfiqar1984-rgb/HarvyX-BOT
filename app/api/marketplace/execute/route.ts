import { jsonError } from '@/lib/api/shell';
import { marketplaceAuth } from '@/lib/marketplace/http';
import { executeCapability } from '@/lib/marketplace/execute';
import { ensureMarketplaceRegistry } from '@/lib/marketplace/registry';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const auth = await marketplaceAuth(request);
  if (auth.error) return auth.error;
  ensureMarketplaceRegistry();

  let body: {
    capabilityId?: string;
    input?: Record<string, unknown>;
    async?: boolean;
    approved?: boolean;
    idempotencyKey?: string;
    missionId?: string;
    taskId?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonError('Invalid JSON body.', 400);
  }

  const capabilityId = body.capabilityId?.trim();
  if (!capabilityId) return jsonError('capabilityId is required.', 400);
  if (!body.input || typeof body.input !== 'object' || Array.isArray(body.input)) {
    return jsonError('input object is required.', 400);
  }

  const result = await executeCapability(capabilityId, body.input, {
    ...auth.ctx,
    approved: Boolean(body.approved),
    async: body.async,
    idempotencyKey: body.idempotencyKey,
    missionId: body.missionId,
    taskId: body.taskId,
  });

  if (!result.ok) {
    const status =
      result.code === 'unknown_capability'
        ? 404
        : result.code === 'permission_denied' || result.code === 'approval_required'
          ? 403
          : result.code === 'invalid_input' || result.code === 'credential_rejected'
            ? 400
            : result.code === 'requires_connection' || result.code === 'not_implemented'
              ? 409
              : 500;
    return Response.json(result, { status });
  }

  return Response.json(result);
}
