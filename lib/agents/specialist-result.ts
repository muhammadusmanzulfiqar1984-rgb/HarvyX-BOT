import {
  categorizeError,
  humanMessageForCategory,
  logSafeError,
  type ErrorCategory,
} from '../observability';

/** Nested-agent specialists reachable from the Manager via a delegate tool. */
export type SpecialistAgentName = 'OPS' | 'Analyst' | 'Social' | 'Scrape';

/** Structured result returned from Manager → specialist tools. */
export type SpecialistResult = {
  ok: boolean;
  agent: SpecialistAgentName;
  text?: string;
  error?: {
    category: ErrorCategory;
    message: string;
  };
};

export function specialistOk(agent: SpecialistAgentName, text: string): SpecialistResult {
  return { ok: true, agent, text: text || '(empty specialist response)' };
}

export function specialistFail(
  agent: SpecialistAgentName,
  err: unknown,
  operation: string,
  provider?: string,
): SpecialistResult {
  const category = categorizeError(err);
  const message = humanMessageForCategory(category);
  logSafeError('specialist_failed', err, {
    agent,
    operation,
    provider,
    category,
  });
  return {
    ok: false,
    agent,
    error: { category, message },
  };
}

/** Compact string Manager can relay without dumping internals. */
export function formatSpecialistResult(result: SpecialistResult): string {
  if (result.ok) return result.text ?? '';
  return `[${result.agent} failed · ${result.error?.category ?? 'unknown'}] ${result.error?.message ?? 'Operation failed.'}`;
}
