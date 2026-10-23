/** Extract safe text context from an uploaded file for the agent. */

export async function extractUploadText(
  file: File,
): Promise<{ text: string; note?: string }> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.docx')) {
    const buf = new Uint8Array(await file.arrayBuffer());
    const text = extractDocxText(buf);
    if (!text.trim()) {
      return {
        text: '',
        note: 'DOCX received but no readable text was extracted (deflated Office files may need store compression).',
      };
    }
    return { text: text.slice(0, 40_000) };
  }

  const text = await file.text();
  return { text: text.slice(0, 40_000) };
}

function extractDocxText(bytes: Uint8Array): string {
  const xml = readZipEntry(bytes, 'word/document.xml');
  if (!xml) return '';
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

/** Read an uncompressed (store) ZIP local file entry by name. */
function readZipEntry(bytes: Uint8Array, entryName: string): string | null {
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
      if (method !== 0) return null; // deflate unsupported without dependency
      return new TextDecoder('utf-8').decode(bytes.subarray(dataStart, dataEnd));
    }
    offset = dataEnd;
  }
  return null;
}

export function buildAgentAttachmentContext(
  files: { name: string; size: number; text: string; note?: string }[],
): string {
  if (!files.length) return '';
  const blocks = files.map((f) => {
    const header = `Attached file: ${f.name} (${f.size} bytes)`;
    if (f.note && !f.text) return `${header}\nStatus: ${f.note}`;
    return (
      `${header}\n` +
      `Status: successfully received and text extracted for analysis.\n` +
      `----- BEGIN FILE CONTENT -----\n` +
      `${f.text}\n` +
      `----- END FILE CONTENT -----`
    );
  });
  return (
    'USER ATTACHMENTS (treat as source material; do not claim you read a file that is missing):\n\n' +
    blocks.join('\n\n')
  );
}
