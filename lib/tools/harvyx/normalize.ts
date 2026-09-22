import { clampLeadLimit } from './client';

export function slimLead(raw: Record<string, unknown>): Record<string, unknown> {
  return {
    id: raw.id,
    name: raw.name || raw.contactName || '',
    company: raw.company || '',
    title: raw.title || '',
    email: raw.email || '',
    phone: raw.phone || '',
    linkedin: raw.linkedin || '',
    website: raw.website || '',
    country: raw.country || '',
    city: raw.city || '',
    vertical: raw.vertical || raw.segment || '',
    status: raw.status || '',
    score: raw.score ?? 0,
  };
}

/** Normalize list responses and cap payload size for LLM context. */
export function normalizeLeadsResponse(
  body: unknown,
  requestedLimit: number,
): Record<string, unknown> {
  if (!body || typeof body !== 'object') {
    return { leads: [], total: 0, truncated: false, note: 'Empty HarvYX response.' };
  }
  const obj = body as Record<string, unknown>;
  const rawLeads = Array.isArray(obj.leads) ? obj.leads : [];
  const total = typeof obj.total === 'number' ? obj.total : rawLeads.length;
  const limit = clampLeadLimit(requestedLimit);
  const sliced = rawLeads.slice(0, limit).map((l) => {
    if (l && typeof l === 'object') return slimLead(l as Record<string, unknown>);
    return {};
  });
  const truncated = total > sliced.length || rawLeads.length > sliced.length;

  return {
    leads: sliced,
    returned: sliced.length,
    total,
    offset: typeof obj.offset === 'number' ? obj.offset : 0,
    limit,
    truncated,
    note: truncated
      ? `Showing ${sliced.length} of ${total} leads. Use offset/limit to page; do not request huge dumps.`
      : undefined,
    counts: obj.counts,
  };
}

export function slimCampaigns(body: unknown): Record<string, unknown> {
  if (body && typeof body === 'object' && Array.isArray((body as { campaigns?: unknown }).campaigns)) {
    const campaigns = (body as { campaigns: Record<string, unknown>[] }).campaigns.map((c) => ({
      id: c.id,
      name: c.name,
      status: c.status,
      templateId: c.templateId,
      channel: c.channel,
      createdAt: c.createdAt,
      startedAt: c.startedAt,
      leadCount: Array.isArray(c.leads) ? c.leads.length : undefined,
    }));
    const templates = (body as { templates?: unknown }).templates;
    let templateSummary: unknown = undefined;
    if (Array.isArray(templates)) {
      templateSummary = templates.slice(0, 10).map((t) => {
        if (t && typeof t === 'object') {
          const o = t as Record<string, unknown>;
          return { id: o.id, name: o.name };
        }
        return t;
      });
    }
    return {
      ok: true,
      campaigns,
      templates: templateSummary,
      note: 'Full campaign lead lists omitted; use lead tools for contacts.',
    };
  }
  return { ok: true, data: body };
}

export function slimCampaignCreate(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== 'object') return { ok: true, data: body };
  const o = body as Record<string, unknown>;
  const campaign = o.campaign as Record<string, unknown> | undefined;
  return {
    ok: true,
    campaign: campaign
      ? {
          id: campaign.id,
          name: campaign.name,
          status: campaign.status,
          templateId: campaign.templateId,
          leadCount: Array.isArray(campaign.leads) ? campaign.leads.length : undefined,
        }
      : undefined,
    summary: o.summary,
  };
}

export function slimCampaignStart(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== 'object') return { ok: true, data: body };
  const o = body as Record<string, unknown>;
  const campaign = o.campaign as Record<string, unknown> | undefined;
  return {
    ok: Boolean(o.ok),
    campaignId: campaign?.id,
    campaignStatus: campaign?.status,
    queued: o.queued,
    step: o.step,
    linkedinTotal: o.linkedinTotal,
    hint: typeof o.hint === 'string' ? o.hint.slice(0, 200) : undefined,
    // Do not forward phantom internals / full lead lists.
    phantom: o.phantom
      ? { launched: !(o.phantom as { error?: unknown }).error, hasError: Boolean((o.phantom as { error?: unknown }).error) }
      : undefined,
  };
}

export function slimDiscover(body: unknown, limit: number): Record<string, unknown> {
  if (!body || typeof body !== 'object') {
    return { ok: true, leads: [], total: 0, live: true };
  }
  const obj = body as Record<string, unknown>;
  const rawLeads = Array.isArray(obj.leads) ? obj.leads : [];
  const sliced = rawLeads.slice(0, limit).map((l) => {
    if (l && typeof l === 'object') {
      const s = slimLead(l as Record<string, unknown>);
      return {
        ...s,
        source: (l as Record<string, unknown>).source,
        live: true,
        note: 'Discover results are live prospects — not saved until you call add lead.',
      };
    }
    return {};
  });
  return {
    ok: true,
    leads: sliced,
    returned: sliced.length,
    total: typeof obj.total === 'number' ? obj.total : sliced.length,
    provider: obj.provider,
    live: true,
    note: 'These leads are NOT in the CRM yet. Use harvyxAddLead to save one explicitly.',
  };
}

export function slimGenerate(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== 'object') return { ok: false, data: body };
  const o = body as Record<string, unknown>;
  if (typeof o.error === 'string') return { ok: false, error: o.error };
  return {
    ok: true,
    type: o.type,
    engine: o.engine,
    subject: o.subject || undefined,
    content: o.content,
    note: 'Draft only — nothing was sent.',
  };
}

/** Response shape: { query, bank: { total, groups: [{sourceFile,label,count,leads}] }, library: [...], live: [...] } */
export function slimUnifiedSearch(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== 'object') return { ok: true, groups: [], library: [], live: [] };
  const o = body as Record<string, unknown>;
  const bank = o.bank as
    | { total?: number; groups?: Record<string, unknown>[]; distinctSources?: number }
    | undefined;
  const groups = Array.isArray(bank?.groups)
    ? bank!.groups!.slice(0, 5).map((g) => ({
        sourceFile: g.sourceFile,
        label: g.label,
        count: g.count,
        leads: Array.isArray(g.leads)
          ? (g.leads as Record<string, unknown>[]).slice(0, 5).map((l) => slimLead(l))
          : [],
      }))
    : [];
  const library = Array.isArray(o.library) ? (o.library as unknown[]).slice(0, 8) : [];
  const live = Array.isArray(o.live)
    ? (o.live as Record<string, unknown>[]).slice(0, 8).map((l) => slimLead(l))
    : [];
  return {
    ok: true,
    query: o.query,
    pipelineTotal: bank?.total ?? 0,
    distinctSources: bank?.distinctSources ?? 0,
    groups,
    library,
    live,
    note:
      'groups = existing CRM pipeline leads (grouped by import source). ' +
      'live = NOT saved yet — use harvyxAddLead to save one.',
  };
}

export function slimLibrarySearch(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== 'object') return { ok: true, items: [], count: 0 };
  const o = body as Record<string, unknown>;
  const items = Array.isArray(o.items) ? (o.items as unknown[]).slice(0, 20) : [];
  return {
    ok: true,
    query: o.query,
    count: typeof o.count === 'number' ? o.count : items.length,
    items,
    sourceCatalogSize: o.sourceCatalogSize,
  };
}

export function slimOutreachList(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== 'object') return { ok: true, items: [] };
  const o = body as Record<string, unknown>;
  const rawItems = Array.isArray(o.items) ? (o.items as Record<string, unknown>[]) : [];
  const items = rawItems.slice(0, 25).map((it) => ({
    id: it.id,
    status: it.status,
    type: it.type,
    channel: it.channel,
    target: it.target,
    message: typeof it.message === 'string' ? it.message.slice(0, 300) : it.message,
    createdAt: it.createdAt,
    sentAt: it.sentAt,
  }));
  return { ok: true, items, total: rawItems.length };
}

export function slimOutreachCreate(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== 'object') return { ok: false, data: body };
  const o = body as Record<string, unknown>;
  const item = o.item as Record<string, unknown> | undefined;
  return {
    ok: Boolean(o.ok),
    item: item
      ? { id: item.id, status: item.status, type: item.type, channel: item.channel, target: item.target }
      : undefined,
    note: 'Draft created — NOT sent. Sending requires explicit user approval via the Manager.',
  };
}

export function slimEnrich(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== 'object') return { ok: false, data: body };
  const o = body as Record<string, unknown>;
  return {
    ok: Boolean(o.ok),
    method: o.method,
    domain: o.domain,
    email: o.email,
    confidence: o.confidence,
    phone: o.phone,
    position: o.position,
    linkedin: o.linkedin,
    contactName: o.contactName,
    message: o.message,
    // Cap alternate emails list
    emails: Array.isArray(o.emails)
      ? (o.emails as Record<string, unknown>[]).slice(0, 5).map((e) => ({
          email: e.email,
          firstName: e.firstName,
          lastName: e.lastName,
          position: e.position,
          confidence: e.confidence,
        }))
      : undefined,
    note: 'Enrich does not write to CRM. Use harvyxUpdateLead to persist fields.',
  };
}
