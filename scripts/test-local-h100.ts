/**
 * local_h100 provider tests. No secrets used or printed.
 * Run: npx tsx scripts/test-local-h100.ts          (offline + live)
 *      H100_LIVE=0 npx tsx scripts/test-local-h100.ts  (offline only)
 */
import assert from 'node:assert/strict';
import { generateText, streamText } from 'ai';
import {
  isLocalH100Provider,
  LOCAL_H100_PROVIDER,
  localH100Model,
  resolveLocalH100Config,
} from '../lib/models/local-h100';
import {
  resolveManagerProvider,
  resolveModel,
  resolveSmartProviderLabel,
  resolveSmartProviderLogId,
} from '../lib/models/router';
import { smartModel } from '../lib/models/smart';
import {
  buildManagerRuntimeStatusBlock,
  createManagerAgent,
  resolveManagerModel,
  resolveManagerRuntimeStatus,
} from '../lib/agents/manager';

const H100 = {
  HARVYX_H100_BASE_URL: 'https://llm.harvics.com/v1',
  HARVYX_H100_MODEL: 'Qwen/Qwen3.5-35B-A3B-FP8',
};
// Dummy values for other providers: constructing models needs no network.
const BASE_ENV = {
  GROQ_API_KEY: 'test-groq-not-real',
  NVIDIA_API_KEY: 'test-nvidia-not-real',
  HARVYX_API_KEY: 'test-harvyx-not-real',
  HARVYX_API_BASE: 'https://example.invalid',
};
const EXPECTED = 'HARVYX H100 ONLINE';
const PROMPT = `Reply with exactly: ${EXPECTED}`;

let passed = 0;
const ok = (name: string) => {
  passed += 1;
  console.log(`PASS ${name}`);
};
const mid = (m: unknown) => m as { provider: string; modelId: string };

async function main() {
  // ---------- 1. provider registration ----------
  assert.equal(LOCAL_H100_PROVIDER, 'local_h100');
  assert.equal(isLocalH100Provider('local_h100'), true);
  assert.equal(isLocalH100Provider(' local_h100 '), true);
  for (const v of ['nim', 'nebius', 'pareto', 'groq', '', undefined]) {
    assert.equal(isLocalH100Provider(v), false);
  }
  assert.equal(resolveSmartProviderLabel({ SMART_PROVIDER: 'local_h100' }), 'local_h100');
  ok('1 provider registration');

  // ---------- 2. model resolution ----------
  assert.throws(() => resolveLocalH100Config({ HARVYX_H100_MODEL: 'x' }), /HARVYX_H100_BASE_URL/);
  assert.throws(() => resolveLocalH100Config({ HARVYX_H100_BASE_URL: 'x' }), /HARVYX_H100_MODEL/);
  const cfg = resolveLocalH100Config({ ...H100, HARVYX_H100_BASE_URL: H100.HARVYX_H100_BASE_URL + '/' });
  assert.equal(cfg.baseURL, 'https://llm.harvics.com/v1');
  assert.equal(cfg.enableThinking, false);
  assert.equal(resolveLocalH100Config({ ...H100, HARVYX_H100_ENABLE_THINKING: 'true' }).enableThinking, true);

  const viaSmart = mid(smartModel({ ...BASE_ENV, ...H100, SMART_PROVIDER: 'local_h100' }));
  assert.ok(viaSmart.provider.startsWith('local_h100'));
  assert.equal(viaSmart.modelId, H100.HARVYX_H100_MODEL);
  const viaExplicit = mid(resolveModel('fast', { ...BASE_ENV, ...H100 }, { provider: 'local_h100' }));
  assert.ok(viaExplicit.provider.startsWith('local_h100'));
  assert.equal(viaExplicit.modelId, H100.HARVYX_H100_MODEL);
  assert.throws(() => resolveModel('fast', BASE_ENV, { provider: 'bogus' as any }), /Unknown explicit/);
  ok('2 model resolution (smart tier + explicit override)');

  // ---------- 2b. existing defaults untouched ----------
  assert.ok(mid(resolveModel('fast', { ...BASE_ENV, ...H100 })).provider.startsWith('groq'));
  assert.ok(mid(smartModel({ ...BASE_ENV, ...H100 })).provider.startsWith('nim'));
  assert.equal(resolveSmartProviderLabel({}), 'nvidia-nim');
  assert.equal(resolveSmartProviderLogId({}), 'nvidia');
  assert.equal(resolveSmartProviderLogId({ SMART_PROVIDER: 'nebius' }), 'nebius');
  assert.equal(resolveSmartProviderLogId({ SMART_PROVIDER: 'pareto' }), 'cloudflare-pareto');
  assert.equal(resolveSmartProviderLogId({ SMART_PROVIDER: 'cloudflare' }), 'cloudflare-pareto');
  assert.equal(resolveSmartProviderLogId({ SMART_PROVIDER: 'local_h100' }), 'local_h100');
  ok('2b defaults unchanged: fast=Groq, smart=NIM, log ids identical');

  // ---------- 2c. thinking flag reaches the wire ----------
  const realFetch = globalThis.fetch;
  let sentBody: any;
  globalThis.fetch = (async (_u: any, init: any) => {
    sentBody = JSON.parse(init.body);
    return new Response(
      JSON.stringify({
        id: 'x', object: 'chat.completion', created: 0, model: H100.HARVYX_H100_MODEL,
        choices: [{ index: 0, message: { role: 'assistant', content: 'stub' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      }),
      { headers: { 'Content-Type': 'application/json' } },
    );
  }) as typeof fetch;
  try {
    await generateText({ model: localH100Model({ ...H100, HARVYX_H100_BASE_URL: 'https://stub.invalid/v1' }), prompt: 'x' });
  } finally {
    globalThis.fetch = realFetch;
  }
  assert.deepEqual(sentBody.chat_template_kwargs, { enable_thinking: false });
  assert.equal(sentBody.model, H100.HARVYX_H100_MODEL);
  ok('2c request body carries chat_template_kwargs.enable_thinking=false');

  // ---------- 5 (offline). Manager explicit selection ----------
  assert.equal(resolveManagerProvider(undefined), 'groq');
  assert.equal(resolveManagerProvider(''), 'groq');
  assert.equal(resolveManagerProvider('groq'), 'groq');
  assert.equal(resolveManagerProvider('local_h100'), 'local_h100');
  assert.throws(() => resolveManagerProvider('openai'), /Unknown MANAGER_PROVIDER/);
  const mgrEnv = { ...BASE_ENV, ...H100 } as any;
  assert.ok(mid(resolveManagerModel(mgrEnv)).provider.startsWith('groq'));
  assert.ok(mid(resolveManagerModel(mgrEnv, { provider: 'groq' })).provider.startsWith('groq'));
  const mgrH100 = mid(resolveManagerModel(mgrEnv, { provider: 'local_h100' }));
  assert.ok(mgrH100.provider.startsWith('local_h100'));
  assert.equal(mgrH100.modelId, H100.HARVYX_H100_MODEL);
  const rtH100 = resolveManagerRuntimeStatus(mgrEnv, { provider: 'local_h100' }, [
    'delegateToOps',
    'gmail',
  ]);
  assert.equal(rtH100.provider, 'local_h100');
  assert.equal(rtH100.modelId, H100.HARVYX_H100_MODEL);
  assert.equal(rtH100.onH100, true);
  assert.deepEqual(rtH100.availableTools, ['delegateToOps', 'gmail']);
  const rtGroq = resolveManagerRuntimeStatus(mgrEnv, { provider: 'groq' });
  assert.equal(rtGroq.provider, 'groq');
  assert.equal(rtGroq.onH100, false);
  assert.deepEqual(rtGroq.availableTools, []);
  const block = buildManagerRuntimeStatusBlock(rtH100);
  assert.ok(block.includes('RUNTIME ACCESS'));
  assert.ok(block.includes('Available tools: delegateToOps, gmail'));
  assert.ok(block.includes('Provider: local_h100'));
  assert.ok(block.includes(`Model: ${H100.HARVYX_H100_MODEL}`));
  assert.ok(block.includes('Running on HARVYX H100: yes'));
  assert.ok(block.includes('Do not volunteer provider/model/H100'));
  assert.ok(!/secret|api[_-]?key/i.test(block));
  ok('5a Manager: default=Groq, explicit local_h100 selects H100');

  if (process.env.H100_LIVE === '0') {
    console.log(`\n${passed} tests passed (live skipped)`);
    return;
  }

  // ---------- 3. live generateText ----------
  const model = localH100Model(H100);
  let t = Date.now();
  const gen = await generateText({ model, prompt: PROMPT, temperature: 0, maxOutputTokens: 50 });
  const genMs = Date.now() - t;
  console.log(`   generateText: ${JSON.stringify(gen.text.trim())} ${genMs}ms usage=${JSON.stringify(gen.usage)}`);
  assert.equal(gen.text.trim(), EXPECTED);
  assert.equal(gen.response.modelId, H100.HARVYX_H100_MODEL);
  ok('3 live generateText → exact response, model id confirmed by server');

  // ---------- 4. live streamText ----------
  t = Date.now();
  let firstMs = -1;
  let chunks = 0;
  let streamed = '';
  const st = streamText({ model, prompt: PROMPT, temperature: 0, maxOutputTokens: 50 });
  for await (const part of st.textStream) {
    if (firstMs < 0) firstMs = Date.now() - t;
    chunks += 1;
    streamed += part;
  }
  console.log(`   streamText: ${JSON.stringify(streamed.trim())} chunks=${chunks} ttft=${firstMs}ms total=${Date.now() - t}ms`);
  assert.ok(chunks > 1, 'expected multiple stream chunks');
  assert.equal(streamed.trim(), EXPECTED);
  ok('4 live streamText → multi-chunk stream, exact response');

  // ---------- 5 (live). Manager agent end-to-end on H100 ----------
  const manager = createManagerAgent(mgrEnv, { provider: 'local_h100' });
  t = Date.now();
  const res = await manager.generate({ prompt: PROMPT });
  const toolCalls = res.steps.flatMap((s: any) => s.toolCalls ?? []).length;
  console.log(`   Manager: ${JSON.stringify(res.text.trim())} ${Date.now() - t}ms steps=${res.steps.length} toolCalls=${toolCalls} model=${res.response.modelId}`);
  assert.equal(res.text.trim(), EXPECTED);
  assert.equal(res.response.modelId, H100.HARVYX_H100_MODEL);
  ok('5b live Manager (explicit local_h100) answered via H100');

  console.log(`\n${passed} tests passed`);
}

main().catch((err) => {
  console.error('FAIL', err instanceof Error ? err.message : err);
  process.exit(1);
});
