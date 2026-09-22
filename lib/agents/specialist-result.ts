import {
  categorizeError,
  humanMessageForCategory,
  logSafeError,
  type ErrorCategory,
} from '../observability';

/** Structured result returned from Manager → specialist tools (OPS / Analyst / Social). */
export type SpecialistResult = {
  ok: boolean;
  agent: 'OPS' | 'Analyst' | 'Social';
  text?: string;
  error?: {
    category: ErrorCategory;
    message: string;
  };
};

export function specialistOk(agent: 'OPS' | 'Analyst' | 'Social', text: string): SpecialistResult {
  return { ok: true, agent, text: text || '(empty specialist response)' };
}

export function specialistFail(
  agent: 'OPS' | 'Analyst' | 'Social',
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
