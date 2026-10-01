/**
 * ERP connectivity smoke test — verifies the bot can reach Harvics OS.
 *
 * Run: HARVICS_API_BASE=https://www.harvics.com HARVICS_API_KEY=<key> npx tsx scripts/test-erp-connectivity.ts
 *
 * Without HARVICS_API_KEY the call will get 401 from requireAuthScope.
 * Without HARVICS_API_BASE it defaults to https://www.harvics.com.
 */
import { checkErpConnectivity } from '../lib/tools/delegate-to-erp';

const env = {
  HARVICS_API_BASE: process.env.HARVICS_API_BASE,
  HARVICS_API_KEY: process.env.HARVICS_API_KEY,
};

const result = await checkErpConnectivity(env);

if (result.ok) {
  console.log(`PASS  ERP reachable in ${result.latencyMs}ms`);
  console.log(`      Domains: ${result.domains.join(', ')}`);
  process.exit(0);
} else {
  console.error(`FAIL  ERP unreachable: ${result.error ?? 'unknown error'} (${result.latencyMs}ms)`);
  if (!env.HARVICS_API_KEY) {
    console.error('      Hint: set HARVICS_API_KEY=<INTERNAL_API_KEY value from harvics.com backend>');
  }
  process.exit(1);
}
