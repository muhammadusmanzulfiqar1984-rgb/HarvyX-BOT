/**
 * Bot Registry Phase 1 tests — canonical BotDefinition + registry + particle refs.
 * Run: npx tsx scripts/test-bot-registry.ts
 */
import assert from 'node:assert/strict';
import {
  ANALYST_INSTRUCTIONS,
  BOT_IDS,
  BOT_LIFECYCLE_STATUSES,
  CANONICAL_BOTS,
  MIAN_INSTRUCTIONS,
  OPS_INSTRUCTIONS,
  BotRegistryError,
  createBotRegistryFromDefinitions,
  getBotDefinition,
  getBotRegistry,
  getBotVisual,
  getCanonicalBot,
  normalizeBotStatus,
  resetBotRegistryForTests,
  resolveBotParticleAgent,
} from '../lib/bots';
import { createManagerAgent } from '../lib/agents/manager';
import { createOpsAgent } from '../lib/agents/ops-agent';
import { createAnalystAgent } from '../lib/agents/analyst-agent';
import {
  getAgent,
  hasAgent,
  listAgents,
  registerDefaultAgents,
  resolveAgentId,
} from '../lib/living-particle';

let passed = 0;
function ok(name: string) {
  passed += 1;
  console.log(`PASS ${name}`);
}

// Fresh singleton for deterministic tests
resetBotRegistryForTests();
registerDefaultAgents();

// ── 1. Registry initialization ───────────────────────────────────────────────
const registry = getBotRegistry();
assert.ok(registry);
assert.equal(typeof registry.list, 'function');
ok('registry initialization');

// ── 2. Five default bots registered ──────────────────────────────────────────
assert.equal(CANONICAL_BOTS.length, 5);
const active = registry.list({ status: 'active' });
assert.equal(active.length, 5);
assert.deepEqual(
  active.map((b) => b.slug).sort(),
  ['analyst', 'mian', 'ops', 'scrape', 'social'].sort(),
);
ok('five default bots registered');

// ── 3–7. get(manager/ops/analyst/scrape/social) ───────────────────────────────
assert.equal(registry.get('mian')?.visual.particleAgent, 'manager');
assert.equal(registry.require('ops').visual.symbol, 'horse');
assert.equal(registry.require('analyst').visual.symbol, 'owl');
assert.equal(registry.require('scrape').visual.symbol, 'falcon');
assert.equal(registry.require('social').visual.symbol, 'hummingbird');
assert.equal(getBotDefinition('mian').id, BOT_IDS.mian);
assert.equal(getCanonicalBot('ops')?.toolPack, 'harvyx');
ok('get(manager/ops/analyst/scrape/social)');

// ── 8. list() ────────────────────────────────────────────────────────────────
const all = registry.list();
assert.ok(all.length >= 5);
assert.ok(all.some((b) => b.slug === 'harvyx-code' && b.status === 'planned'));
ok('list()');

// ── 9. status validation ─────────────────────────────────────────────────────
assert.deepEqual([...BOT_LIFECYCLE_STATUSES], [
  'draft',
  'testing',
  'active',
  'paused',
  'archived',
]);
assert.equal(normalizeBotStatus('disabled'), 'paused');
assert.equal(normalizeBotStatus('planned'), 'planned');
assert.equal(registry.require('mian').status, 'active');
const paused = registry.pause('ops');
assert.equal(paused.status, 'paused');
const reactivated = registry.activate('ops');
assert.equal(reactivated.status, 'active');
assert.throws(() => registry.update('ops', { status: 'nope' as never }), BotRegistryError);
ok('status validation');

// ── 10. version validation ───────────────────────────────────────────────────
assert.ok(CANONICAL_BOTS.every((b) => b.version === 1));
const v2 = registry.update('analyst', { version: 2, description: 'v2' });
assert.equal(v2.version, 2);
assert.throws(() => registry.update('analyst', { version: 1 }), /version must be >=/);
resetBotRegistryForTests();
ok('version validation');

// ── 11. visual particle reference ────────────────────────────────────────────
assert.equal(resolveBotParticleAgent('mian'), 'manager');
assert.equal(resolveBotParticleAgent('ops'), 'ops');
assert.equal(getBotVisual('scrape')?.particleAgent, 'scrape');
assert.equal(getBotVisual('social')?.motionProfile, 'hummingbird-hover');
ok('visual particle reference');

// ── 12. model policy validation ──────────────────────────────────────────────
const manager = getBotDefinition('mian');
assert.equal(manager.modelPolicy.tier, 'fast');
assert.equal(manager.modelTier, manager.modelPolicy.tier);
assert.equal(getBotDefinition('analyst').modelPolicy.tier, 'reasoning');
assert.ok(manager.modelPolicy.routingPolicy?.allowedProviders?.includes('groq'));
assert.throws(
  () =>
    createBotRegistryFromDefinitions([
      {
        ...getCanonicalBot('ops')!,
        id: 'dup-test',
        slug: 'dup-test-ops',
        modelTier: 'fast',
        modelPolicy: { tier: 'reasoning' },
      },
    ]),
  /modelTier must match/,
);
ok('model policy validation');

// ── 13. duplicate bot ID rejection ───────────────────────────────────────────
const fresh = createBotRegistryFromDefinitions();
assert.throws(() => fresh.register(getCanonicalBot('mian')!), /Duplicate bot id/);
ok('duplicate bot ID rejection');

// ── 14. unknown bot lookup ───────────────────────────────────────────────────
assert.equal(registry.get('no-such-bot'), undefined);
assert.throws(() => getBotDefinition('no-such-bot'), /Unknown bot/);
ok('unknown bot lookup');

// ── 15. existing particle agents still resolve ───────────────────────────────
assert.ok(hasAgent('manager'));
assert.ok(hasAgent('mian')); // alias
assert.equal(resolveAgentId('mian'), 'manager');
assert.equal(getAgent('ops')?.symbol, 'realistic-horse');
assert.equal(getAgent('analyst')?.zoneModel, 'owl');
assert.equal(getAgent('scrape')?.behavior.animation, 'falcon-flight');
assert.equal(getAgent('social')?.behavior.animation, 'hummingbird-hover');
assert.equal(listAgents().length, 5);
for (const bot of CANONICAL_BOTS) {
  assert.ok(
    hasAgent(bot.visual.particleAgent),
    `particle missing for ${bot.slug} → ${bot.visual.particleAgent}`,
  );
}
ok('existing particle agents still resolve correctly');

// ── Legacy agent wiring (unchanged runtime) ──────────────────────────────────
assert.equal(getBotDefinition('ops').toolPack, 'harvyx');
assert.equal(getBotDefinition('analyst').toolPack, 'none');
assert.equal(getBotDefinition('mian').toolPack, 'delegate');
assert.equal(getBotDefinition('ops').modelTier, 'fast');
assert.equal(getBotDefinition('analyst').modelTier, 'reasoning');
assert.equal(getBotDefinition('mian').instructions, MIAN_INSTRUCTIONS);
assert.equal(getBotDefinition('ops').instructions, OPS_INSTRUCTIONS);
assert.equal(getBotDefinition('analyst').instructions, ANALYST_INSTRUCTIONS);
assert.ok(MIAN_INSTRUCTIONS.includes('You are HARVYX'));
assert.ok(!/Mian Muhammad Usman|\bMMU\b/i.test(MIAN_INSTRUCTIONS));

const env = {
  GROQ_API_KEY: 'test',
  NVIDIA_API_KEY: 'test',
  HARVYX_API_KEY: 'test',
} as never;

assert.ok(createManagerAgent(env));
assert.ok(createOpsAgent(env));
assert.ok(createAnalystAgent(env));
ok('factories construct from registry definitions');

// Permissions reference existing approval-gated tools (schema only — no new auth system)
assert.ok(getBotDefinition('mian').permissions.requiresApproval?.includes('gmail.send_email'));
assert.equal(getBotDefinition('mian').behavior.approvalPolicy, 'strict');
ok('permissions + approval policy schema');

console.log(`\n${passed} bot-registry tests passed`);
