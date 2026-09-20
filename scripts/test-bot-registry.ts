/**
 * Bot Registry Phase 0 tests — canonical records + factory wiring (no secrets).
 * Run: npx tsx scripts/test-bot-registry.ts
 */
import assert from 'node:assert/strict';
import {
  ANALYST_INSTRUCTIONS,
  BOT_IDS,
  CANONICAL_BOTS,
  MIAN_INSTRUCTIONS,
  OPS_INSTRUCTIONS,
  getCanonicalBot,
} from '../lib/bots/definitions';
import { getBotDefinition } from '../lib/bots/registry';
import { createManagerAgent } from '../lib/agents/manager';
import { createOpsAgent } from '../lib/agents/ops-agent';
import { createAnalystAgent } from '../lib/agents/analyst-agent';

let passed = 0;
function ok(name: string) {
  passed += 1;
  console.log(`PASS ${name}`);
}

assert.equal(CANONICAL_BOTS.length, 3);
assert.ok(getCanonicalBot('mian'));
assert.ok(getCanonicalBot('ops'));
assert.ok(getCanonicalBot('analyst'));
assert.equal(getCanonicalBot('mian')?.id, BOT_IDS.mian);
ok('three canonical bots with stable ids');

assert.equal(getBotDefinition('ops').toolPack, 'harvyx');
assert.equal(getBotDefinition('analyst').toolPack, 'none');
assert.equal(getBotDefinition('mian').toolPack, 'delegate');
assert.equal(getBotDefinition('ops').modelTier, 'fast');
assert.equal(getBotDefinition('analyst').modelTier, 'reasoning');
ok('tool packs and model tiers');

assert.equal(getBotDefinition('mian').instructions, MIAN_INSTRUCTIONS);
assert.equal(getBotDefinition('ops').instructions, OPS_INSTRUCTIONS);
assert.equal(getBotDefinition('analyst').instructions, ANALYST_INSTRUCTIONS);
assert.ok(MIAN_INSTRUCTIONS.includes('You are MIAN'));
assert.ok(OPS_INSTRUCTIONS.includes('harvyxGetStats'));
assert.ok(ANALYST_INSTRUCTIONS.includes('deep reasoning'));
ok('instructions preserved verbatim');

const env = {
  GROQ_API_KEY: 'test',
  NVIDIA_API_KEY: 'test',
  HARVYX_API_KEY: 'test',
} as any;

assert.ok(createManagerAgent(env));
assert.ok(createOpsAgent(env));
assert.ok(createAnalystAgent(env));
ok('factories construct from registry definitions');

console.log(`\n${passed} bot-registry tests passed`);
