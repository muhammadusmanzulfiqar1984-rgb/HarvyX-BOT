import { tool } from 'ai';
import { z } from 'zod';
import { logSafe, logSafeError } from '../observability';
import { checkSendApproval, createApprovalGate, type ApprovalGate } from '../policy/approval';
import { assertBotMayPerform, botRequiresApproval } from '../bots/runtime';
import { getBotDefinition } from '../bots';
import type { GmailEnv } from '../connectors/gmail-oauth';
import {
  searchEmails,
  getEmail,
  getThread,
  listThreads,
  getAttachment,
  createDraft,
  updateDraft,
  deleteDraft,
  sendEmail,
  replyToThread,
  forwardEmail,
  sendDraft,
} from '../connectors/gmail-tools';

export interface GmailToolEnv extends GmailEnv {
  DB: D1Database;
}

/** Actions that write/send — require an explicit approval phrase from the user. */
const SEND_ACTIONS = new Set(['send_email', 'reply_to_thread', 'forward_email', 'send_draft']);

/**
 * Approval is checked against the real last user message via lib/policy/approval —
 * never against `input.task`, which the model authors itself (it could otherwise
 * grant its own approval). `gate` is the per-request send budget; the Manager passes
 * one shared gate to every send-capable tool so one approval = one send per turn.
 */
export function delegateToGmailTool(env: GmailToolEnv, gate: ApprovalGate = createApprovalGate()) {
  return tool({
    description:
      'Interact with the connected Gmail account. ' +
      'READ: search_emails, get_email, get_thread, list_threads, get_attachment. ' +
      'DRAFT: create_draft, update_draft, delete_draft. ' +
      'SEND (approval required): send_email, reply_to_thread, forward_email, send_draft. ' +
      'For send actions the task MUST contain explicit approval language from the user.',
    inputSchema: z.object({
      action: z.enum([
        'search_emails',
        'get_email',
        'get_thread',
        'list_threads',
        'get_attachment',
        'create_draft',
        'update_draft',
        'delete_draft',
        'send_email',
        'reply_to_thread',
        'forward_email',
        'send_draft',
      ]),
      task: z
        .string()
        .min(1)
        .max(4000)
        .describe('Plain-language description of what to do, including all required parameters'),
      // READ params
      query: z.string().optional().describe('Gmail search query (search_emails, list_threads)'),
      messageId: z.string().optional().describe('Gmail message ID'),
      threadId: z.string().optional().describe('Gmail thread ID'),
      attachmentId: z.string().optional().describe('Gmail attachment ID'),
      maxResults: z.number().int().min(1).max(50).optional(),
      format: z.enum(['full', 'metadata', 'minimal', 'raw']).optional(),
      // DRAFT / SEND params
      draftId: z.string().optional(),
      to: z.string().optional(),
      subject: z.string().optional(),
      body: z.string().optional(),
      inReplyTo: z.string().optional(),
      references: z.string().optional(),
    }),
    execute: async (input, { messages }) => {
      const ctx = { db: env.DB, env };
      const started = Date.now();
      const manager = getBotDefinition('mian');
      const actionKey = `gmail.${input.action}`;

      // BotDefinition.permissions first — does not replace the phrase gate below.
      const permitted = assertBotMayPerform(manager, actionKey);
      if (!permitted.ok) return { ok: false, error: permitted.error };

      // Block send actions unless the user's own most recent message contains
      // explicit approval language. Checked against real conversation history,
      // never against `input.task`, which the model authors itself.
      if (SEND_ACTIONS.has(input.action) || botRequiresApproval(manager, actionKey)) {
        if (SEND_ACTIONS.has(input.action)) {
          const decision = checkSendApproval(messages, gate);
          if (!decision.ok) return { ok: false, error: decision.error };
        }
      }

      try {
        let result: unknown;

        switch (input.action) {
          case 'search_emails':
            result = await searchEmails(ctx, {
              query: input.query ?? input.task,
              maxResults: input.maxResults,
            });
            break;

          case 'get_email':
            if (!input.messageId) return { ok: false, error: 'messageId is required.' };
            result = await getEmail(ctx, { messageId: input.messageId, format: input.format });
            break;

          case 'get_thread':
            if (!input.threadId) return { ok: false, error: 'threadId is required.' };
            result = await getThread(ctx, { threadId: input.threadId, format: input.format as 'full' | 'metadata' | 'minimal' | undefined });
            break;

          case 'list_threads':
            result = await listThreads(ctx, {
              query: input.query,
              maxResults: input.maxResults,
            });
            break;

          case 'get_attachment':
            if (!input.messageId || !input.attachmentId)
              return { ok: false, error: 'messageId and attachmentId are required.' };
            result = await getAttachment(ctx, {
              messageId: input.messageId,
              attachmentId: input.attachmentId,
            });
            break;

          case 'create_draft':
            if (!input.to || !input.subject || !input.body)
              return { ok: false, error: 'to, subject, and body are required for create_draft.' };
            result = await createDraft(ctx, {
              to: input.to,
              subject: input.subject,
              body: input.body,
              threadId: input.threadId,
              inReplyTo: input.inReplyTo,
              references: input.references,
            });
            break;

          case 'update_draft':
            if (!input.draftId || !input.to || !input.subject || !input.body)
              return { ok: false, error: 'draftId, to, subject, and body are required for update_draft.' };
            result = await updateDraft(ctx, {
              draftId: input.draftId,
              to: input.to,
              subject: input.subject,
              body: input.body,
              threadId: input.threadId,
            });
            break;

          case 'delete_draft':
            if (!input.draftId) return { ok: false, error: 'draftId is required.' };
            result = await deleteDraft(ctx, input.draftId);
            break;

          case 'send_email':
            if (!input.to || !input.subject || !input.body)
              return { ok: false, error: 'to, subject, and body are required for send_email.' };
            result = await sendEmail(ctx, {
              to: input.to,
              subject: input.subject,
              body: input.body,
              threadId: input.threadId,
              inReplyTo: input.inReplyTo,
              references: input.references,
              requireApproval: true,
            });
            break;

          case 'reply_to_thread':
            if (!input.threadId || !input.to || !input.subject || !input.body || !input.inReplyTo || !input.references)
              return { ok: false, error: 'threadId, to, subject, body, inReplyTo, and references are required.' };
            result = await replyToThread(ctx, {
              threadId: input.threadId,
              to: input.to,
              subject: input.subject,
              body: input.body,
              inReplyTo: input.inReplyTo,
              references: input.references,
              requireApproval: true,
            });
            break;

          case 'forward_email':
            if (!input.to || !input.subject || !input.body)
              return { ok: false, error: 'to, subject, and body are required for forward_email.' };
            result = await forwardEmail(ctx, {
              to: input.to,
              subject: input.subject,
              body: input.body,
              requireApproval: true,
            });
            break;

          case 'send_draft':
            if (!input.draftId) return { ok: false, error: 'draftId is required.' };
            result = await sendDraft(ctx, { draftId: input.draftId, requireApproval: true });
            break;

          default:
            return { ok: false, error: 'Unknown Gmail action.' };
        }

        logSafe('gmail_tool_ok', {
          bot: manager.slug,
          operation: input.action,
          elapsedMs: Date.now() - started,
        });
        return { ok: true, data: result };
      } catch (err) {
        logSafeError('gmail_tool_failed', err, {
          bot: manager.slug,
          operation: input.action,
          category: 'auth',
          elapsedMs: Date.now() - started,
        });
        const message = err instanceof Error ? err.message : 'Gmail operation failed.';
        return { ok: false, error: message };
      }
    },
  });
}
