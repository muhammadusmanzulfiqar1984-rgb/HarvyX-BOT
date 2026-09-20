/**
 * Compatibility entry: `import … from '../tools/harvyx'` resolves to this file
 * when both `harvyx.ts` and `harvyx/` exist. Re-exports the folder connector.
 */
export type { HarvyxEnv, LeadStatus } from './harvyx/client';
export {
  HarvyxConnectorError,
  DEFAULT_LEAD_LIMIT,
  MAX_LEAD_LIMIT,
  MAX_CAMPAIGN_LEAD_IDS,
  MAX_DISCOVER_LIMIT,
  LEAD_STATUSES,
} from './harvyx/client';
export { harvyxTools } from './harvyx/tools';
