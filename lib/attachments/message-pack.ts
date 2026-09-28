/** Client helpers for packing / unpacking attachment markers in chat messages. */

import type { AttachmentFormat } from './types';

export type EmbeddedAttachmentRef = {
  id: string;
  filename: string;
  mime: string;
  size: number;
  format: AttachmentFormat | 'upload';
  url: string;
};

const ATT_RE = /⟦HX_ATT⟧([\s\S]*?)⟦\/HX_ATT⟧/g;
const CTX_RE = /⟦HX_CTX⟧[\s\S]*?⟦\/HX_CTX⟧\s*/g;

export function packMessageWithAttachments(
  userText: string,
  attachments: EmbeddedAttachmentRef[],
  agentContext: string,
): string {
  const markers = attachments
    .map((a) => `⟦HX_ATT⟧${JSON.stringify(a)}⟦/HX_ATT⟧`)
    .join('\n');
  const ctx = agentContext.trim()
    ? `⟦HX_CTX⟧\n${agentContext.trim()}\n⟦/HX_CTX⟧`
    : '';
  return [markers, ctx, userText.trim()].filter(Boolean).join('\n\n');
}

export function parseUserMessage(raw: string): {
  displayText: string;
  attachments: EmbeddedAttachmentRef[];
} {
  const attachments: EmbeddedAttachmentRef[] = [];
  let rest = raw;

  rest = rest.replace(ATT_RE, (_m, json: string) => {
    try {
      const parsed = JSON.parse(json) as EmbeddedAttachmentRef;
      if (parsed?.id && parsed.filename) attachments.push(parsed);
    } catch {
      /* ignore malformed */
    }
    return '';
  });

  rest = rest.replace(CTX_RE, '');

  // Hide any leftover attachment context if markers were stripped oddly
  rest = rest
    .replace(/^USER ATTACHMENTS[\s\S]*?----- END FILE CONTENT -----\s*/gm, '')
    .trim();

  return { displayText: rest, attachments };
}

/** Hide raw artifact labels agents sometimes echo (OUTPUT / svg / canvas). */
export function scrubArtifactLabels(markdown: string): string {
  return markdown
    .replace(/^\s*(OUTPUT|SVG|CANVAS)\s*$/gim, '')
    .replace(/```(?:svg|canvas|output)\b/gi, '```text')
    .replace(/\bOUTPUT\b(?=\s*[:·])/g, 'Result');
}
