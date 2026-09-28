/**
 * Attachment / file-output self-test.
 * Run: npx tsx scripts/test-attachments.ts
 */
import { generateAttachment } from '../lib/attachments/generate';
import {
  getAttachment,
  putAttachment,
  clearAttachmentCacheForTests,
} from '../lib/attachments/store';
import { saveAttachmentToDb, loadAttachmentFromDb } from '../lib/attachments/persist';
import { validateUpload, formatBytes } from '../lib/attachments/validate';
import {
  buildAgentAttachmentContext,
  extractUploadText,
} from '../lib/attachments/read-upload';
import {
  packMessageWithAttachments,
  parseUserMessage,
  scrubArtifactLabels,
} from '../lib/attachments/message-pack';
import { runExport } from '../lib/export';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`PASS ${label}`);
}
function fail(label: string, detail?: string): never {
  console.error(`FAIL ${label}${detail ? `: ${detail}` : ''}`);
  process.exit(1);
}

async function main() {
  // validate
  const bad = validateUpload({ name: 'x.exe', type: 'application/octet-stream', size: 10 });
  if (bad.ok) fail('reject exe');
  ok('reject unsupported upload type');

  const good = validateUpload({ name: 'notes.txt', type: 'text/plain', size: 12 });
  if (!good.ok) fail('accept txt', good.error);
  ok('accept txt upload');

  const huge = validateUpload({ name: 'big.txt', type: 'text/plain', size: 3 * 1024 * 1024 });
  if (huge.ok) fail('reject huge');
  ok('reject oversized upload');

  if (!formatBytes(248 * 1024).includes('KB')) fail('formatBytes');
  ok('formatBytes');

  // generate TXT / MD / DOCX / PDF
  const md = `# HarvyX Pipeline Report

## Summary
OPS gathered signals. ANALYST scored the funnel. MANAGER finalized.

| Stage | Count |
| --- | --- |
| Lead | 120 |
| Qualified | 48 |
`;

  for (const format of ['txt', 'markdown', 'docx', 'pdf'] as const) {
    const meta = await generateAttachment({
      title: 'HarvyX-Pipeline-Report',
      markdown: md,
      format,
      sourceAgent: 'TEAM → OPS → ANALYST → MANAGER',
      conversationId: 'team:test',
    });
    const row = getAttachment(meta.id);
    if (!row) fail(`store ${format}`);
    if (row.size <= 0) fail(`empty ${format}`);
    if (meta.sourceAgent !== 'TEAM → OPS → ANALYST → MANAGER') fail(`agent ${format}`);
    // magic checks
    const head = Buffer.from(row.bytes.slice(0, 8));
    if (format === 'pdf' && !head.toString('utf8').startsWith('%PDF')) fail('pdf magic');
    if (format === 'docx' && head[0] !== 0x50 /* P of PK */) fail('docx zip magic');
    ok(`generate+store ${format} (${formatBytes(meta.size)})`);
  }

  // secret scrub
  const scrubbed = await generateAttachment({
    title: 'sec',
    markdown: 'api_key=sk-secret-should-go\nBearer abc.def.ghi\nhello',
    format: 'txt',
  });
  const scrubBody = new TextDecoder().decode(getAttachment(scrubbed.id)!.bytes);
  if (scrubBody.includes('sk-secret-should-go') || scrubBody.includes('abc.def.ghi')) {
    fail('secret scrub', scrubBody.slice(0, 200));
  }
  ok('redact secrets in generated attachments');

  // upload text extract + agent context honesty
  const file = new File(['Quarterly pipeline notes: 48 qualified leads.'], 'pipeline.txt', {
    type: 'text/plain',
  });
  const extracted = await extractUploadText(file);
  if (!extracted.text.includes('48 qualified')) fail('extract txt');
  const ctx = buildAgentAttachmentContext([
    { name: file.name, size: file.size, text: extracted.text },
  ]);
  if (!ctx.includes('successfully received')) fail('context status');
  ok('upload extract + agent context');

  const missingCtx = buildAgentAttachmentContext([
    { name: 'empty.docx', size: 10, text: '', note: 'DOCX received but no readable text was extracted.' },
  ]);
  if (missingCtx.includes('successfully received')) fail('false claim on missing extract');
  if (!missingCtx.includes('no readable text')) fail('missing note');
  ok('no false claim when extract fails');

  // round-trip our own DOCX
  const docxExport = await runExport('docx', {
    title: 'Roundtrip',
    markdown: 'Alpha content for roundtrip.',
    plainText: 'Alpha content for roundtrip.',
  });
  if (docxExport.kind !== 'file') fail('docx export');
  const docxFile = new File([docxExport.blob], 'roundtrip.docx', {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
  const docxText = await extractUploadText(docxFile);
  if (!docxText.text.includes('Alpha content')) fail('docx extract', docxText.note || docxText.text);
  ok('DOCX generate → extract roundtrip');

  // message pack / UI scrub
  const packed = packMessageWithAttachments(
    'Summarize the attachment',
    [
      {
        id: '00000000-0000-4000-8000-000000000001',
        filename: 'pipeline.txt',
        mime: 'text/plain',
        size: 12,
        format: 'upload',
        url: '/api/attachments/00000000-0000-4000-8000-000000000001',
      },
    ],
    ctx,
  );
  const parsed = parseUserMessage(packed);
  if (parsed.displayText !== 'Summarize the attachment') fail('parse display', parsed.displayText);
  if (parsed.attachments.length !== 1) fail('parse attachments');
  if (parsed.displayText.includes('USER ATTACHMENTS')) fail('leaked ctx');
  ok('message pack hides agent context from UI');

  const scrubbedMd = scrubArtifactLabels('OUTPUT\n\n```svg\n<rect/>\n```\n\nHello');
  if (/\bOUTPUT\b/.test(scrubbedMd.split('\n')[0] || '')) fail('scrub OUTPUT');
  if (scrubbedMd.includes('```svg')) fail('scrub svg fence');
  ok('scrub OUTPUT/svg/canvas artifacts');

  // putAttachment opaque id — no path traversal
  const stored = putAttachment({
    filename: '../../../etc/passwd.txt',
    mime: 'text/plain',
    format: 'upload',
    bytes: new TextEncoder().encode('nope'),
  });
  if (stored.id.includes('/') || stored.id.includes('..')) fail('path in id');
  if (!getAttachment(stored.id)) fail('get by id');
  ok('opaque id store (no filesystem path exposure)');

  // Route handlers: generate + download + upload
  const { POST } = await import('../app/api/attachments/route');
  const { GET } = await import('../app/api/attachments/[id]/route');

  for (const format of ['txt', 'pdf', 'docx'] as const) {
    const res = await POST(
      new Request('http://local/api/attachments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'HarvyX-Pipeline-Report',
          markdown: md,
          format,
          sourceAgent: 'TEAM → OPS → ANALYST → MANAGER',
        }),
      }),
    );
    const body = (await res.json()) as { id: string; url: string; filename: string; error?: string };
    if (!res.ok) fail(`api generate ${format}`, body.error);
    const dl = await GET(new Request(`http://local${body.url}`), {
      params: Promise.resolve({ id: body.id }),
    });
    if (!dl.ok) fail(`api download ${format}`);
    const bytes = Buffer.from(await dl.arrayBuffer());
    if (bytes.length <= 0) fail(`api empty ${format}`);
    if (format === 'pdf' && !bytes.toString('utf8', 0, 4).startsWith('%PDF')) fail('api pdf magic');
    ok(`api ${format} generate+download (${formatBytes(bytes.length)})`);
  }

  const form = new FormData();
  form.append(
    'file',
    new File(['Summarize: ACME closed 3 deals this week.'], 'brief.txt', { type: 'text/plain' }),
  );
  const up = await POST(new Request('http://local/api/attachments', { method: 'POST', body: form }));
  const upBody = (await up.json()) as { id: string; url: string; error?: string };
  if (!up.ok) fail('api upload', upBody.error);
  const upGet = await GET(new Request(`http://local${upBody.url}`), {
    params: Promise.resolve({ id: upBody.id }),
  });
  const upText = Buffer.from(await upGet.arrayBuffer()).toString('utf8');
  if (!upText.includes('ACME')) fail('api upload content');
  ok('api upload+download');

  const badId = await GET(new Request('http://local/x'), {
    params: Promise.resolve({ id: '../../etc/passwd' }),
  });
  if (badId.status !== 400) fail('api reject path id', String(badId.status));
  ok('api reject path-like id');

  // D1 persistence mock — survives L1 cache clear (page reload simulation)
  const d1Rows = new Map<string, Record<string, unknown>>();
  const mockDb = {
    prepare(sql: string) {
      return {
        bind(...args: unknown[]) {
          return {
            async run() {
              if (/INSERT OR REPLACE/i.test(sql)) {
                d1Rows.set(String(args[0]), {
                  id: args[0],
                  filename: args[1],
                  mime: args[2],
                  format: args[3],
                  size: args[4],
                  source_agent: args[5],
                  conversation_id: args[6],
                  bytes: args[7],
                  created_at: args[8],
                  expires_at: args[9],
                });
              }
              if (/DELETE FROM attachments WHERE expires_at/i.test(sql)) {
                /* no-op in mock */
              }
              if (/DELETE FROM attachments WHERE id/i.test(sql)) {
                d1Rows.delete(String(args[0]));
              }
              return { success: true };
            },
            async first() {
              if (/SELECT/i.test(sql)) return d1Rows.get(String(args[0])) ?? null;
              return null;
            },
          };
        },
      };
    },
  } as unknown as D1Database;

  const durable = putAttachment({
    filename: 'survives-reload.pdf',
    mime: 'application/pdf',
    format: 'pdf',
    sourceAgent: 'TEAM → MANAGER',
    bytes: new TextEncoder().encode('%PDF-1.4 mock'),
  });
  const before = getAttachment(durable.id);
  if (!before) fail('durable mem');
  await saveAttachmentToDb(mockDb, before);
  clearAttachmentCacheForTests();
  if (getAttachment(durable.id)) fail('cache should be empty');
  const restored = await loadAttachmentFromDb(mockDb, durable.id);
  if (!restored) fail('d1 restore');
  if (restored.filename !== 'survives-reload.pdf') fail('d1 filename');
  if (new TextDecoder().decode(restored.bytes) !== '%PDF-1.4 mock') fail('d1 bytes');
  if (!getAttachment(durable.id)) fail('d1 should rehydrate L1');
  ok('D1 persist survives cache clear (reload)');

  console.log(`\n${passed} attachment tests passed`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
