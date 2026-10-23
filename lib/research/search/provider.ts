/**
 * Web search provider abstraction.
 * Real HTTP search only — never invents URLs. Configurable via env.
 */

export type WebSearchResult = {
  title: string;
  url: string;
  snippet: string;
  domain: string;
  rank: number;
  provider: string;
  score?: number;
};

export type WebSearchResponse = {
  ok: true;
  query: string;
  provider: string;
  results: WebSearchResult[];
} | {
  ok: false;
  query: string;
  provider: string;
  error: string;
  results: [];
};

export type WebSearchEnv = {
  WEB_SEARCH_PROVIDER?: string;
  /** Tavily */
  TAVILY_API_KEY?: string;
  /** Serper.dev Google */
  SERPER_API_KEY?: string;
  /** Brave Search */
  BRAVE_SEARCH_API_KEY?: string;
  /** Self-hosted or allowed SearXNG base URL, e.g. https://searx.example.com */
  SEARXNG_BASE_URL?: string;
  /** Force mock for tests */
  WEB_SEARCH_FORCE_MOCK?: string;
};

export type WebSearchOptions = {
  maxResults?: number;
};

export type WebSearchProvider = {
  id: string;
  search(query: string, options?: WebSearchOptions): Promise<WebSearchResponse>;
};

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

export function resolveWebSearchProvider(env: WebSearchEnv): WebSearchProvider {
  if (env.WEB_SEARCH_FORCE_MOCK?.trim() === '1') {
    return mockProvider();
  }
  const name = (env.WEB_SEARCH_PROVIDER || '').trim().toLowerCase();

  if (name === 'tavily' || (!name && env.TAVILY_API_KEY?.trim())) {
    return tavilyProvider(env);
  }
  if (name === 'serper' || (!name && env.SERPER_API_KEY?.trim())) {
    return serperProvider(env);
  }
  if (name === 'brave' || (!name && env.BRAVE_SEARCH_API_KEY?.trim())) {
    return braveProvider(env);
  }
  if (name === 'searxng' || (!name && env.SEARXNG_BASE_URL?.trim())) {
    return searxngProvider(env);
  }
  if (name === 'duckduckgo' || name === 'ddg') {
    return duckDuckGoHtmlProvider();
  }
  if (name === 'free' || name === 'free-web' || !name) {
    // Default when no paid key: real free HTTP sources (Wikipedia + News RSS + DDG IA).
    return freeWebProvider();
  }
  if (name === 'mock') return mockProvider();

  throw new Error(
    `Unknown WEB_SEARCH_PROVIDER="${name}". Use tavily, serper, brave, searxng, free, or duckduckgo.`,
  );
}

export async function webSearch(
  env: WebSearchEnv,
  query: string,
  options?: WebSearchOptions,
): Promise<WebSearchResponse> {
  const q = query.trim();
  if (!q) {
    return { ok: false, query: '', provider: 'none', error: 'Query is required.', results: [] };
  }
  try {
    const provider = resolveWebSearchProvider(env);
    return await provider.search(q, options);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Web search failed.';
    return {
      ok: false,
      query: q,
      provider: env.WEB_SEARCH_PROVIDER || 'unknown',
      error: message,
      results: [],
    };
  }
}

function tavilyProvider(env: WebSearchEnv): WebSearchProvider {
  const key = env.TAVILY_API_KEY?.trim();
  if (!key) throw new Error('TAVILY_API_KEY is required for WEB_SEARCH_PROVIDER=tavily.');

  return {
    id: 'tavily',
    async search(query, options) {
      const maxResults = Math.min(Math.max(options?.maxResults ?? 8, 1), 20);
      const res = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: key,
          query,
          max_results: maxResults,
          include_answer: false,
          search_depth: 'basic',
        }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        return {
          ok: false,
          query,
          provider: 'tavily',
          error: `Tavily HTTP ${res.status}: ${body.slice(0, 200)}`,
          results: [],
        };
      }
      const data = (await res.json()) as {
        results?: Array<{ title?: string; url?: string; content?: string; score?: number }>;
      };
      const results = (data.results || [])
        .filter((r) => r.url)
        .map((r, i) => ({
          title: r.title || r.url || '',
          url: r.url!,
          snippet: (r.content || '').slice(0, 500),
          domain: domainOf(r.url!),
          rank: i + 1,
          provider: 'tavily',
          score: typeof r.score === 'number' ? r.score : undefined,
        }));
      return { ok: true, query, provider: 'tavily', results };
    },
  };
}

function serperProvider(env: WebSearchEnv): WebSearchProvider {
  const key = env.SERPER_API_KEY?.trim();
  if (!key) throw new Error('SERPER_API_KEY is required for WEB_SEARCH_PROVIDER=serper.');

  return {
    id: 'serper',
    async search(query, options) {
      const maxResults = Math.min(Math.max(options?.maxResults ?? 8, 1), 20);
      const res = await fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': key,
        },
        body: JSON.stringify({ q: query, num: maxResults }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        return {
          ok: false,
          query,
          provider: 'serper',
          error: `Serper HTTP ${res.status}: ${body.slice(0, 200)}`,
          results: [],
        };
      }
      const data = (await res.json()) as {
        organic?: Array<{ title?: string; link?: string; snippet?: string }>;
      };
      const results = (data.organic || [])
        .filter((r) => r.link)
        .map((r, i) => ({
          title: r.title || r.link || '',
          url: r.link!,
          snippet: (r.snippet || '').slice(0, 500),
          domain: domainOf(r.link!),
          rank: i + 1,
          provider: 'serper',
        }));
      return { ok: true, query, provider: 'serper', results };
    },
  };
}

function braveProvider(env: WebSearchEnv): WebSearchProvider {
  const key = env.BRAVE_SEARCH_API_KEY?.trim();
  if (!key) throw new Error('BRAVE_SEARCH_API_KEY is required for WEB_SEARCH_PROVIDER=brave.');

  return {
    id: 'brave',
    async search(query, options) {
      const maxResults = Math.min(Math.max(options?.maxResults ?? 8, 1), 20);
      const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${maxResults}`;
      const res = await fetch(url, {
        headers: {
          Accept: 'application/json',
          'X-Subscription-Token': key,
        },
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        return {
          ok: false,
          query,
          provider: 'brave',
          error: `Brave HTTP ${res.status}: ${body.slice(0, 200)}`,
          results: [],
        };
      }
      const data = (await res.json()) as {
        web?: { results?: Array<{ title?: string; url?: string; description?: string }> };
      };
      const results = (data.web?.results || [])
        .filter((r) => r.url)
        .map((r, i) => ({
          title: r.title || r.url || '',
          url: r.url!,
          snippet: (r.description || '').slice(0, 500),
          domain: domainOf(r.url!),
          rank: i + 1,
          provider: 'brave',
        }));
      return { ok: true, query, provider: 'brave', results };
    },
  };
}

/**
 * DuckDuckGo HTML results page — real HTTP search (no invented URLs).
 * Often blocked by bot challenges; prefer paid providers or free-web default.
 */
function duckDuckGoHtmlProvider(): WebSearchProvider {
  return {
    id: 'duckduckgo',
    async search(query, options) {
      const maxResults = Math.min(Math.max(options?.maxResults ?? 8, 1), 15);
      const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
      const res = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (compatible; HARVYX-Bot/1.0; +research; respectful fetch)',
          Accept: 'text/html',
        },
        signal: AbortSignal.timeout(12_000),
      });
      if (!res.ok) {
        return {
          ok: false,
          query,
          provider: 'duckduckgo',
          error: `DuckDuckGo HTTP ${res.status}`,
          results: [],
        };
      }
      const html = await res.text();
      if (/anomaly\.js|botnet|challenge/i.test(html) && !/result__a/i.test(html)) {
        return {
          ok: false,
          query,
          provider: 'duckduckgo',
          error: 'DuckDuckGo blocked the request (bot challenge). Configure TAVILY_API_KEY, SERPER_API_KEY, BRAVE_SEARCH_API_KEY, or SEARXNG_BASE_URL.',
          results: [],
        };
      }
      const results = parseDdgHtml(html, maxResults);
      if (!results.length) {
        return {
          ok: false,
          query,
          provider: 'duckduckgo',
          error: 'DuckDuckGo returned no parseable results.',
          results: [],
        };
      }
      return { ok: true, query, provider: 'duckduckgo', results };
    },
  };
}

function searxngProvider(env: WebSearchEnv): WebSearchProvider {
  const base = (env.SEARXNG_BASE_URL || '').trim().replace(/\/$/, '');
  if (!base) throw new Error('SEARXNG_BASE_URL is required for WEB_SEARCH_PROVIDER=searxng.');
  return {
    id: 'searxng',
    async search(query, options) {
      const maxResults = Math.min(Math.max(options?.maxResults ?? 8, 1), 15);
      const url = `${base}/search?q=${encodeURIComponent(query)}&format=json&categories=general`;
      const res = await fetch(url, {
        headers: { Accept: 'application/json', 'User-Agent': 'HARVYX-Bot/1.0 (+research)' },
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) {
        return {
          ok: false,
          query,
          provider: 'searxng',
          error: `SearXNG HTTP ${res.status}`,
          results: [],
        };
      }
      const data = (await res.json()) as {
        results?: Array<{ title?: string; url?: string; content?: string; score?: number }>;
      };
      const results = (data.results || [])
        .filter((r) => r.url && /^https?:\/\//i.test(r.url))
        .slice(0, maxResults)
        .map((r, i) => ({
          title: r.title || r.url || '',
          url: r.url!,
          snippet: (r.content || '').slice(0, 500),
          domain: domainOf(r.url!),
          rank: i + 1,
          provider: 'searxng',
          score: r.score,
        }));
      if (!results.length) {
        return { ok: false, query, provider: 'searxng', error: 'SearXNG returned no results.', results: [] };
      }
      return { ok: true, query, provider: 'searxng', results };
    },
  };
}

/**
 * Free multi-source web search (no API key):
 * Wikipedia MediaWiki search + Google News RSS + DuckDuckGo Instant Answer.
 * All URLs come from live HTTP responses — never invented.
 */
function freeWebProvider(): WebSearchProvider {
  return {
    id: 'free-web',
    async search(query, options) {
      const maxResults = Math.min(Math.max(options?.maxResults ?? 8, 1), 15);
      const [wiki, news, ia] = await Promise.all([
        wikipediaSearch(query, maxResults),
        googleNewsRssSearch(query, maxResults),
        duckDuckGoInstantAnswer(query, maxResults),
      ]);

      const merged: WebSearchResult[] = [];
      const seen = new Set<string>();
      const push = (r: WebSearchResult) => {
        const key = r.url.replace(/\/$/, '').toLowerCase();
        if (seen.has(key) || !/^https?:\/\//i.test(r.url)) return;
        // Prefer scrapeable encyclopedia / publisher pages over Google News redirects
        if (/news\.google\.com/i.test(r.url)) return;
        seen.add(key);
        merged.push({ ...r, rank: merged.length + 1 });
      };

      for (const batch of [wiki, ia, news]) {
        for (const r of batch) push(r);
      }

      if (!merged.length) {
        return {
          ok: false,
          query,
          provider: 'free-web',
          error:
            'Free web search returned no usable URLs. Configure TAVILY_API_KEY, SERPER_API_KEY, BRAVE_SEARCH_API_KEY, or SEARXNG_BASE_URL for broader coverage.',
          results: [],
        };
      }
      return {
        ok: true,
        query,
        provider: 'free-web',
        results: merged.slice(0, maxResults),
      };
    },
  };
}

async function wikipediaSearch(query: string, max: number): Promise<WebSearchResult[]> {
  try {
    const url =
      `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}` +
      `&format=json&srlimit=${max}&origin=*`;
    const res = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'HARVYX-Bot/1.0 (+research)' },
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      query?: { search?: Array<{ title: string; snippet?: string }> };
    };
    return (data.query?.search || []).map((s, i) => {
      const pageUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(s.title.replace(/ /g, '_'))}`;
      return {
        title: s.title,
        url: pageUrl,
        snippet: stripTags(s.snippet || '').slice(0, 500),
        domain: 'en.wikipedia.org',
        rank: i + 1,
        provider: 'wikipedia',
      };
    });
  } catch {
    return [];
  }
}

async function googleNewsRssSearch(query: string, max: number): Promise<WebSearchResult[]> {
  try {
    const url =
      `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
    const res = await fetch(url, {
      headers: {
        Accept: 'application/rss+xml, application/xml, text/xml',
        'User-Agent': 'HARVYX-Bot/1.0 (+research)',
      },
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].slice(0, max);
    const out: WebSearchResult[] = [];
    for (const [idx, m] of items.entries()) {
      const block = m[1] || '';
      const title = stripTags((block.match(/<title>([\s\S]*?)<\/title>/i) || [])[1] || '').trim();
      const sourceUrl = ((block.match(/<source[^>]+url="([^"]+)"/i) || [])[1] || '').trim();
      const desc = stripTags((block.match(/<description>([\s\S]*?)<\/description>/i) || [])[1] || '');
      // Prefer publisher site from <source url> — scrapeable; Google News article links are redirect shells.
      if (!sourceUrl || !/^https?:\/\//i.test(sourceUrl)) continue;
      out.push({
        title: title || sourceUrl,
        url: sourceUrl.replace(/\/$/, '') + '/',
        snippet: desc.slice(0, 500) || title,
        domain: domainOf(sourceUrl),
        rank: idx + 1,
        provider: 'google-news-rss',
      });
    }
    return out;
  } catch {
    return [];
  }
}

async function duckDuckGoInstantAnswer(query: string, max: number): Promise<WebSearchResult[]> {
  try {
    const url =
      `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_redirect=1&no_html=1`;
    const res = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'HARVYX-Bot/1.0 (+research)' },
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      Heading?: string;
      AbstractURL?: string;
      AbstractText?: string;
      AbstractSource?: string;
      Results?: Array<{ FirstURL?: string; Text?: string }>;
      RelatedTopics?: Array<{ FirstURL?: string; Text?: string; Topics?: Array<{ FirstURL?: string; Text?: string }> }>;
    };
    const out: WebSearchResult[] = [];
    if (data.AbstractURL && /^https?:\/\//i.test(data.AbstractURL)) {
      out.push({
        title: data.Heading || data.AbstractSource || data.AbstractURL,
        url: data.AbstractURL,
        snippet: (data.AbstractText || '').slice(0, 500),
        domain: domainOf(data.AbstractURL),
        rank: 1,
        provider: 'duckduckgo-ia',
      });
    }
    const pushTopic = (t?: { FirstURL?: string; Text?: string }) => {
      if (!t?.FirstURL || !/^https?:\/\//i.test(t.FirstURL)) return;
      if (out.length >= max) return;
      out.push({
        title: (t.Text || t.FirstURL).split(' - ')[0].slice(0, 200),
        url: t.FirstURL,
        snippet: (t.Text || '').slice(0, 500),
        domain: domainOf(t.FirstURL),
        rank: out.length + 1,
        provider: 'duckduckgo-ia',
      });
    };
    for (const r of data.Results || []) pushTopic(r);
    for (const t of data.RelatedTopics || []) {
      if (t.Topics) for (const x of t.Topics) pushTopic(x);
      else pushTopic(t);
    }
    return out.slice(0, max);
  } catch {
    return [];
  }
}

function parseDdgHtml(html: string, max: number): WebSearchResult[] {
  const results: WebSearchResult[] = [];
  // Result blocks: uddg redirect links + result__snippet
  const linkRe =
    /<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  const snippetRe = /class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/(?:a|td|div)>/gi;
  const snippets: string[] = [];
  for (const m of html.matchAll(snippetRe)) {
    snippets.push(stripTags(m[1] || '').slice(0, 500));
  }

  let i = 0;
  for (const m of html.matchAll(linkRe)) {
    if (results.length >= max) break;
    const href = decodeDdgHref(m[1] || '');
    if (!href || !/^https?:\/\//i.test(href)) continue;
    const title = stripTags(m[2] || '').trim() || href;
    results.push({
      title,
      url: href,
      snippet: snippets[i] || '',
      domain: domainOf(href),
      rank: results.length + 1,
      provider: 'duckduckgo',
    });
    i += 1;
  }
  return results;
}

function decodeDdgHref(href: string): string {
  try {
    const u = new URL(href, 'https://html.duckduckgo.com');
    const uddg = u.searchParams.get('uddg');
    if (uddg) return decodeURIComponent(uddg);
    if (href.startsWith('http')) return href;
    return '';
  } catch {
    return href.startsWith('http') ? href : '';
  }
}

function stripTags(s: string): string {
  return s
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/** Test-only provider — returns fixed real-shaped results (not for production claims). */
export function mockProvider(fixture?: WebSearchResult[]): WebSearchProvider {
  return {
    id: 'mock',
    async search(query) {
      const results =
        fixture ??
        [
          {
            title: `Mock result for ${query}`,
            url: 'https://example.com/research-mock',
            snippet: `Mock snippet about ${query}.`,
            domain: 'example.com',
            rank: 1,
            provider: 'mock',
            score: 1,
          },
        ];
      return { ok: true, query, provider: 'mock', results };
    },
  };
}
