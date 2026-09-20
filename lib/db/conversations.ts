import type { ManagerUIMessage } from '../agents/manager';
import { logSafeError } from '../observability';

export interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

function isUuidLike(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

export async function getOrCreateConversation(
  db: D1Database,
  id?: string,
): Promise<Conversation> {
  const safeId = id && isUuidLike(id) ? id : undefined;

  if (safeId) {
    const existing = await db
      .prepare('SELECT * FROM conversations WHERE id = ?')
      .bind(safeId)
      .first<Conversation>();
    if (existing) return existing;
  }

  const newId = safeId || crypto.randomUUID();
  const now = new Date().toISOString();
  await db
    .prepare(
      'INSERT INTO conversations (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)',
    )
    .bind(newId, 'New conversation', now, now)
    .run();

  return { id: newId, title: 'New conversation', created_at: now, updated_at: now };
}

export async function loadMessages(
  db: D1Database,
  conversationId: string,
): Promise<ManagerUIMessage[]> {
  const { results } = await db
    .prepare('SELECT id, role, parts FROM messages WHERE conversation_id = ? ORDER BY seq ASC')
    .bind(conversationId)
    .all<{ id: string; role: string; parts: string }>();

  return results.flatMap((row) => {
    try {
      const parts = JSON.parse(row.parts);
      if (!Array.isArray(parts)) return [];
      return [
        {
          id: row.id,
          role: row.role as ManagerUIMessage['role'],
          parts,
        } as ManagerUIMessage,
      ];
    } catch (err) {
      logSafeError('message_parts_parse_failed', err, {
        operation: 'loadMessages',
        category: 'persistence',
      });
      return [];
    }
  });
}

export async function appendMessages(
  db: D1Database,
  conversationId: string,
  messages: ManagerUIMessage[],
): Promise<void> {
  if (!conversationId || !Array.isArray(messages) || messages.length === 0) return;

  const { results } = await db
    .prepare('SELECT COALESCE(MAX(seq), 0) as maxSeq FROM messages WHERE conversation_id = ?')
    .bind(conversationId)
    .all<{ maxSeq: number }>();
  let seq = (results[0]?.maxSeq ?? 0) + 1;

  const now = new Date().toISOString();
  const statements = [];

  for (const message of messages) {
    if (!message?.id || !message.role) continue;
    let partsJson: string;
    try {
      partsJson = JSON.stringify(message.parts ?? []);
    } catch (err) {
      logSafeError('message_parts_serialize_failed', err, {
        operation: 'appendMessages',
        category: 'persistence',
      });
      continue;
    }
    statements.push(
      db
        .prepare(
          `INSERT INTO messages (id, conversation_id, role, parts, created_at, seq)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET parts = excluded.parts`,
        )
        .bind(message.id, conversationId, message.role, partsJson, now, seq++),
    );
  }

  if (statements.length > 0) {
    await db.batch(statements);
  }

  await db
    .prepare('UPDATE conversations SET updated_at = ? WHERE id = ?')
    .bind(now, conversationId)
    .run();
}

/** Persist without throwing into the chat stream path. */
export async function appendMessagesSafe(
  db: D1Database,
  conversationId: string,
  messages: ManagerUIMessage[],
): Promise<boolean> {
  try {
    await appendMessages(db, conversationId, messages);
    return true;
  } catch (err) {
    logSafeError('append_messages_failed', err, {
      operation: 'appendMessagesSafe',
      category: 'persistence',
    });
    return false;
  }
}
