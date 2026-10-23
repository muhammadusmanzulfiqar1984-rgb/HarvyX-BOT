import { getCanonicalBot } from '../bots/definitions';

/** Canonical team order shown in the activity strip — MIAN first, then specialists. */
export const TEAM_MEMBER_SLUGS = ['mian', 'ops', 'analyst', 'scrape', 'social'] as const;

export type TeamMemberSlug = (typeof TEAM_MEMBER_SLUGS)[number];

export const TEAM_MEMBER_LABELS = Object.fromEntries(
  TEAM_MEMBER_SLUGS.map((slug) => [slug, getCanonicalBot(slug)?.name ?? slug.toUpperCase()]),
) as Record<TeamMemberSlug, string>;
