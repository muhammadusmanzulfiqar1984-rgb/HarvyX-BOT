/**
 * Deterministic chunking for Knowledge RAG.
 * Target ~800 chars with ~120 overlap; preserves page/section markers when present.
 */

import type { KnowledgeChunkDraft } from './types';

export const DEFAULT_CHUNK_SIZE = 800;
export const DEFAULT_CHUNK_OVERLAP = 120;

export type ChunkOptions = {
  size?: number;
  overlap?: number;
};

export function chunkDocumentText(
  text: string,
  options: ChunkOptions = {},
): KnowledgeChunkDraft[] {
  const size = Math.max(200, Math.min(options.size ?? DEFAULT_CHUNK_SIZE, 2000));
  const overlap = Math.max(0, Math.min(options.overlap ?? DEFAULT_CHUNK_OVERLAP, size - 50));
  const normalized = text.replace(/\r\n/g, '\n').trim();
  if (!normalized) return [];

  const sections = splitSections(normalized);
  const chunks: KnowledgeChunkDraft[] = [];
  let chunkIndex = 0;

  for (const section of sections) {
    const body = section.body;
    if (!body.trim()) continue;
    let start = 0;
    while (start < body.length) {
      let end = Math.min(start + size, body.length);
      if (end < body.length) {
        const slice = body.slice(start, end);
        const breakAt = Math.max(slice.lastIndexOf('\n\n'), slice.lastIndexOf('. '), slice.lastIndexOf('\n'));
        if (breakAt > size * 0.4) end = start + breakAt + 1;
      }
      const piece = body.slice(start, end).trim();
      if (piece) {
        const globalStart = section.charOffset + start;
        chunks.push({
          chunk_index: chunkIndex++,
          text: piece,
          page: section.page,
          section: section.title,
          char_start: globalStart,
          char_end: globalStart + piece.length,
          token_estimate: Math.ceil(piece.length / 4),
        });
      }
      if (end >= body.length) break;
      start = Math.max(end - overlap, start + 1);
    }
  }

  return chunks;
}

type Section = {
  title: string | null;
  page: number | null;
  body: string;
  charOffset: number;
};

function splitSections(text: string): Section[] {
  const pageSplit = text.split(/(?=^---\s*Page\s+\d+\s*---\s*$)/im);
  if (pageSplit.length > 1) {
    let offset = 0;
    return pageSplit.filter(Boolean).map((block) => {
      const m = block.match(/^---\s*Page\s+(\d+)\s*---\s*/i);
      const page = m ? Number(m[1]) : null;
      const body = m ? block.slice(m[0].length) : block;
      const section: Section = {
        title: page != null ? `Page ${page}` : null,
        page,
        body,
        charOffset: offset + (m ? m[0].length : 0),
      };
      offset += block.length;
      return section;
    });
  }

  const headingSplit = text.split(/(?=^#{1,3}\s+.+$)/m);
  if (headingSplit.length > 1) {
    let offset = 0;
    return headingSplit.filter(Boolean).map((block) => {
      const m = block.match(/^(#{1,3}\s+.+)$/m);
      const title = m ? m[1].replace(/^#+\s+/, '').trim() : null;
      const section: Section = {
        title,
        page: null,
        body: block,
        charOffset: offset,
      };
      offset += block.length;
      return section;
    });
  }

  return [{ title: null, page: null, body: text, charOffset: 0 }];
}
