/**
 * Knowledge authorization — filter BEFORE any chunk text reaches a model.
 * Client-supplied botSlug is never trusted; runtime passes the authenticated agent slug.
 */

import type { KnowledgeScope, KnowledgeScopeKind, BotKnowledgeSlug } from './types';
import { BOT_KNOWLEDGE_SLUGS } from './types';

export type KnowledgeAccessContext = {
  /** Server-derived bot identity (required). */
  botSlug: string;
  /** Optional active project for this conversation/session. */
  projectId?: string | null;
};

export function isBotKnowledgeSlug(slug: string): slug is BotKnowledgeSlug {
  return (BOT_KNOWLEDGE_SLUGS as readonly string[]).includes(slug);
}

/**
 * Whether a set of scopes authorizes the access context.
 * Rules:
 * - shared → any permitted bot (all registry bots that have the knowledge tool)
 * - bot → only matching bot_slug
 * - project → only when access.projectId matches AND is non-empty
 */
export function scopesAuthorize(
  scopes: Pick<KnowledgeScope, 'scope_kind' | 'bot_slug' | 'project_id'>[],
  access: KnowledgeAccessContext,
): boolean {
  if (!scopes.length) return false;
  const bot = access.botSlug.trim();
  if (!bot) return false;
  const projectId = access.projectId?.trim() || null;

  for (const s of scopes) {
    if (s.scope_kind === 'shared') return true;
    if (s.scope_kind === 'bot' && s.bot_slug === bot) return true;
    if (s.scope_kind === 'project' && projectId && s.project_id === projectId) return true;
  }
  return false;
}

export type ScopeInput =
  | { scope_kind: 'shared' }
  | { scope_kind: 'bot'; bot_slug: string }
  | { scope_kind: 'project'; project_id: string };

export function normalizeScopeInputs(raw: unknown): ScopeInput[] {
  if (!Array.isArray(raw)) return [];
  const out: ScopeInput[] = [];
  const seen = new Set<string>();

  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const kind = String((item as { scope_kind?: string }).scope_kind || '') as KnowledgeScopeKind;
    if (kind === 'shared') {
      const key = 'shared';
      if (!seen.has(key)) {
        seen.add(key);
        out.push({ scope_kind: 'shared' });
      }
      continue;
    }
    if (kind === 'bot') {
      const bot_slug = String((item as { bot_slug?: string }).bot_slug || '').trim();
      if (!isBotKnowledgeSlug(bot_slug)) continue;
      const key = `bot:${bot_slug}`;
      if (!seen.has(key)) {
        seen.add(key);
        out.push({ scope_kind: 'bot', bot_slug });
      }
      continue;
    }
    if (kind === 'project') {
      const project_id = String((item as { project_id?: string }).project_id || '').trim();
      if (!project_id || project_id.length > 80) continue;
      const key = `project:${project_id}`;
      if (!seen.has(key)) {
        seen.add(key);
        out.push({ scope_kind: 'project', project_id });
      }
    }
  }
  return out;
}

export function scopeLabel(s: Pick<KnowledgeScope, 'scope_kind' | 'bot_slug' | 'project_id'>): string {
  if (s.scope_kind === 'shared') return 'SHARED';
  if (s.scope_kind === 'bot') {
    const map: Record<string, string> = {
      mian: 'MANAGER',
      ops: 'OPS',
      analyst: 'ANALYST',
      scrape: 'SCRAPE',
      social: 'SOCIAL',
    };
    return map[s.bot_slug || ''] || `BOT:${(s.bot_slug || '').toUpperCase()}`;
  }
  return 'PROJECT';
}
