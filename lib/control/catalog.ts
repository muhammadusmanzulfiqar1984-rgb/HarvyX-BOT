/**
 * Static catalog of the plugins HARVYX-BOT actually ships. Capability ids match
 * lib/policy/classes ACTION_TABLE keys so approval rules join cleanly.
 */

export type PluginCapability = {
  id: string;
  label: string;
  available: boolean;
  note?: string;
};

export type Plugin = {
  id: string;
  name: string;
  description: string;
  /** connector = needs an account linked by the user; internal = works with server config only. */
  kind: 'connector' | 'internal';
  /** Status endpoint for connector plugins. */
  statusUrl?: string;
  capabilities: PluginCapability[];
};

export const PLUGINS: Plugin[] = [
  {
    id: 'harvyx-crm',
    name: 'HARVYX CRM',
    description: 'Contacts, leads and enrichment via the Ops agent.',
    kind: 'internal',
    capabilities: [
      { id: 'ops.add_contact', label: 'Add contact', available: true },
      { id: 'ops.update_contact', label: 'Update contact', available: true },
      { id: 'ops.enrich', label: 'Enrich contact', available: true },
    ],
  },
  {
    id: 'harvics-erp',
    name: 'Harvics OS ERP',
    description: 'Live orders, inventory, finance, HR, logistics and procurement data.',
    kind: 'internal',
    capabilities: [
      {
        id: 'erp.query',
        label: 'Query ERP',
        available: true,
        note: 'Requires HARVICS_API_KEY to match the backend INTERNAL_API_KEY.',
      },
    ],
  },
  {
    id: 'gmail',
    name: 'Gmail',
    description: 'Read, draft and send email from the connected account.',
    kind: 'connector',
    statusUrl: '/api/connectors/gmail/status',
    capabilities: [
      { id: 'gmail.create_draft', label: 'Create draft', available: true },
      { id: 'gmail.send_email', label: 'Send email', available: true, note: 'One send per user turn.' },
    ],
  },
  {
    id: 'calendar',
    name: 'Google Calendar',
    description: 'Create and update events on the connected calendar.',
    kind: 'connector',
    statusUrl: '/api/connectors/calendar/status',
    capabilities: [
      { id: 'calendar.create_event', label: 'Create event', available: true },
      { id: 'calendar.update_event', label: 'Update event', available: true },
    ],
  },
  {
    id: 'harvyx-send',
    name: 'HARVYX Send',
    description: 'Outbound SMS / WhatsApp / email through the HARVYX platform.',
    kind: 'internal',
    capabilities: [
      { id: 'harvyxSend.send_message', label: 'Send message', available: true, note: 'One send per user turn.' },
    ],
  },
  {
    id: 'web-scrape',
    name: 'Web fetch',
    description: 'Fetch and read public web pages via the Scrape agent.',
    kind: 'internal',
    capabilities: [{ id: 'scrape.fetch', label: 'Fetch page', available: true }],
  },
];
