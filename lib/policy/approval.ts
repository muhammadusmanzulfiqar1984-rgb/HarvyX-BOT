/**
 * Approval gate — limits outbound send actions per user turn.
 * Used by Manager to enforce one send budget across Gmail, HarvyxSend, Calendar.
 */

import type { ModelMessage } from 'ai';

export type ApprovalDecision =
  | { ok: true; error?: never }
  | { ok: false; error: string };

export type ApprovalGate = {
  /** Attempt to consume one send slot. Returns ok: true if allowed, false if budget exhausted. */
  consume: () => ApprovalDecision;
  /** Remaining slots in this gate. */
  remaining: () => number;
};

/**
 * Create a gate that allows at most `maxSends` consume() calls.
 * Pass maxSends = 1 to enforce one outbound action per turn.
 */
export function createApprovalGate(maxSends = 1): ApprovalGate {
  let used = 0;
  return {
    consume(): ApprovalDecision {
      if (used >= maxSends) {
        return {
          ok: false,
          error: `Send budget exhausted (${maxSends} per turn). Only one outbound action is allowed per user message.`,
        };
      }
      used += 1;
      return { ok: true };
    },
    remaining(): number {
      return Math.max(0, maxSends - used);
    },
  };
}

/**
 * Explicit approval language. "send it" alone is a request, not an approval —
 * the user must approve or confirm in their own words.
 */
export const SEND_APPROVAL_PATTERN =
  /\b(i approve|approved?|i confirm|confirm(ed)?|go ahead|yes,? (send|go ahead|do it|proceed))\b/i;

/** Calendar invites email third parties, so the same explicit bar applies. */
export const INVITE_APPROVAL_PATTERN =
  /\b(i approve|approved?|i confirm|confirm(ed)?|go ahead|yes,? (send|invite|go ahead|do it|proceed))\b/i;

/** "don't approve", "not confirmed", "never send" — any negated approval fails closed. */
const NEGATION_PATTERN =
  /\b(don'?t|do not|not|never|no|cannot|can'?t)\b[^.!?\n]{0,20}\b(approve|approved|confirm|confirmed|send|go ahead|proceed)\b/i;

const DEFAULT_DENIAL =
  'This action sends a real outbound message and requires explicit user approval. ' +
  'Ask the user to confirm (e.g. "I approve, send it") before retrying.';

function lastUserText(messages: readonly ModelMessage[] | undefined): string {
  if (!messages) return '';
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role !== 'user') continue;
    if (typeof m.content === 'string') return m.content;
    return m.content
      .map((p) => (p.type === 'text' ? p.text : ''))
      .join(' ');
  }
  return '';
}

/**
 * Approve an outbound send only when the user's own most recent message contains
 * explicit approval language, then spend one slot of the per-turn gate.
 * Never pass model-authored text here — that would let the model approve itself.
 */
export function checkSendApproval(
  messages: readonly ModelMessage[] | undefined,
  gate: ApprovalGate,
  pattern: RegExp = SEND_APPROVAL_PATTERN,
  denial: string = DEFAULT_DENIAL,
): ApprovalDecision {
  const text = lastUserText(messages);
  if (!pattern.test(text) || NEGATION_PATTERN.test(text)) {
    return { ok: false, error: denial };
  }
  return gate.consume();
}
