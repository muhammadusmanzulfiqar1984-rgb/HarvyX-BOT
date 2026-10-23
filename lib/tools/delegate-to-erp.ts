/**
 * Delegate to Harvics OS ERP intelligence endpoints.
 *
 * Connects HARVYX-BOT BRAIN to the BODY (harvics.com backend).
 * Calls /api/intelligence/copilot/chat for general queries and
 * /api/intelligence/insights/:domain for domain-specific live data.
 *
 * Env: HARVICS_API_BASE (default https://www.harvics.com), HARVICS_API_KEY
 */
import { tool } from 'ai';
import { z } from 'zod';

export type ErpToolEnv = {
  HARVICS_API_BASE?: string;
  HARVICS_API_KEY?: string;
};

const ERP_DOMAINS = [
  'orders', 'inventory', 'finance', 'crm', 'hr',
  'logistics', 'procurement', 'gps', 'territory',
] as const;

type ErpDomain = (typeof ERP_DOMAINS)[number];

function erpBase(env: ErpToolEnv): string {
  return (env.HARVICS_API_BASE || 'https://www.harvics.com').replace(/\/$/, '');
}

function erpHeaders(env: ErpToolEnv): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (env.HARVICS_API_KEY) h['Authorization'] = `Bearer ${env.HARVICS_API_KEY}`;
  return h;
}

/** POST /api/intelligence/copilot/chat — general ERP copilot. */
async function callErpCopilot(
  env: ErpToolEnv,
  message: string,
  domain: string,
  signal?: AbortSignal,
): Promise<string> {
  const res = await fetch(`${erpBase(env)}/api/intelligence/copilot/chat`, {
    method: 'POST',
    headers: erpHeaders(env),
    body: JSON.stringify({ message, context: domain }),
    signal,
  });
  if (!res.ok) throw new Error(`ERP copilot HTTP ${res.status}`);
  const data = await res.json() as { response?: string; advice?: { response?: string } };
  return data.response ?? data.advice?.response ?? '(no response)';
}

/** GET /api/intelligence/insights/:domain — live domain insights. */
async function callErpInsights(
  env: ErpToolEnv,
  domain: ErpDomain,
  signal?: AbortSignal,
): Promise<string> {
  const res = await fetch(`${erpBase(env)}/api/intelligence/insights/${domain}`, {
    headers: erpHeaders(env),
    signal,
  });
  if (!res.ok) throw new Error(`ERP insights HTTP ${res.status}`);
  const data = await res.json() as { insights?: unknown[] };
  const insights = data.insights ?? [];
  if (!Array.isArray(insights) || insights.length === 0) return 'No insights available.';
  return (insights as Array<{ title?: string; summary?: string; value?: unknown }>)
    .map((i) => `• ${i.title ?? ''}: ${i.summary ?? String(i.value ?? '')}`)
    .join('\n');
}

/** GET /api/intelligence/bot/ping — lightweight connectivity check. */
export async function checkErpConnectivity(
  env: ErpToolEnv,
  signal?: AbortSignal,
): Promise<{ ok: boolean; latencyMs: number; domains: string[]; error?: string }> {
  const start = Date.now();
  try {
    const res = await fetch(`${erpBase(env)}/api/intelligence/bot/ping`, {
      headers: erpHeaders(env),
      signal,
    });
    const latencyMs = Date.now() - start;
    if (!res.ok) return { ok: false, latencyMs, domains: [], error: `HTTP ${res.status}` };
    const data = await res.json() as { ok?: boolean; domains?: string[] };
    return { ok: data.ok === true, latencyMs, domains: data.domains ?? [] };
  } catch (err) {
    return { ok: false, latencyMs: Date.now() - start, domains: [], error: String(err) };
  }
}

export function delegateToErpTool(env: ErpToolEnv) {
  return tool({
    description:
      'Query the Harvics OS ERP for live business data: orders, inventory, finance, HR, logistics, procurement, territory. Use this when the user asks about Harvics business operations, not just CRM contacts.',
    inputSchema: z.object({
      question: z
        .string()
        .min(1)
        .max(2000)
        .describe('What to ask or look up in Harvics OS, in plain language'),
      domain: z
        .enum(ERP_DOMAINS)
        .optional()
        .describe('ERP domain to scope the query (omit to let the ERP route it)'),
      mode: z
        .enum(['copilot', 'insights'])
        .default('copilot')
        .describe(
          'copilot = conversational answer; insights = structured live KPIs for the domain',
        ),
    }),
    execute: async ({ question, domain, mode }, { abortSignal }) => {
      try {
        if (mode === 'insights' && domain) {
          const result = await callErpInsights(env, domain, abortSignal);
          return `[ERP INSIGHTS · ${domain.toUpperCase()}]\n${result}`;
        }
        const result = await callErpCopilot(
          env,
          question,
          domain ?? 'general',
          abortSignal,
        );
        return `[ERP · ${(domain ?? 'general').toUpperCase()}]\n${result}`;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return `[ERP UNAVAILABLE] Could not reach Harvics OS: ${msg}. Answer from available knowledge only.`;
      }
    },
  });
}
