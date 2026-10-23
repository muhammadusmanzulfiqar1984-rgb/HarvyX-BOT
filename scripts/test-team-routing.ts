/**
 * MIAN Team Routing tests — verifies intent classification sends the right
 * message to the right specialist bot.
 *
 * Run: npx tsx scripts/test-team-routing.ts
 */
import assert from 'node:assert/strict';
import { classifyIntent, routeMessage } from '../lib/bots/routing';

let passed = 0;
function ok(name: string) {
  passed += 1;
  console.log(`PASS ${name}`);
}

// ── 1. CRM / OPS routing ──────────────────────────────────────────────────────
assert.equal(routeMessage('Show me my top leads this week'), 'ops');
assert.equal(routeMessage('Add a new contact: Sarah Khan, CFO at Acme'), 'ops');
assert.equal(routeMessage('How many deals are in my pipeline?'), 'ops');
assert.equal(routeMessage('Search HARVYX CRM for contacts in Dubai'), 'ops');
assert.equal(routeMessage('Start a campaign for our new product launch'), 'ops');
ok('CRM messages → ops');

// ── 2. Analyst / reasoning routing ───────────────────────────────────────────
assert.equal(routeMessage('Analyze our Q3 revenue trend'), 'analyst');
assert.equal(routeMessage('Draft a business proposal for our GCC expansion'), 'analyst');
assert.equal(routeMessage('Why did our margin drop last month?'), 'analyst');
assert.equal(routeMessage('Write a research summary on textile trade routes'), 'analyst');
assert.equal(routeMessage('Summarize the key risks in this deal'), 'analyst');
ok('Research/draft messages → analyst');

// ── 3. Social routing ─────────────────────────────────────────────────────────
assert.equal(routeMessage('Write a LinkedIn post about our new FMCG product'), 'social');
assert.equal(routeMessage('What hashtags should I use on Instagram for this launch?'), 'social');
assert.equal(routeMessage('Draft a tweet thread about Harvics expanding to GCC'), 'social');
assert.equal(routeMessage('Best time to post on TikTok for B2B audience'), 'social');
ok('Social media messages → social');

// ── 4. Scrape routing ─────────────────────────────────────────────────────────
assert.equal(routeMessage('Fetch the content from https://example.com/pricing'), 'scrape');
assert.equal(routeMessage('Scrape the product list from that supplier website'), 'scrape');
assert.equal(routeMessage('Get the text from this url: https://trade.gov/data'), 'scrape');
ok('Web fetch messages → scrape');

// ── 5. MIAN answers directly (no delegation) ─────────────────────────────────
assert.equal(routeMessage('Hello, what can you do?'), null);
assert.equal(routeMessage('What is HARVYX-BOT?'), null);
assert.equal(routeMessage('Who built you?'), null);
assert.equal(routeMessage('What time is it in Dubai?'), null);
ok('Generic questions → MIAN answers directly (null)');

// ── 6. Confidence scores ──────────────────────────────────────────────────────
const strongOps = classifyIntent('Search my CRM pipeline for all leads and contacts in Dubai');
assert.ok(strongOps.confidence > 0.5, `expected confidence > 0.5, got ${strongOps.confidence}`);
assert.equal(strongOps.delegate, 'ops');

const weakSignal = classifyIntent('hi');
assert.equal(weakSignal.delegate, null);
assert.equal(weakSignal.confidence, 0);
ok('Confidence scoring');

// ── 7. Tie-breaking: ops beats analyst when equal score ───────────────────────
// "report" (analyst) + "leads" (ops) → tie → ops wins by priority
const tied = classifyIntent('Give me a report on my leads');
assert.equal(tied.delegate, 'ops');
ok('Tie-break: ops priority over analyst');

// ── 8. classifyIntent reason string ──────────────────────────────────────────
const result = classifyIntent('Scrape this page: https://example.com');
assert.ok(result.reason.includes('scrape'), `reason should mention 'scrape': ${result.reason}`);
ok('classifyIntent reason string');

// ── 9. Routing is case-insensitive ────────────────────────────────────────────
assert.equal(routeMessage('CHECK MY PIPELINE'), 'ops');
assert.equal(routeMessage('ANALYZE OUR REVENUE'), 'analyst');
assert.equal(routeMessage('POST ON LINKEDIN'), 'social');
ok('Case-insensitive routing');

// ── 10. Multi-signal: strongest domain wins ───────────────────────────────────
// Heavy social signal beats single analyst word
assert.equal(
  routeMessage('Draft an Instagram caption with hashtags for our LinkedIn content calendar'),
  'social',
);
ok('Multi-signal: strongest domain wins');

console.log(`\n${passed} routing tests passed ✓`);
console.log('\nMIAN routing is wired. Every user message has a deterministic path.');
