/**
 * HarvYX connector — single BOT-side boundary to the HarvYX SaaS HTTP API.
 * Does not own HarvYX data or business logic.
 */
export type { HarvyxEnv, LeadStatus } from './client';
export {
  HarvyxConnectorError,
  DEFAULT_LEAD_LIMIT,
  MAX_LEAD_LIMIT,
  MAX_CAMPAIGN_LEAD_IDS,
  LEAD_STATUSES,
} from './client';
export { harvyxTools } from './tools';
