import type { GmailEnv } from './gmail-oauth';

export type CalendarEnv = GmailEnv;

export const CALENDAR_SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/userinfo.email',
];

/**
 * Deliberately does NOT honor GmailEnv.GOOGLE_REDIRECT_URI here — that override is a
 * single URL and Gmail already claims it for its own callback. Calendar always derives
 * its redirect URI from the incoming request instead, so the two connectors can't collide.
 */
export function getCalendarRedirectUri(requestUrl?: string): string {
  if (requestUrl) {
    const u = new URL(requestUrl);
    return `${u.protocol}//${u.host}/api/connectors/calendar/callback`;
  }
  return 'http://localhost:3000/api/connectors/calendar/callback';
}
