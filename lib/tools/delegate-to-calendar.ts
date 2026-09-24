import { tool } from 'ai';
import { z } from 'zod';
import { logSafe, logSafeError } from '../observability';
import type { CalendarEnv } from '../connectors/calendar-oauth';
import { listEvents, checkAvailability, createEvent } from '../connectors/calendar-tools';
import {
  checkSendApproval,
  createApprovalGate,
  INVITE_APPROVAL_PATTERN,
  type ApprovalGate,
} from '../policy/approval';
import { assertBotMayPerform } from '../bots/runtime';
import { getBotDefinition } from '../bots';

export interface CalendarToolEnv extends CalendarEnv {
  DB: D1Database;
}

export function delegateToCalendarTool(env: CalendarToolEnv, gate: ApprovalGate = createApprovalGate()) {
  return tool({
    description:
      'Interact with the connected Google Calendar. ' +
      'READ: list_events, check_availability. ' +
      'WRITE: create_event — creating an event with attendees sends real invite emails and ' +
      'requires explicit user approval language in the task; an event with no attendees ' +
      '(a personal/internal block) does not.',
    inputSchema: z.object({
      action: z.enum(['list_events', 'check_availability', 'create_event']),
      task: z
        .string()
        .min(1)
        .max(2000)
        .describe('Plain-language description of what to do, including all required parameters'),
      timeMin: z.string().optional().describe('ISO datetime — lower bound for list_events/check_availability'),
      timeMax: z.string().optional().describe('ISO datetime — upper bound for list_events/check_availability'),
      q: z.string().optional().describe('Free-text filter for list_events'),
      maxResults: z.number().int().min(1).max(50).optional(),
      summary: z.string().max(300).optional().describe('Event title, required for create_event'),
      description: z.string().max(2000).optional(),
      location: z.string().max(300).optional(),
      start: z.string().optional().describe('ISO datetime, required for create_event'),
      end: z.string().optional().describe('ISO datetime, required for create_event'),
      timeZone: z.string().max(100).optional(),
      attendees: z.array(z.string().max(320)).optional().describe('Attendee emails — never invent these'),
    }),
    execute: async (input, { messages }) => {
      const ctx = { db: env.DB, env };
      const started = Date.now();
      const manager = getBotDefinition('mian');
      const actionKey =
        input.action === 'create_event' && input.attendees?.length
          ? 'calendar.create_event+attendees'
          : `calendar.${input.action}`;

      const permitted = assertBotMayPerform(manager, actionKey);
      if (!permitted.ok) return { ok: false, error: permitted.error };

      if (input.action === 'create_event' && input.attendees?.length) {
        const decision = checkSendApproval(
          messages,
          gate,
          INVITE_APPROVAL_PATTERN,
          'Inviting attendees sends real email invites and requires explicit user approval. ' +
            'Ask the user to confirm before creating this event.',
        );
        if (!decision.ok) return { ok: false, error: decision.error };
      }

      try {
        let result: unknown;

        switch (input.action) {
          case 'list_events':
            result = await listEvents(ctx, {
              timeMin: input.timeMin,
              timeMax: input.timeMax,
              maxResults: input.maxResults,
              q: input.q,
            });
            break;

          case 'check_availability':
            if (!input.timeMin || !input.timeMax) {
              return { ok: false, error: 'timeMin and timeMax are required for check_availability.' };
            }
            result = await checkAvailability(ctx, { timeMin: input.timeMin, timeMax: input.timeMax });
            break;

          case 'create_event':
            if (!input.summary || !input.start || !input.end) {
              return { ok: false, error: 'summary, start, and end are required for create_event.' };
            }
            result = await createEvent(ctx, {
              summary: input.summary,
              description: input.description,
              location: input.location,
              start: input.start,
              end: input.end,
              timeZone: input.timeZone,
              attendees: input.attendees,
            });
            break;

          default:
            return { ok: false, error: 'Unknown Calendar action.' };
        }

        logSafe('calendar_tool_ok', { operation: input.action, elapsedMs: Date.now() - started });
        return { ok: true, data: result };
      } catch (err) {
        logSafeError('calendar_tool_failed', err, {
          operation: input.action,
          category: 'auth',
          elapsedMs: Date.now() - started,
        });
        const message = err instanceof Error ? err.message : 'Calendar operation failed.';
        return { ok: false, error: message };
      }
    },
  });
}
