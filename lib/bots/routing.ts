/**
 * MIAN Intent Router — classifies a user message to a specialist bot slug.
 *
 * Rule-based first pass. MIAN's LLM can override at runtime; this is the
 * deterministic layer used for testing, tooling, and fast-path routing.
 *
 * Returns null when MIAN should answer directly (no delegation needed).
 */

export type DelegateSlug = 'ops' | 'analyst' | 'social' | 'scrape' | 'erp';

export type RoutingResult = {
  /** Specialist to delegate to. null = MIAN answers directly. */
  delegate: DelegateSlug | null;
  /** Human-readable reason for the routing decision. */
  reason: string;
  /** 0–1 confidence in the classification. */
  confidence: number;
};

// ── Keyword tables ────────────────────────────────────────────────────────────

const OPS_KEYWORDS = [
  // CRM core
  'lead', 'leads', 'contact', 'contacts', 'deal', 'deals', 'pipeline',
  'crm', 'segment', 'campaign', 'campaigns', 'outreach', 'follow up',
  'follow-up', 'prospect', 'prospects', 'customer', 'customers', 'client',
  'clients', 'account', 'accounts', 'opportunity', 'opportunities',
  'in harvyx', 'search harvyx', 'harvyx crm', 'enrich', 'enrichment',
  // Actions
  'add contact', 'update contact', 'find contact', 'search contact',
  'add lead', 'close deal', 'qualify',
];

const ANALYST_KEYWORDS = [
  // Deep thinking
  'analyze', 'analyse', 'analysis', 'research', 'report', 'forecast',
  'predict', 'trend', 'insights', 'insight', 'recommend', 'recommendation',
  'strategy', 'strategic', 'compare', 'comparison', 'evaluate', 'evaluate',
  'review', 'summarize', 'summarise', 'summary', 'explain', 'why did',
  'variance', 'anomaly', 'anomalies', 'risk', 'risks',
  // Finance
  'revenue', 'profit', 'margin', 'cash flow', 'p&l', 'budget', 'forecast',
  'kpi', 'metric', 'metrics', 'performance',
  // Writing / drafting
  'draft', 'write a report', 'write a brief', 'memo', 'proposal', 'pitch',
  'business case', 'due diligence',
];

const SOCIAL_KEYWORDS = [
  'linkedin', 'instagram', 'twitter', 'tiktok', 'facebook', 'whatsapp',
  'social media', 'post', 'caption', 'hashtag', 'hashtags', 'engagement',
  'followers', 'content calendar', 'viral', 'reel', 'story', 'stories',
  'tweet', 'thread', 'platform', 'audience', 'influencer',
];

const ERP_KEYWORDS = [
  // Harvics OS modules
  'inventory', 'stock', 'warehouse', 'purchase order', 'invoice',
  'payroll', 'hr report', 'employee', 'logistics', 'shipment', 'freight',
  'order', 'orders', 'finance report', 'budget', 'gl', 'general ledger',
  'procurement', 'supplier', 'territory', 'asset', 'maintenance',
  'harvics os', 'erp', 'module', 'band',
];

const SCRAPE_KEYWORDS = [
  'scrape', 'crawl', 'fetch', 'download', 'extract from',
  'get the content', 'read the page', 'check this url', 'check this link',
  'visit', 'browse', 'http://', 'https://', '.com/', '.org/', '.net/',
  'website', 'webpage', 'web page', 'url',
];

// ── Scoring ───────────────────────────────────────────────────────────────────

type ScoredCandidate = { slug: DelegateSlug; score: number; keywords: string[] };

function score(text: string, keywords: string[]): { score: number; keywords: string[] } {
  const lower = text.toLowerCase();
  const matched: string[] = [];
  for (const kw of keywords) {
    if (lower.includes(kw)) matched.push(kw);
  }
  return { score: matched.length, keywords: matched };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Classify a user message and return a routing decision.
 *
 * @param message - Raw user message text.
 * @param options.threshold - Minimum score to trigger delegation (default 1).
 */
export function classifyIntent(
  message: string,
  options: { threshold?: number } = {},
): RoutingResult {
  const threshold = options.threshold ?? 1;

  const candidates: ScoredCandidate[] = [
    { slug: 'ops',     ...score(message, OPS_KEYWORDS) },
    { slug: 'analyst', ...score(message, ANALYST_KEYWORDS) },
    { slug: 'social',  ...score(message, SOCIAL_KEYWORDS) },
    { slug: 'scrape',  ...score(message, SCRAPE_KEYWORDS) },
    { slug: 'erp',     ...score(message, ERP_KEYWORDS) },
  ];

  candidates.sort((a, b) => b.score - a.score);
  const top = candidates[0];

  if (top.score < threshold) {
    return {
      delegate: null,
      reason: 'No strong domain signal — MIAN answers directly.',
      confidence: 0,
    };
  }

  // Tie-break: if two candidates are within 1 point, prefer by priority
  // ops > analyst > social > scrape (ops is the most common action in HARVYX)
  const PRIORITY: DelegateSlug[] = ['ops', 'erp', 'analyst', 'social', 'scrape'];
  const tied = candidates.filter((c) => c.score === top.score);
  const winner = tied.sort(
    (a, b) => PRIORITY.indexOf(a.slug) - PRIORITY.indexOf(b.slug),
  )[0];

  const totalSignals = candidates.reduce((s, c) => s + c.score, 0);
  const confidence = totalSignals > 0 ? winner.score / totalSignals : 0;

  return {
    delegate: winner.slug,
    reason: `Matched [${winner.keywords.join(', ')}] → delegate to ${winner.slug}`,
    confidence: Math.min(confidence, 1),
  };
}

/**
 * Convenience: returns just the delegate slug (or null).
 */
export function routeMessage(message: string): DelegateSlug | null {
  return classifyIntent(message).delegate;
}
