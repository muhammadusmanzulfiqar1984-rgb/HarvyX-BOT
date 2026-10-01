/**
 * Approval gate — limits outbound send actions per user turn.
 * Used by Manager to enforce one send budget across Gmail, HarvyxSend, Calendar.
 */

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
