/**
 * Lightweight JSON-schema validation for capability I/O.
 * Uses structural checks + zod when a zod schema is registered.
 */

import { z } from 'zod';
import type { JsonSchemaLike } from './types';

const CREDENTIAL_RE =
  /(api[_-]?key|sk-[a-z0-9]{10,}|hx_[a-z0-9]{10,}|password\s*[:=]|bearer\s+[a-z0-9._-]{10,}|refresh[_-]?token)/i;

export function containsCredentialLike(value: unknown): boolean {
  try {
    return CREDENTIAL_RE.test(JSON.stringify(value));
  } catch {
    return false;
  }
}

export function validateAgainstJsonSchema(
  schema: JsonSchemaLike,
  input: unknown,
): { ok: true; data: Record<string, unknown> } | { ok: false; error: string } {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, error: 'Input must be a JSON object.' };
  }
  const data = input as Record<string, unknown>;
  if (containsCredentialLike(data)) {
    return { ok: false, error: 'Input appears to contain credentials — rejected.' };
  }

  const required = schema.required ?? [];
  for (const key of required) {
    if (data[key] === undefined || data[key] === null || data[key] === '') {
      return { ok: false, error: `Missing required field: ${key}` };
    }
  }

  if (schema.properties) {
    for (const [key, prop] of Object.entries(schema.properties)) {
      if (data[key] === undefined) continue;
      const p = prop as JsonSchemaLike;
      const t = p.type;
      if (!t) continue;
      const v = data[key];
      if (t === 'string' && typeof v !== 'string') {
        return { ok: false, error: `Field "${key}" must be a string.` };
      }
      if (t === 'number' && typeof v !== 'number') {
        return { ok: false, error: `Field "${key}" must be a number.` };
      }
      if (t === 'boolean' && typeof v !== 'boolean') {
        return { ok: false, error: `Field "${key}" must be a boolean.` };
      }
      if (t === 'array' && !Array.isArray(v)) {
        return { ok: false, error: `Field "${key}" must be an array.` };
      }
      if (t === 'object' && (typeof v !== 'object' || v === null || Array.isArray(v))) {
        return { ok: false, error: `Field "${key}" must be an object.` };
      }
    }
  }

  if (schema.additionalProperties === false && schema.properties) {
    for (const key of Object.keys(data)) {
      if (!(key in schema.properties)) {
        return { ok: false, error: `Unknown field: ${key}` };
      }
    }
  }

  return { ok: true, data };
}

/** Presentation create — shared shape for mock / powerpoint / gamma catalog. */
export const presentationCreateInput = z.object({
  title: z.string().min(1).max(200),
  slides: z
    .array(
      z.object({
        title: z.string().min(1).max(200),
        body: z.string().max(8000).optional(),
        notes: z.string().max(4000).optional(),
      }),
    )
    .min(1)
    .max(60),
  theme: z.string().max(80).optional(),
  speakerNotes: z.boolean().optional(),
});

export type PresentationCreateInput = z.infer<typeof presentationCreateInput>;

export function validatePresentationCreate(
  input: unknown,
): { ok: true; data: PresentationCreateInput } | { ok: false; error: string } {
  if (containsCredentialLike(input)) {
    return { ok: false, error: 'Input appears to contain credentials — rejected.' };
  }
  const parsed = presentationCreateInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join('; ') };
  }
  return { ok: true, data: parsed.data };
}
