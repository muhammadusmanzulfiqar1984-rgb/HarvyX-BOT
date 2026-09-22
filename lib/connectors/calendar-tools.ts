/**
 * Google Calendar connector tools — server-side only.
 *
 * Creating an event WITH attendees sends real invite emails to real people —
 * that is a send-sensitive action, same class as Gmail send. Kept off the OPS
 * agent for the same reason as delegate-to-gmail / delegate-to-harvyx-send.
 */

import { getConnectorAccountRow } from './db';
import { getValidAccessToken } from './gmail-oauth';
import type { CalendarEnv } from './calendar-oauth';

const CALENDAR_BASE = 'https://www.googleapis.com/calendar/v3';

async function calendarFetch(accessToken: string, path: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(`${CALENDAR_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Calendar API ${res.status}: ${text.slice(0, 120)}`);
  }
  return res.json();
}

export interface CalendarContext {
  db: D1Database;
  env: CalendarEnv;
}

async function getToken(ctx: CalendarContext): Promise<string> {
  const row = await getConnectorAccountRow(ctx.db, 'calendar');
  if (!row) throw new Error('Google Calendar not connected. Please connect it in Settings.');
  return getValidAccessToken(ctx.db, ctx.env, row);
}

export interface ListEventsParams {
  timeMin?: string;
  timeMax?: string;
  maxResults?: number;
  q?: string;
}

export async function listEvents(ctx: CalendarContext, params: ListEventsParams) {
  const token = await getToken(ctx);
  const qs = new URLSearchParams({
    timeMin: params.timeMin ?? new Date().toISOString(),
    maxResults: String(params.maxResults ?? 20),
    singleEvents: 'true',
    orderBy: 'startTime',
  });
  if (params.timeMax) qs.set('timeMax', params.timeMax);
  if (params.q) qs.set('q', params.q);
  return calendarFetch(token, `/calendars/primary/events?${qs}`);
}

export interface CheckAvailabilityParams {
  timeMin: string;
  timeMax: string;
}

export async function checkAvailability(ctx: CalendarContext, params: CheckAvailabilityParams) {
  const token = await getToken(ctx);
  return calendarFetch(token, '/freeBusy', {
    method: 'POST',
    body: JSON.stringify({
      timeMin: params.timeMin,
      timeMax: params.timeMax,
      items: [{ id: 'primary' }],
    }),
  });
}

export interface CreateEventParams {
  summary: string;
  description?: string;
  location?: string;
  start: string;
  end: string;
  timeZone?: string;
  attendees?: string[];
  /** Must be explicitly true whenever attendees are present — prevents silent invite sends. */
  requireApproval?: true;
}

export async function createEvent(ctx: CalendarContext, params: CreateEventParams) {
  const token = await getToken(ctx);
  const body: Record<string, unknown> = {
    summary: params.summary,
    description: params.description,
    location: params.location,
    start: { dateTime: params.start, timeZone: params.timeZone || 'UTC' },
    end: { dateTime: params.end, timeZone: params.timeZone || 'UTC' },
  };
  if (params.attendees?.length) {
    body.attendees = params.attendees.map((email) => ({ email }));
  }
  const qs = new URLSearchParams();
  if (params.attendees?.length) qs.set('sendUpdates', 'all');
  const path = `/calendars/primary/events${qs.toString() ? `?${qs}` : ''}`;
  return calendarFetch(token, path, { method: 'POST', body: JSON.stringify(body) });
}
