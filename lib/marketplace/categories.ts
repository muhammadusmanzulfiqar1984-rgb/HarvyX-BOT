import type { MarketplaceCategoryId } from './types';

export type MarketplaceCategory = {
  id: MarketplaceCategoryId;
  name: string;
  description: string;
};

export const MARKETPLACE_CATEGORIES: readonly MarketplaceCategory[] = [
  { id: 'presentations', name: 'Presentations', description: 'Slide decks and pitch materials.' },
  { id: 'documents', name: 'Documents', description: 'Docs, reports, and PDFs.' },
  { id: 'spreadsheets', name: 'Spreadsheets', description: 'Tables, models, and sheets.' },
  { id: 'design', name: 'Design', description: 'Visual design and creative tools.' },
  { id: 'research', name: 'Research', description: 'Search, scrape, knowledge, deep research.' },
  { id: 'communication', name: 'Communication', description: 'Email, chat, and messaging.' },
  { id: 'meetings', name: 'Meetings', description: 'Calendar and video meetings.' },
  { id: 'crm', name: 'CRM & Sales', description: 'Pipeline, leads, and sales systems.' },
  { id: 'marketing', name: 'Marketing', description: 'Campaigns and outreach.' },
  { id: 'development', name: 'Development', description: 'Code hosts and engineering tools.' },
  { id: 'data', name: 'Data', description: 'Databases and analytics.' },
  { id: 'storage', name: 'Storage', description: 'Cloud file storage.' },
  { id: 'automation', name: 'Automation', description: 'Webhooks, schedules, HTTP.' },
  { id: 'ai', name: 'AI Models', description: 'Model providers and local inference.' },
  { id: 'media', name: 'Media', description: 'Image, video, audio, speech.' },
  { id: 'commerce', name: 'Commerce', description: 'Commerce platforms.' },
  { id: 'finance', name: 'Finance', description: 'Finance and billing tools.' },
  { id: 'web', name: 'Web', description: 'HTTP and public web capabilities.' },
  { id: 'harvyx', name: 'HARVYX', description: 'HARVYX CRM and business data (external API).' },
  { id: 'internal', name: 'Internal', description: 'Safe internal / mock providers.' },
] as const;

export function categoryById(id: string): MarketplaceCategory | undefined {
  return MARKETPLACE_CATEGORIES.find((c) => c.id === id);
}
