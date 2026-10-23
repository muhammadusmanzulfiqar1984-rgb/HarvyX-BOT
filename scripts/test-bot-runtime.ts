/**
 * Bot Runtime Phase 2 — end-to-end wiring tests (no live network/provider calls).
 * Run: npx tsx scripts/test-bot-runtime.ts
 */
import assert from 'node:assert/strict';
import {
  BotRegistryError,
  assertBotMayPerform,
  botRequiresApproval,
  createBotRegistryFromDefinitions,
  DELEGATE_TARGET_SLUG,
  getBotDefinition,
  getCanonicalBot,
  requireRunnableBot,
  resetBotRegistryForTests,
  resolveBotModel,
  resolveBotParticleAgent,
  selectBotTools,
} from '../lib/bots';
import { createManagerAgent } from '../lib/agents/manager';
import { createOpsAgent } from '../lib/agents/ops-agent';
import { createAnalystAgent } from '../lib/agents/analyst-agent';
import { createSocialAgent } from '../lib/agents/social-agent';
import { createScrapeAgent } from '../lib/agents/scrape-agent';
import { hasAgent, registerDefaultAgents } from '../lib/living-particle';
import { checkSendApproval, createApprovalGate } from '../lib/policy/approval';
import type { ModelMessage } from 'ai';

let passed = 0;
function ok(name: string) {
  passed += 1;
  console.log(`PASS ${name}`);
}

resetBotRegistryForTests();
registerDefaultAgents();

const env = {
  GROQ_API_KEY: 'test',
  NVIDIA_API_KEY: 'test',
  HARVYX_API_KEY: 'test',
  HARVYX_API_BASE: 'https://example.invalid',
} as never;

// A. User → Manager works (factory constructs from registry)
const manager = createManagerAgent(env);
assert.ok(manager);
assert.equal(getBotDefinition('mian').slug, 'mian');
ok('User → Manager resolves via registry (slug mian preserved)');

// B–E. Manager → specialist factories
assert.ok(createOpsAgent(env));
assert.ok(createAnalystAgent(env));
assert.ok(createScrapeAgent(env));
assert.ok(createSocialAgent(env));
assert.equal(DELEGATE_TARGET_SLUG.delegateToOps, 'ops');
assert.equal(DELEGATE_TARGET_SLUG.delegateToAnalyst, 'analyst');
assert.equal(DELEGATE_TARGET_SLUG.delegateToScrape, 'scrape');
assert.equal(DELEGATE_TARGET_SLUG.delegateToSocial, 'social');
ok('Manager → OPS/Analyst/Scrape/Social factories construct');

// F. Bot definition resolves
for (const slug of ['mian', 'ops', 'analyst', 'scrape', 'social'] as const) {
  assert.equal(requireRunnableBot(slug).slug, slug);
  assert.equal(getBotDefinition(slug).status, 'active');
}
ok('Bot definition resolves correctly');

// G. Model policy reaches Model Router
const opsModel = resolveBotModel('ops', env);
assert.ok(opsModel);
const analystModel = resolveBotModel(getBotDefinition('analyst'), env);
assert.ok(analystModel);
assert.equal(getBotDefinition('ops').modelPolicy.tier, 'fast');
assert.equal(getBotDefinition('analyst').modelPolicy.tier, 'reasoning');
// Disallowed provider must fail closed
assert.throws(
  () => resolveBotModel('ops', env, { provider: 'local_h100' }),
  /not allowed/,
);
ok('Model policy reaches Model Router');

// H. Tool capability restrictions
const mian = getBotDefinition('mian');
const fakePack = {
  delegateToOps: 1,
  delegateToAnalyst: 2,
  gmail: 3,
  forbiddenTool: 99,
};
const selected = selectBotTools(mian, fakePack);
assert.equal(selected.delegateToOps, 1);
assert.equal(selected.gmail, 3);
assert.equal(selected.forbiddenTool, undefined);
const ops = getBotDefinition('ops');
const harvyxPack = { harvyxGetStats: 'a', harvyxListLeads: 'b' };
assert.deepEqual(selectBotTools(ops, harvyxPack), harvyxPack);
ok('Tool capability restrictions are respected');

// I. Permission/approval
assert.equal(botRequiresApproval(mian, 'gmail.send_email'), true);
assert.equal(botRequiresApproval(mian, 'gmail.search_emails'), false);
assert.equal(assertBotMayPerform(mian, 'gmail.send_email').ok, true);
const denied = assertBotMayPerform(
  { ...mian, permissions: { ...mian.permissions, allowedActions: ['read'] } },
  'gmail.send_email',
);
assert.equal(denied.ok, false);
const gate = createApprovalGate(1);
const noApprove = checkSendApproval(
  [{ role: 'user', content: 'send it please' }] as ModelMessage[],
  gate,
);
assert.equal(noApprove.ok, false);
const yes = checkSendApproval(
  [{ role: 'user', content: 'I approve — please send' }] as ModelMessage[],
  createApprovalGate(1),
);
assert.equal(yes.ok, true);
ok('Permission/approval is respected');

// J–L. Structural path: tools on manager include delegates; specialists exist
// (full stream tested via browser; here we prove wiring, not mocked replies)
const toolNames = Object.keys(
  // peep via selectBotTools what manager would expose
  selectBotTools(mian, {
    delegateToOps: true,
    delegateToAnalyst: true,
    delegateToSocial: true,
    delegateToScrape: true,
    gmail: true,
    harvyxSend: true,
    calendar: true,
  }),
);
assert.ok(toolNames.includes('delegateToOps'));
assert.ok(toolNames.includes('delegateToAnalyst'));
assert.ok(toolNames.includes('delegateToScrape'));
assert.ok(toolNames.includes('delegateToSocial'));
ok('Tool result path wired (Manager tools include specialists + connectors)');

// M. Unknown bot fails
assert.throws(() => requireRunnableBot('nope'), BotRegistryError);
assert.throws(() => getBotDefinition('nope'), /Unknown bot/);
ok('Unknown bot fails correctly');

// N. Model failure / non-runnable follows existing behavior
const pausedReg = createBotRegistryFromDefinitions();
pausedReg.pause('ops');
assert.throws(() => {
  // requireRunnableBot uses process singleton — update singleton
  resetBotRegistryForTests(pausedReg);
  requireRunnableBot('ops');
}, /not runnable/);
resetBotRegistryForTests();
assert.throws(() => requireRunnableBot('harvyx-code'), /not runnable/);
ok('Model/status failure follows existing fallback behavior');

// O. Particle identity still resolves (presentation only)
assert.equal(resolveBotParticleAgent('mian'), 'manager');
assert.ok(hasAgent('manager'));
assert.ok(hasAgent('ops'));
assert.ok(hasAgent('analyst'));
assert.ok(hasAgent('scrape'));
assert.ok(hasAgent('social'));
ok('Particle identity resolves without coupling to model execution');

console.log(`\n${passed} bot-runtime tests passed`);
