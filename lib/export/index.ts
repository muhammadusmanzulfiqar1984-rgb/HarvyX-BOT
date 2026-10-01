/**
 * Dependency-free document export (Workers-safe): txt, markdown, csv, pdf, docx, xlsx.
 * Office formats are written as uncompressed (STORE) zip containers.
 */

export type ExportFormatId = 'txt' | 'markdown' | 'csv' | 'pdf' | 'docx' | 'xlsx';

export type ExportInput = {
  title: string;
  markdown: string;
  plainText: string;
};

export type ExportResult = {
  kind: 'file';
  blob: Blob;
  filename: string;
  mime: string;
};

const MIME: Record<ExportFormatId, string> = {
  txt: 'text/plain; charset=utf-8',
  markdown: 'text/markdown; charset=utf-8',
  csv: 'text/csv; charset=utf-8',
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

const EXT: Record<ExportFormatId, string> = {
  txt: 'txt',
  markdown: 'md',
  csv: 'csv',
  pdf: 'pdf',
  docx: 'docx',
  xlsx: 'xlsx',
};

const utf8 = new TextEncoder();

function safeName(title: string): string {
  const base = title.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  return base || 'harvyx-export';
}

/** First markdown table as rows; otherwise one row per non-empty line. */
function toRows(markdown: string, plainText: string): string[][] {
  const tableLines = markdown.split('\n').filter((l) => /^\s*\|.*\|\s*$/.test(l));
  const rows = tableLines
    .filter((l) => !/^\s*\|[\s:|-]+\|\s*$/.test(l))
    .map((l) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim()));
  if (rows.length > 0) return rows;
  return plainText
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => [l]);
}

function toCsv(rows: string[][]): string {
  return rows
    .map((r) => r.map((c) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(','))
    .join('\r\n');
}

function xmlEscape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── PDF ─────────────────────────────────────────────────────────────────────

function wrap(line: string, width: number): string[] {
  if (line.length <= width) return [line];
  const out: string[] = [];
  let rest = line;
  while (rest.length > width) {
    let cut = rest.lastIndexOf(' ', width);
    if (cut <= 0) cut = width;
    out.push(rest.slice(0, cut));
    rest = rest.slice(cut).trimStart();
  }
  if (rest) out.push(rest);
  return out;
}

function pdfText(s: string): string {
  // Helvetica/WinAnsi covers Latin-1; anything else is replaced.
  return s
    .replace(/[^\x20-\xff]/g, '?')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function latin1Bytes(s: string): Uint8Array {
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0xff;
  return out;
}

function buildPdf(title: string, plainText: string): Uint8Array {
  const lines = [title, '', ...plainText.split('\n')].flatMap((l) => wrap(l, 95));
  const perPage = 54;
  const pages: string[][] = [];
  for (let i = 0; i < lines.length; i += perPage) pages.push(lines.slice(i, i + perPage));
  if (pages.length === 0) pages.push(['']);

  const objects: string[] = [];
  const pageIds: number[] = [];
  // 1 catalog, 2 pages, 3 font; then (content, page) pairs.
  pages.forEach((pageLines, i) => {
    const contentId = 4 + i * 2;
    const pageId = contentId + 1;
    pageIds.push(pageId);
    const body =
      'BT /F1 10 Tf 14 TL 50 800 Td\n' +
      pageLines.map((l) => `(${pdfText(l)}) Tj T*`).join('\n') +
      '\nET';
    objects[contentId] = `<< /Length ${body.length} >>\nstream\n${body}\nendstream`;
    objects[pageId] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] ` +
      `/Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`;
  });
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;
  objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';

  let out = '%PDF-1.4\n';
  const offsets: number[] = [];
  for (let id = 1; id < objects.length; id++) {
    offsets[id] = out.length;
    out += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xref = out.length;
  out += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id++) out += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return latin1Bytes(out);
}

// ── ZIP (STORE) ─────────────────────────────────────────────────────────────

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function zip(files: { name: string; data: string }[]): Uint8Array {
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  for (const f of files) {
    const name = utf8.encode(f.name);
    const data = utf8.encode(f.data);
    const crc = crc32(data);

    const local = new Uint8Array(30 + name.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, data.length, true);
    lv.setUint32(22, data.length, true);
    lv.setUint16(26, name.length, true);
    local.set(name, 30);

    const cd = new Uint8Array(46 + name.length);
    const cv = new DataView(cd.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, data.length, true);
    cv.setUint16(28, name.length, true);
    cv.setUint32(42, offset, true);
    cd.set(name, 46);

    chunks.push(local, data);
    central.push(cd);
    offset += local.length + data.length;
  }

  const cdSize = central.reduce((s, c) => s + c.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, cdSize, true);
  ev.setUint32(16, offset, true);

  const all = [...chunks, ...central, end];
  const out = new Uint8Array(all.reduce((s, c) => s + c.length, 0));
  let p = 0;
  for (const c of all) {
    out.set(c, p);
    p += c.length;
  }
  return out;
}

// ── DOCX ────────────────────────────────────────────────────────────────────

function buildDocx(title: string, markdown: string): Uint8Array {
  const para = (text: string, heading = false) =>
    `<w:p><w:r>${heading ? '<w:rPr><w:b/><w:sz w:val="32"/></w:rPr>' : ''}` +
    `<w:t xml:space="preserve">${xmlEscape(text)}</w:t></w:r></w:p>`;

  const body = [para(title, true)];
  for (const raw of markdown.split('\n')) {
    if (/^\s*\|[\s:|-]+\|\s*$/.test(raw)) continue;
    const heading = /^#{1,6}\s+/.test(raw);
    const text = raw
      .replace(/^#{1,6}\s+/, '')
      .replace(/^\s*\|(.*)\|\s*$/, (_m, inner: string) => inner.split('|').map((c) => c.trim()).join('\t'))
      .replace(/[*_`]/g, '');
    body.push(para(text, heading));
  }

  return zip([
    {
      name: '[Content_Types].xml',
      data:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
        '</Types>',
    },
    {
      name: '_rels/.rels',
      data:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
        '</Relationships>',
    },
    {
      name: 'word/document.xml',
      data:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' +
        body.join('') +
        '</w:body></w:document>',
    },
  ]);
}

// ── XLSX ────────────────────────────────────────────────────────────────────

function colName(i: number): string {
  let s = '';
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

function buildXlsx(rows: string[][]): Uint8Array {
  const sheetRows = rows
    .map(
      (r, ri) =>
        `<row r="${ri + 1}">` +
        r
          .map((c, ci) => `<c r="${colName(ci)}${ri + 1}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(c)}</t></is></c>`)
          .join('') +
        '</row>',
    )
    .join('');

  return zip([
    {
      name: '[Content_Types].xml',
      data:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
        '</Types>',
    },
    {
      name: '_rels/.rels',
      data:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
        '</Relationships>',
    },
    {
      name: 'xl/workbook.xml',
      data:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
        '<sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets></workbook>',
    },
    {
      name: 'xl/_rels/workbook.xml.rels',
      data:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
        '</Relationships>',
    },
    {
      name: 'xl/worksheets/sheet1.xml',
      data:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
        `<sheetData>${sheetRows}</sheetData></worksheet>`,
    },
  ]);
}

// ── Entry point ─────────────────────────────────────────────────────────────

export async function runExport(format: ExportFormatId, input: ExportInput): Promise<ExportResult> {
  let bytes: Uint8Array;
  switch (format) {
    case 'txt':
      bytes = utf8.encode(input.plainText);
      break;
    case 'markdown':
      bytes = utf8.encode(input.markdown);
      break;
    case 'csv':
      bytes = utf8.encode(toCsv(toRows(input.markdown, input.plainText)));
      break;
    case 'pdf':
      bytes = buildPdf(input.title, input.plainText);
      break;
    case 'docx':
      bytes = buildDocx(input.title, input.markdown);
      break;
    case 'xlsx':
      bytes = buildXlsx(toRows(input.markdown, input.plainText));
      break;
  }
  return {
    kind: 'file',
    blob: new Blob([bytes as BlobPart], { type: MIME[format] }),
    filename: `${safeName(input.title)}.${EXT[format]}`,
    mime: MIME[format],
  };
}
