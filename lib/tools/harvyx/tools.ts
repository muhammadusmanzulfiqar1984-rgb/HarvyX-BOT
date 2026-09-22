import { tool } from 'ai';
import { z } from 'zod';
import {
  clampDiscoverLimit,
  clampLeadLimit,
  harvyxRequest,
  LEAD_STATUSES,
  MAX_CAMPAIGN_LEAD_IDS,
  MAX_DISCOVER_LIMIT,
  MAX_LEAD_LIMIT,
  toolErrorResult,
  type HarvyxEnv,
} from './client';
import {
  normalizeLeadsResponse,
  slimCampaignCreate,
  slimCampaigns,
  slimCampaignStart,
  slimDiscover,
  slimEnrich,
  slimGenerate,
  slimLibrarySearch,
  slimOutreachCreate,
  slimOutreachList,
  slimUnifiedSearch,
} from './normalize';

export function harvyxTools(env: HarvyxEnv) {
  return {
    harvyxGetStats: tool({
      description: 'Pipeline health snapshot — lead counts by status, top verticals.',
      inputSchema: z.object({}),
      execute: async (_input, { abortSignal }) => {
        try {
          const data = await harvyxRequest(env, '/stats', { abortSignal });
          return { ok: true, data };
        } catch (err) {
          return toolErrorResult(err, '/stats');
        }
      },
    }),

    harvyxListLeads: tool({
      description:
        'Browse CRM leads. Prefer vertical= for segment filters (e.g. textile). Always pass a small limit (default 10, max 25). Use offset to page (not page number). Sorting is server-side (score / relevance) — do not invent a sort param.',
      inputSchema: z.object({
        vertical: z.string().optional().describe('Segment/vertical filter, e.g. textile'),
        status: z.enum(LEAD_STATUSES).optional(),
        q: z.string().optional().describe('Free-text search (heavier than vertical)'),
        limit: z.number().int().min(1).max(MAX_LEAD_LIMIT).optional(),
        offset: z.number().int().min(0).optional().describe('Pagination offset (not page)'),
      }),
      execute: async ({ vertical, status, q, limit, offset }, { abortSignal }) => {
        const clamped = clampLeadLimit(limit);
        try {
          const p = new URLSearchParams();
          if (vertical?.trim()) p.set('vertical', vertical.trim());
          if (status) p.set('status', status);
          if (q?.trim()) p.set('q', q.trim());
          p.set('limit', String(clamped));
          p.set('offset', String(offset && offset > 0 ? Math.floor(offset) : 0));
          const data = await harvyxRequest(env, `/leads?${p}`, { abortSignal });
          return { ok: true, ...normalizeLeadsResponse(data, clamped) };
        } catch (err) {
          return toolErrorResult(err, '/leads');
        }
      },
    }),

    harvyxSearchLeads: tool({
      description:
        'Search CRM leads by free-text q (person, company, email). Returns a small page (default 10, max 25).',
      inputSchema: z.object({
        q: z.string().min(1).max(200),
        limit: z.number().int().min(1).max(MAX_LEAD_LIMIT).optional(),
        offset: z.number().int().min(0).optional(),
      }),
      execute: async ({ q, limit, offset }, { abortSignal }) => {
        const clamped = clampLeadLimit(limit);
        try {
          const p = new URLSearchParams();
          p.set('q', q.trim());
          p.set('limit', String(clamped));
          p.set('offset', String(offset && offset > 0 ? Math.floor(offset) : 0));
          const data = await harvyxRequest(env, `/leads?${p}`, { abortSignal });
          return { ok: true, ...normalizeLeadsResponse(data, clamped) };
        } catch (err) {
          return toolErrorResult(err, '/leads?q');
        }
      },
    }),

    harvyxAddLead: tool({
      description:
        'Add a contact to the HarvYX CRM (POST { lead }). Requires enough identity (email and/or linkedin and/or name+company). Never invent data.',
      inputSchema: z.object({
        name: z.string().min(1).max(200).optional(),
        email: z.string().min(1).max(320).optional(),
        company: z.string().max(200).optional(),
        title: z.string().max(200).optional(),
        phone: z.string().max(64).optional(),
        linkedin: z.string().max(500).optional(),
        website: z.string().max(500).optional(),
        country: z.string().max(100).optional(),
        city: z.string().max(100).optional(),
        vertical: z.string().max(100).optional().describe('Stored as segment'),
        score: z.number().optional(),
        source: z.enum(['apollo', 'lusha', 'linkedin', 'manual', 'scraper', 'discover']).optional(),
      }),
      execute: async (input, { abortSignal }) => {
        if (!input.email && !input.linkedin && !(input.name && input.company) && !input.website) {
          return {
            ok: false,
            error: {
              category: 'validation',
              message: 'Need email, linkedin, name+company, or website/domain to add a lead.',
            },
          };
        }
        try {
          const lead = {
            name: input.name,
            contactName: input.name,
            email: input.email,
            company: input.company,
            title: input.title,
            phone: input.phone,
            linkedin: input.linkedin,
            website: input.website,
            country: input.country,
            city: input.city,
            segment: input.vertical,
            vertical: input.vertical,
            score: input.score,
            source: input.source || 'manual',
          };
          const data = await harvyxRequest(env, '/leads', {
            method: 'POST',
            body: JSON.stringify({ lead }),
            abortSignal,
          });
          return { ok: true, data };
        } catch (err) {
          return toolErrorResult(err, 'POST /leads');
        }
      },
    }),

    harvyxUpdateLead: tool({
      description:
        'Update an existing CRM lead (PATCH /leads). Requires lead id plus status and/or enrich fields. Never invent ids.',
      inputSchema: z
        .object({
          id: z.string().min(1).max(120),
          status: z.enum(LEAD_STATUSES).optional(),
          email: z.string().max(320).optional(),
          phone: z.string().max(64).optional(),
          linkedin: z.string().max(500).optional(),
          title: z.string().max(200).optional(),
          name: z.string().max(200).optional(),
          company: z.string().max(200).optional(),
          website: z.string().max(500).optional(),
          score: z.number().optional(),
        })
        .refine(
          (v) =>
            v.status != null ||
            v.email != null ||
            v.phone != null ||
            v.linkedin != null ||
            v.title != null ||
            v.name != null ||
            v.company != null ||
            v.website != null ||
            v.score != null,
          { message: 'Provide status and/or at least one enrich field' },
        ),
      execute: async (input, { abortSignal }) => {
        try {
          const body: Record<string, unknown> = { id: input.id };
          if (input.status != null) body.status = input.status;
          if (input.email != null) body.email = input.email;
          if (input.phone != null) body.phone = input.phone;
          if (input.linkedin != null) body.linkedin = input.linkedin;
          if (input.title != null) body.title = input.title;
          if (input.name != null) body.name = input.name;
          if (input.company != null) body.company = input.company;
          if (input.website != null) body.website = input.website;
          if (input.score != null) body.score = input.score;
          const data = await harvyxRequest(env, '/leads', {
            method: 'PATCH',
            body: JSON.stringify(body),
            abortSignal,
          });
          return { ok: true, data };
        } catch (err) {
          return toolErrorResult(err, 'PATCH /leads');
        }
      },
    }),

    harvyxEnrichLead: tool({
      description:
        'Lookup email/phone via HarvYX Hunter enrich (POST /enrich). Does NOT save to CRM — call harvyxUpdateLead afterward if the user wants persistence. Needs website/domain (or email domain).',
      inputSchema: z.object({
        website: z.string().max(500).optional(),
        domain: z.string().max(255).optional(),
        email: z.string().max(320).optional(),
        company: z.string().max(200).optional(),
        contactName: z.string().max(200).optional(),
        firstName: z.string().max(100).optional(),
        lastName: z.string().max(100).optional(),
      }),
      execute: async (input, { abortSignal }) => {
        if (!input.website && !input.domain && !input.email) {
          return {
            ok: false,
            error: {
              category: 'validation',
              message: 'Enrich needs website, domain, or email to derive a domain.',
            },
          };
        }
        try {
          const data = await harvyxRequest(env, '/enrich', {
            method: 'POST',
            body: JSON.stringify(input),
            abortSignal,
          });
          return slimEnrich(data);
        } catch (err) {
          return toolErrorResult(err, 'POST /enrich');
        }
      },
    }),

    harvyxDiscoverLeads: tool({
      description:
        'Live company discovery via HarvYX (GET /discover). Returns live prospects NOT saved to CRM. provider=places (default) or serper/web. Max limit 20.',
      inputSchema: z.object({
        q: z.string().min(1).max(200).describe('Search query, e.g. "textile distributors Germany"'),
        provider: z.enum(['places', 'serper', 'web']).optional(),
        limit: z.number().int().min(1).max(MAX_DISCOVER_LIMIT).optional(),
      }),
      execute: async ({ q, provider, limit }, { abortSignal }) => {
        const clamped = clampDiscoverLimit(limit);
        try {
          const p = new URLSearchParams();
          p.set('q', q.trim());
          p.set('limit', String(clamped));
          if (provider) p.set('provider', provider);
          const data = await harvyxRequest(env, `/discover?${p}`, { abortSignal });
          return slimDiscover(data, clamped);
        } catch (err) {
          return toolErrorResult(err, '/discover');
        }
      },
    }),

    harvyxGetCampaigns: tool({
      description:
        'List HarvYX campaigns and template ids. API returns the full list (no server-side limit/offset).',
      inputSchema: z.object({}),
      execute: async (_input, { abortSignal }) => {
        try {
          const data = await harvyxRequest(env, '/campaigns', { abortSignal });
          return slimCampaigns(data);
        } catch (err) {
          return toolErrorResult(err, '/campaigns');
        }
      },
    }),

    harvyxCreateCampaign: tool({
      description:
        'Create a LinkedIn campaign. REQUIRES leadIds (1–500). Vertical enrollment is NOT supported — list leads first, then pass real ids. Never invent ids.',
      inputSchema: z.object({
        name: z.string().min(1).max(200),
        templateId: z.enum(['connect_only', 'connect_dm', 'connect_dm_followup']),
        leadIds: z.array(z.string().min(1).max(120)).min(1).max(MAX_CAMPAIGN_LEAD_IDS),
      }),
      execute: async ({ name, templateId, leadIds }, { abortSignal }) => {
        try {
          const data = await harvyxRequest(env, '/campaigns', {
            method: 'POST',
            body: JSON.stringify({ name, templateId, leadIds }),
            abortSignal,
          });
          return slimCampaignCreate(data);
        } catch (err) {
          return toolErrorResult(err, 'POST /campaigns');
        }
      },
    }),

    harvyxGenerateContent: tool({
      description:
        "Draft on-brand content for Harvics Global using HarvYX's content generator " +
        '(cold email, LinkedIn post/DM/connect note, social post, WhatsApp, SMS). ' +
        'Draft only — never sends or posts anything.',
      inputSchema: z.object({
        type: z.enum(['email', 'linkedin_post', 'linkedin_dm', 'linkedin_connect', 'social_post', 'whatsapp', 'sms']),
        topic: z.string().max(500).optional().describe('Angle/offer/topic for the content'),
        tone: z.string().max(100).optional(),
        notes: z.string().max(1000).optional().describe('Extra instructions'),
        lead: z
          .object({
            contactName: z.string().max(200).optional(),
            title: z.string().max(200).optional(),
            company: z.string().max(200).optional(),
            city: z.string().max(100).optional(),
            country: z.string().max(100).optional(),
            segment: z.string().max(100).optional(),
            website: z.string().max(500).optional(),
          })
          .optional()
          .describe('Recipient context — only pass real known lead fields, never invent them'),
      }),
      execute: async (input, { abortSignal }) => {
        try {
          const data = await harvyxRequest(env, '/generate', {
            method: 'POST',
            body: JSON.stringify(input),
            abortSignal,
          });
          return slimGenerate(data);
        } catch (err) {
          return toolErrorResult(err, 'POST /generate');
        }
      },
    }),

    harvyxUnifiedSearch: tool({
      description:
        'Unified search across the HarvYX CRM pipeline, the trade-fair/source library, and live discovery in one call. ' +
        'Broader than harvyxSearchLeads (which is CRM-only).',
      inputSchema: z.object({
        q: z.string().min(1).max(200),
        includeLive: z.boolean().optional().describe('Include live web discovery results (default true, slower)'),
      }),
      execute: async ({ q, includeLive }, { abortSignal }) => {
        try {
          const p = new URLSearchParams({ q: q.trim() });
          if (includeLive === false) p.set('live', '0');
          const data = await harvyxRequest(env, `/search?${p}`, { abortSignal });
          return slimUnifiedSearch(data);
        } catch (err) {
          return toolErrorResult(err, '/search');
        }
      },
    }),

    harvyxLibrarySearch: tool({
      description: 'Search the HarvYX trade-fair/event and source catalog library — not CRM leads.',
      inputSchema: z.object({
        q: z.string().max(200).optional().describe('Free-text filter; empty returns the full catalog'),
      }),
      execute: async ({ q }, { abortSignal }) => {
        try {
          const p = new URLSearchParams();
          if (q?.trim()) p.set('q', q.trim());
          const data = await harvyxRequest(env, `/library/search?${p}`, { abortSignal });
          return slimLibrarySearch(data);
        } catch (err) {
          return toolErrorResult(err, '/library/search');
        }
      },
    }),

    harvyxListOutreach: tool({
      description:
        'List queued/sent outreach items — a lightweight outreach tracker, separate from LinkedIn campaigns.',
      inputSchema: z.object({}),
      execute: async (_input, { abortSignal }) => {
        try {
          const data = await harvyxRequest(env, '/outreach', { abortSignal });
          return slimOutreachList(data);
        } catch (err) {
          return toolErrorResult(err, '/outreach');
        }
      },
    }),

    harvyxCreateOutreachDraft: tool({
      description:
        'Create a draft outreach item — queued, NOT sent. ' +
        'Sending it later requires the Manager\'s harvyxSend tool with explicit user approval.',
      inputSchema: z.object({
        channel: z.string().max(50).describe('e.g. linkedin, email, sms, whatsapp, research'),
        target: z.string().max(300).optional(),
        message: z.string().max(2000).optional(),
        linkedin: z.string().max(500).optional(),
        leadId: z.string().max(120).optional(),
      }),
      execute: async (input, { abortSignal }) => {
        try {
          const data = await harvyxRequest(env, '/outreach', {
            method: 'POST',
            body: JSON.stringify(input),
            abortSignal,
          });
          return slimOutreachCreate(data);
        } catch (err) {
          return toolErrorResult(err, 'POST /outreach');
        }
      },
    }),

    harvyxStartCampaign: tool({
      description:
        'Start/activate an existing campaign by id (POST /campaigns/:id/start). Queues step-1 outreach. Optional launchPhantom for LinkedIn connect via PhantomBuster. Requires explicit campaignId.',
      inputSchema: z.object({
        campaignId: z.string().min(1).max(120),
        launchPhantom: z.boolean().optional().describe('If true, also attempt PhantomBuster for connect step'),
      }),
      execute: async ({ campaignId, launchPhantom }, { abortSignal }) => {
        try {
          const data = await harvyxRequest(env, `/campaigns/${encodeURIComponent(campaignId)}/start`, {
            method: 'POST',
            body: JSON.stringify(launchPhantom ? { launchPhantom: true } : {}),
            abortSignal,
          });
          return slimCampaignStart(data);
        } catch (err) {
          return toolErrorResult(err, 'POST /campaigns/:id/start');
        }
      },
    }),
  };
}
