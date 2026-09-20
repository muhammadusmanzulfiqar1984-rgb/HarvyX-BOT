/**
 * Focused model-router / Pareto registration tests (no secrets printed).
 * Run: node --experimental-strip-types scripts/test-model-router.mjs
 * or:  npx tsx scripts/test-model-router.ts
 */
import assert from 'node:assert/strict';
import {
  isParetoProvider,
  PARETO_MODEL_ID,
  resolveParetoModelId,
} from '../lib/models/pareto';
import { resolveSmartProviderLabel } from '../lib/models/router';
import { smartModel } from '../lib/models/smart';

let passed = 0;
function ok(name: string) {
  passed += 1;
  console.log(`PASS ${name}`);
}

assert.equal(PARETO_MODEL_ID, 'unbiased/pareto');
ok('model id is exactly unbiased/pareto');

assert.equal(resolveParetoModelId(), 'unbiased/pareto');
assert.equal(resolveParetoModelId('  unbiased/pareto  '), 'unbiased/pareto');
assert.notEqual(resolveParetoModelId(), '@cf/unbiased/pareto');
ok('resolveParetoModelId does not rewrite to @cf/');

assert.equal(isParetoProvider('pareto'), true);
assert.equal(isParetoProvider('cloudflare-pareto'), true);
assert.equal(isParetoProvider('cloudflare'), true);
assert.equal(isParetoProvider('nim'), false);
assert.equal(isParetoProvider('nebius'), false);
assert.equal(isParetoProvider(undefined), false);
ok('isParetoProvider aliases');

assert.equal(resolveSmartProviderLabel({ SMART_PROVIDER: 'pareto' }), 'cloudflare · unbiased/pareto');
assert.equal(resolveSmartProviderLabel({ SMART_PROVIDER: 'nebius' }), 'nebius');
assert.equal(resolveSmartProviderLabel({}), 'nvidia-nim');
ok('resolveSmartProviderLabel');

assert.throws(
  () =>
    smartModel({
      SMART_PROVIDER: 'pareto',
      NVIDIA_API_KEY: 'x',
      CLOUDFLARE_ACCOUNT_ID: 'acct',
    } as any),
  /CLOUDFLARE_API_TOKEN/,
);
ok('pareto requires token');

assert.throws(
  () =>
    smartModel({
      SMART_PROVIDER: 'pareto',
      NVIDIA_API_KEY: 'x',
      CLOUDFLARE_API_TOKEN: 'tok',
    } as any),
  /CLOUDFLARE_ACCOUNT_ID/,
);
ok('pareto requires account id');

// Factory constructs without network when env complete
const model = smartModel({
  SMART_PROVIDER: 'pareto',
  NVIDIA_API_KEY: 'unused',
  CLOUDFLARE_API_TOKEN: 'test-token-not-real',
  CLOUDFLARE_ACCOUNT_ID: 'c606ef34847cc91452c3e27a2a7a91e6',
});
assert.ok(model);
ok('paretoModel factory returns a model object');

// Default NIM path still works (no network)
const nim = smartModel({
  SMART_PROVIDER: 'nim',
  NVIDIA_API_KEY: 'test-nvidia-key',
});
assert.ok(nim);
ok('default nim provider preserved');

console.log(`\n${passed} registration tests passed`);
