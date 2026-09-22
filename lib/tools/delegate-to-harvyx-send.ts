import { tool, type ModelMessage } from 'ai';
import { z } from 'zod';
import { harvyxRequest, toolErrorResult, type HarvyxEnv } from './harvyx/client';

/**
 * Manager-level tool for HarvYX actions that leave the system (SMS/WhatsApp send,
 * outreach send). Deliberately NOT part of harvyxTools/OPS — OPS runs as a nested
 * sub-agent invoked with a single self-authored prompt, so it never sees the real
 * end-user conversation and can't be trusted to gate on genuine approval. This tool
 * lives on the Manager, which does see real messages.
 */

const APPROVAL_PATTERN = /\b(i approve|approved|confirm send|please send|go ahead and send)\b/i;

function lastUserMessageText(messages: ModelMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role !== 'user') continue;
    if (typeof m.content === 'string') return m.content;
    if (Array.isArray(m.content)) {
      return m.content
        .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
        .map((p) => p.text)
        .join(' ');
    }
  }
  return '';
}

export function delegateToHarvyxSendTool(env: HarvyxEnv) {
  return tool({
    description:
      'Send outbound SMS/WhatsApp via HarvYX (Twilio), or send a queued HarvYX outreach item ' +
      '(e.g. a LinkedIn outreach draft). Requires explicit approval language from the user in the conversation.',
    inputSchema: z.object({
      action: z.enum(['send_text', 'send_outreach']),
      channel: z.enum(['sms', 'whatsapp']).optional().describe('Required for send_text'),
      to: z.string().max(64).optional().describe('Recipient phone number, required for send_text'),
      content: z.string().max(2000).optional().describe('Message body, required for send_text'),
      leadId: z.string().max(120).optional(),
      outreachId: z.string().max(120).optional().describe('Required for send_outreach — never invent an id'),
    }),
    execute: async (input, { messages }) => {
      if (!APPROVAL_PATTERN.test(lastUserMessageText(messages))) {
        return {
          ok: false,
          error: 'Send actions require explicit user approval. Ask the user to confirm before sending.',
        };
      }

      try {
        if (input.action === 'send_text') {
          if (!input.channel || !input.to || !input.content) {
            return { ok: false, error: 'channel, to, and content are required for send_text.' };
          }
          const data = await harvyxRequest(env, '/send-text', {
            method: 'POST',
            body: JSON.stringify({
              channel: input.channel,
              to: input.to,
              content: input.content,
              leadId: input.leadId,
            }),
          });
          return { ok: true, data };
        }

        if (!input.outreachId) {
          return { ok: false, error: 'outreachId is required for send_outreach.' };
        }
        const data = await harvyxRequest(env, `/outreach/${encodeURIComponent(input.outreachId)}/send`, {
          method: 'POST',
        });
        return { ok: true, data };
      } catch (err) {
        return toolErrorResult(err, `POST harvyx-send:${input.action}`);
      }
    },
  });
}
