/**
 * Action classification — maps action keys to semantic classes used by the
 * permission gate and approval logic.
 */

export type ActionClass = 'read' | 'write' | 'send' | 'delegate' | 'external';

export type ActionEntry = {
  key: string;
  cls: ActionClass;
  requiresApproval: boolean;
};

const ACTION_TABLE: ActionEntry[] = [
  // Send-class (require approval by default)
  { key: 'gmail.send_email',         cls: 'send',     requiresApproval: true },
  { key: 'gmail.send',               cls: 'send',     requiresApproval: true },
  { key: 'harvyxSend.send',          cls: 'send',     requiresApproval: true },
  { key: 'harvyxSend.send_message',  cls: 'send',     requiresApproval: true },
  { key: 'calendar.create_event',    cls: 'send',     requiresApproval: true },
  { key: 'calendar.update_event',    cls: 'send',     requiresApproval: true },

  // Write-class
  { key: 'gmail.create_draft',       cls: 'write',    requiresApproval: false },
  { key: 'ops.add_contact',          cls: 'write',    requiresApproval: false },
  { key: 'ops.update_contact',       cls: 'write',    requiresApproval: false },
  { key: 'ops.enrich',               cls: 'write',    requiresApproval: false },

  // Delegate-class
  { key: 'delegateToOps',            cls: 'delegate', requiresApproval: false },
  { key: 'delegateToAnalyst',        cls: 'delegate', requiresApproval: false },
  { key: 'delegateToSocial',         cls: 'delegate', requiresApproval: false },
  { key: 'delegateToScrape',         cls: 'delegate', requiresApproval: false },
  { key: 'delegateToErp',            cls: 'delegate', requiresApproval: false },

  // External-class
  { key: 'scrape.fetch',             cls: 'external', requiresApproval: false },
  { key: 'erp.query',                cls: 'external', requiresApproval: false },
];

const TABLE_INDEX = new Map<string, ActionEntry>(ACTION_TABLE.map((e) => [e.key, e]));

/**
 * Classify an action key. Returns undefined for unknown keys (treated as 'read').
 */
export function classify(actionKey: string): ActionEntry | undefined {
  return TABLE_INDEX.get(actionKey);
}
