import { marketplaceAuth } from '@/lib/marketplace/http';
import { listJobs } from '@/lib/marketplace/persist';
import type { JobStatus } from '@/lib/marketplace/types';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const auth = await marketplaceAuth(request);
  if (auth.error) return auth.error;
  const url = new URL(request.url);
  const status = (url.searchParams.get('status') as JobStatus | null) || undefined;
  const missionId = url.searchParams.get('missionId') || undefined;
  const jobs = await listJobs(auth.db, { status, missionId });
  return Response.json({
    jobs: jobs.map((j) => ({
      id: j.id,
      capabilityId: j.capabilityId,
      providerId: j.providerId,
      missionId: j.missionId,
      taskId: j.taskId,
      status: j.status,
      progress: j.progress,
      errorMessage: j.errorMessage,
      attempt: j.attempt,
      maxAttempts: j.maxAttempts,
      createdAt: j.createdAt,
      startedAt: j.startedAt,
      completedAt: j.completedAt,
      // output may contain file refs — never secrets (validated on write)
      output: j.output,
    })),
  });
}
