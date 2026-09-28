/**
 * SSRF-guarded, robots.txt-respecting single-page fetcher.
 *
 * This exists so an LLM-controlled tool can fetch an arbitrary URL server-side
 * without becoming a pivot into internal infrastructure. It does NOT render
 * JavaScript (plain HTTP fetch) and does NOT follow redirects automatically —
 * a redirect target must be re-requested explicitly so it goes through the
 * same safety checks again instead of silently landing somewhere unchecked.
 */

import { lookup } from 'node:dns/promises';

const FETCH_TIMEOUT_MS = 10_000;
const MAX_BODY_BYTES = 2 * 1024 * 1024; // 2MB
const MAX_EXTRACTED_CHARS = 8_000;

/** Platforms with active anti-scraping enforcement and an existing legitimate path elsewhere. */
const BLOCKED_DIRECT_TARGETS = [
  'linkedin.com',
  'facebook.com',
  'instagram.com',
  'twitter.com',
  'x.com',
  'tiktok.com',
];

export class ScrapeBlockedError extends Error {}

function isPrivateOrReservedIPv4(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p))) return true; // malformed → treat as unsafe
  const [a, b] = parts;
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local incl. cloud metadata 169.254.169.254
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 0) return true; // 0.0.0.0/8
  if (a >= 224) return true; // multicast/reserved
  return false;
}

function isPrivateOrReservedIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === '::1') return true; // loopback
  if (lower.startsWith('fe80:') || lower.startsWith('fe8') || lower.startsWith('fe9') || lower.startsWith('fea') || lower.startsWith('feb')) return true; // link-local
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // unique local
  if (lower.startsWith('::ffff:')) return isPrivateOrReservedIPv4(lower.slice(7)); // IPv4-mapped
  return false;
}

function isBlockedDirectTarget(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^www\./, '');
  return BLOCKED_DIRECT_TARGETS.some((d) => h === d || h.endsWith(`.${d}`));
}

/** workerd exposes WebSocketPair; Node does not. */
function isCloudflareWorkerRuntime(): boolean {
  return typeof (globalThis as { WebSocketPair?: unknown }).WebSocketPair === 'function';
}

async function assertSafeUrl(url: URL): Promise<void> {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new ScrapeBlockedError('Only http/https URLs are allowed.');
  }
  if (isBlockedDirectTarget(url.hostname)) {
    throw new ScrapeBlockedError(
      `${url.hostname} is not a supported direct scrape target (active anti-scraping enforcement). ` +
        'Use the existing LinkedIn outreach automation for that platform instead.',
    );
  }
  if (url.hostname === 'localhost' || url.hostname.endsWith('.localhost')) {
    throw new ScrapeBlockedError('Localhost targets are not allowed.');
  }

  // On Cloudflare Workers, node:dns lookup often returns addresses that trip this
  // SSRF guard as false positives (public hosts like wikipedia.org). Platform
  // fetch() already blocks private/internal destinations — keep hostname checks
  // above and skip the redundant DNS private-IP probe in workerd.
  if (isCloudflareWorkerRuntime()) {
    return;
  }

  let resolved: { address: string; family: number }[];
  try {
    resolved = await lookup(url.hostname, { all: true });
  } catch {
    throw new ScrapeBlockedError(`Could not resolve ${url.hostname}.`);
  }
  for (const { address, family } of resolved) {
    const unsafe = family === 4 ? isPrivateOrReservedIPv4(address) : isPrivateOrReservedIPv6(address);
    if (unsafe) {
      throw new ScrapeBlockedError(`${url.hostname} resolves to a private/internal address — refusing to fetch.`);
    }
  }
}

async function checkRobotsAllowed(url: URL): Promise<boolean> {
  try {
    const robotsUrl = `${url.protocol}//${url.host}/robots.txt`;
    const res = await fetch(robotsUrl, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return true; // no robots.txt → allow
    const text = await res.text();
    // Minimal parser: only honors a blanket `Disallow: /` under `User-agent: *`.
    const lines = text.split('\n').map((l) => l.trim());
    let inWildcard = false;
    for (const line of lines) {
      if (/^user-agent:\s*\*/i.test(line)) {
        inWildcard = true;
        continue;
      }
      if (/^user-agent:/i.test(line)) {
        inWildcard = false;
        continue;
      }
      if (inWildcard && /^disallow:\s*\/\s*$/i.test(line)) {
        return false;
      }
    }
    return true;
  } catch {
    return true; // robots.txt unreachable → fail open
  }
}

function stripHtml(html: string): { title: string; description: string; text: string } {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([\s\S]*?)["']/i);

  let body = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<header[\s\S]*?<\/header>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

  if (body.length > MAX_EXTRACTED_CHARS) body = `${body.slice(0, MAX_EXTRACTED_CHARS)}…`;

  return {
    title: (titleMatch?.[1] ?? '').trim().slice(0, 300),
    description: (descMatch?.[1] ?? '').trim().slice(0, 500),
    text: body,
  };
}

function extractSignals(html: string): { emails: string[]; phones: string[]; socialLinks: string[] } {
  const emails = Array.from(
    new Set((html.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) ?? []).slice(0, 10)),
  );
  const phones = Array.from(
    new Set((html.match(/\+?\d[\d\s().-]{7,16}\d/g) ?? []).map((p) => p.trim()).slice(0, 10)),
  );
  const socialLinks = Array.from(
    new Set(
      (html.match(/https?:\/\/(?:www\.)?(?:linkedin|instagram|facebook|twitter|x|tiktok)\.com\/[^\s"'<>]+/gi) ?? []).slice(
        0,
        10,
      ),
    ),
  );
  return { emails, phones, socialLinks };
}

export interface ScrapeResult {
  url: string;
  status: number;
  title: string;
  description: string;
  text: string;
  emails: string[];
  phones: string[];
  socialLinks: string[];
  truncated: boolean;
}

export async function fetchAndExtract(rawUrl: string): Promise<ScrapeResult> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new ScrapeBlockedError('Not a valid URL.');
  }

  await assertSafeUrl(url);

  const robotsOk = await checkRobotsAllowed(url);
  if (!robotsOk) {
    throw new ScrapeBlockedError(`${url.hostname}/robots.txt disallows all crawling.`);
  }

  const res = await fetch(url.toString(), {
    redirect: 'manual', // never silently follow — caller must re-request the target explicitly
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { 'User-Agent': 'HarvYX-Bot/1.0 (+internal research tool)' },
  });

  if (res.status >= 300 && res.status < 400) {
    const location = res.headers.get('location') ?? '(no Location header)';
    throw new ScrapeBlockedError(`Got a redirect to ${location} — re-request that URL explicitly if you want it.`);
  }

  const reader = res.body?.getReader();
  let received = 0;
  const chunks: Uint8Array[] = [];
  if (reader) {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > MAX_BODY_BYTES) {
        await reader.cancel();
        break;
      }
      chunks.push(value);
    }
  }
  const html = Buffer.concat(chunks.map((c) => Buffer.from(c))).toString('utf-8');

  const { title, description, text } = stripHtml(html);
  const { emails, phones, socialLinks } = extractSignals(html);

  return {
    url: url.toString(),
    status: res.status,
    title,
    description,
    text,
    emails,
    phones,
    socialLinks,
    truncated: received > MAX_BODY_BYTES,
  };
}
