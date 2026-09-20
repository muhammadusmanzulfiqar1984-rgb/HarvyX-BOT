export type ErrorCategory =
  | 'auth'
  | 'forbidden'
  | 'not_found'
  | 'rate_limit'
  | 'timeout'
  | 'network'
  | 'provider'
  | 'harvyx'
  | 'validation'
  | 'persistence'
  | 'unknown';

export type SafeLogFields = {
  agent?: string;
  operation?: string;
  provider?: string;
  category?: ErrorCategory;
  elapsedMs?: number;
  status?: number;
  message?: string;
};

const SECRET_PATTERN =
  /(api[_-]?key|authorization|bearer\s+[a-z0-9._-]+|sk-[a-z0-9]+|hx_[a-z0-9]+)/gi;

/** Strip credential-like substrings from log/error text. */
export function sanitizeForLog(value: unknown, maxLen = 240): string {
  let text: string;
  if (value instanceof Error) text = value.message;
  else if (typeof value === 'string') text = value;
  else {
    try {
      text = JSON.stringify(value);
    } catch {
      text = String(value);
    }
  }
  return text.replace(SECRET_PATTERN, '[redacted]').slice(0, maxLen);
}

export function logSafe(event: string, fields: SafeLogFields = {}): void {
  const payload: Record<string, unknown> = { event };
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined) continue;
    payload[k] = typeof v === 'string' ? sanitizeForLog(v) : v;
  }
  console.info('[harvyx-bot]', JSON.stringify(payload));
}

export function logSafeError(event: string, err: unknown, fields: SafeLogFields = {}): void {
  logSafe(event, {
    ...fields,
    message: sanitizeForLog(err),
    category: fields.category ?? categorizeError(err),
  });
}

export function categorizeError(err: unknown): ErrorCategory {
  const msg = sanitizeForLog(err).toLowerCase();
  if (msg.includes('401') || msg.includes('unauthorized')) return 'auth';
  if (msg.includes('403') || msg.includes('forbidden')) return 'forbidden';
  if (msg.includes('404') || msg.includes('not found')) return 'not_found';
  if (msg.includes('429') || msg.includes('rate')) return 'rate_limit';
  if (msg.includes('timeout') || msg.includes('aborted') || msg.includes('abort')) return 'timeout';
  if (msg.includes('network') || msg.includes('fetch failed') || msg.includes('econn')) return 'network';
  if (msg.includes('harvyx')) return 'harvyx';
  if (
    msg.includes('groq') ||
    msg.includes('nvidia') ||
    msg.includes('nebius') ||
    msg.includes('cloudflare') ||
    msg.includes('pareto') ||
    msg.includes('provider')
  )
    return 'provider';
  if (msg.includes('invalid') || msg.includes('validation')) return 'validation';
  return 'unknown';
}

export function humanMessageForCategory(category: ErrorCategory): string {
  switch (category) {
    case 'auth':
      return 'HarvYX authentication failed. Check the server API key configuration.';
    case 'forbidden':
      return 'HarvYX denied this operation.';
    case 'not_found':
      return 'The requested HarvYX resource was not found.';
    case 'rate_limit':
      return 'HarvYX or the model provider is rate-limiting requests. Try again shortly.';
    case 'timeout':
      return 'The operation timed out. Try a smaller request or retry.';
    case 'network':
      return 'A network error occurred while reaching an upstream service.';
    case 'provider':
      return 'The AI model provider failed. Try again in a moment.';
    case 'harvyx':
      return 'HarvYX returned an error. The operation could not be completed.';
    case 'validation':
      return 'Invalid input for this operation.';
    case 'persistence':
      return 'Conversation could not be saved. Your reply may still be visible this session.';
    default:
      return 'Something went wrong. Please try again.';
  }
}
