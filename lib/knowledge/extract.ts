/**
 * Knowledge text extraction — PDF / DOCX / TXT / MD / CSV / XLSX (best-effort).
 * Failures return ok:false with an honest note (never fake content).
 */

import { createHash } from 'node:crypto';

export type ExtractResult =
  | {
      ok: true;
      text: string;
      checksum: string;
      meta: { extractor: string; pages?: number; sections?: string[]; notes?: string[] };
    }
  | { ok: false; error: string; checksum?: string };

const MAX_EXTRACT_CHARS = 500_000;

export function checksumBytes(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

export function extractKnowledgeText(
  bytes: Uint8Array,
  filename: string,
  mime: string,
): ExtractResult {
  const checksum = checksumBytes(bytes);
  const name = filename.toLowerCase();
  try {
    if (
      name.endsWith('.txt') ||
      name.endsWith('.md') ||
      name.endsWith('.markdown') ||
      name.endsWith('.csv') ||
      name.endsWith('.json') ||
      mime.startsWith('text/') ||
      mime === 'application/json'
    ) {
      const text = new TextDecoder('utf-8', { fatal: false })
        .decode(bytes)
        .replace(/\u0000/g, '')
        .slice(0, MAX_EXTRACT_CHARS);
      if (!text.trim()) return { ok: false, error: 'File contained no readable text.', checksum };
      return {
        ok: true,
        text: normalizeText(text),
        checksum,
        meta: { extractor: 'utf8' },
      };
    }

    if (name.endsWith('.docx') || mime.includes('wordprocessingml')) {
      const text = extractDocxText(bytes);
      if (!text.trim()) {
        return {
          ok: false,
          error:
            'DOCX received but no readable text extracted (deflated Office packages need store compression or a richer parser).',
          checksum,
        };
      }
      return {
        ok: true,
        text: normalizeText(text).slice(0, MAX_EXTRACT_CHARS),
        checksum,
        meta: { extractor: 'docx-store-zip' },
      };
    }

    if (name.endsWith('.xlsx') || mime.includes('spreadsheetml')) {
      const { text, sheets } = extractXlsxText(bytes);
      if (!text.trim()) {
        return {
          ok: false,
          error:
            'XLSX received but no readable text extracted (deflated packages unsupported without a ZIP inflater).',
          checksum,
        };
      }
      return {
        ok: true,
        text: normalizeText(text).slice(0, MAX_EXTRACT_CHARS),
        checksum,
        meta: { extractor: 'xlsx-store-zip', sections: sheets },
      };
    }

    if (name.endsWith('.pdf') || mime === 'application/pdf') {
      const { text, pages, notes } = extractPdfText(bytes);
      if (!text.trim()) {
        return {
          ok: false,
          error:
            notes[0] ||
            'PDF contained no extractable text (scanned/image PDFs and compressed streams are not supported).',
          checksum,
        };
      }
      return {
        ok: true,
        text: normalizeText(text).slice(0, MAX_EXTRACT_CHARS),
        checksum,
        meta: { extractor: 'pdf-basic', pages, notes },
      };
    }

    return { ok: false, error: `Unsupported knowledge type: ${filename || mime}`, checksum };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Extraction failed.',
      checksum,
    };
  }
}

function normalizeText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function extractDocxText(bytes: Uint8Array): string {
  const xml = readZipStoreEntry(bytes, 'word/document.xml');
  if (!xml) return '';
  return stripXmlText(xml);
}

function extractXlsxText(bytes: Uint8Array): { text: string; sheets: string[] } {
  const shared = readZipStoreEntry(bytes, 'xl/sharedStrings.xml');
  const strings = shared
    ? [...shared.matchAll(/<t[^>]*>([^<]*)<\/t>/g)].map((m) => decodeXml(m[1] || ''))
    : [];
  const sheets: string[] = [];
  const parts: string[] = [];
  for (let i = 1; i <= 20; i++) {
    const path = `xl/worksheets/sheet${i}.xml`;
    const sheet = readZipStoreEntry(bytes, path);
    if (!sheet) break;
    sheets.push(`sheet${i}`);
    const vals: string[] = [];
    for (const m of sheet.matchAll(/<v>([^<]*)<\/v>/g)) {
      const raw = m[1] || '';
      const idx = Number(raw);
      if (Number.isInteger(idx) && strings[idx] != null) vals.push(strings[idx]!);
      else vals.push(raw);
    }
    if (vals.length) parts.push(`## sheet${i}\n${vals.join(' | ')}`);
  }
  return { text: parts.join('\n\n'), sheets };
}

/** Best-effort PDF text from uncompressed streams / literal strings. */
function extractPdfText(bytes: Uint8Array): { text: string; pages?: number; notes: string[] } {
  const notes: string[] = [];
  const raw = new TextDecoder('latin1').decode(bytes);
  if (/\/Filter\s*\/FlateDecode/i.test(raw) && !/\((?:\\.|[^\\)]){8,}\)/.test(raw)) {
    notes.push('PDF uses FlateDecode streams; text extraction may be incomplete.');
  }

  const parts: string[] = [];
  // Literal strings inside (...)
  for (const m of raw.matchAll(/\((?:\\.|[^\\)]){2,}\)/g)) {
    const lit = m[0].slice(1, -1)
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\n')
      .replace(/\\t/g, '\t')
      .replace(/\\([()\\])/g, '$1');
    if (/[A-Za-z0-9]/.test(lit)) parts.push(lit);
  }
  // Tj / TJ operators with hex strings
  for (const m of raw.matchAll(/<([0-9A-Fa-f\s]+)>/g)) {
    const hex = m[1].replace(/\s+/g, '');
    if (hex.length < 4 || hex.length % 2) continue;
    let s = '';
    for (let i = 0; i < hex.length; i += 2) {
      const code = parseInt(hex.slice(i, i + 2), 16);
      if (code >= 32 && code < 127) s += String.fromCharCode(code);
    }
    if (s.length >= 2) parts.push(s);
  }

  const pageMatches = raw.match(/\/Type\s*\/Page[^s]/g);
  const pages = pageMatches ? pageMatches.length : undefined;
  const text = parts.join(' ').replace(/[^\S\n]+/g, ' ');
  if (!text.trim() && notes.length === 0) {
    notes.push('No extractable PDF text found.');
  }
  return { text, pages, notes };
}

function readZipStoreEntry(bytes: Uint8Array, entryName: string): string | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 0;
  while (offset + 30 <= bytes.length) {
    const sig = view.getUint32(offset, true);
    if (sig !== 0x04034b50) break;
    const method = view.getUint16(offset + 8, true);
    const compSize = view.getUint32(offset + 18, true);
    const nameLen = view.getUint16(offset + 26, true);
    const extraLen = view.getUint16(offset + 28, true);
    const nameStart = offset + 30;
    const name = new TextDecoder().decode(bytes.subarray(nameStart, nameStart + nameLen));
    const dataStart = nameStart + nameLen + extraLen;
    const dataEnd = dataStart + compSize;
    if (dataEnd > bytes.length) return null;
    if (name === entryName) {
      if (method !== 0) return null;
      return new TextDecoder('utf-8', { fatal: false }).decode(bytes.subarray(dataStart, dataEnd));
    }
    offset = dataEnd;
  }
  return null;
}

function stripXmlText(xml: string): string {
  return xml
    .replace(/<w:tab\/>/g, '\t')
    .replace(/<w:br\/>/g, '\n')
    .replace(/<w:p[^>]*>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+\n/g, '\n')
    .trim();
}

function decodeXml(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}
