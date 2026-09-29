/**
 * Canonical Marketplace catalog.
 * Entries here do NOT imply a live connection — see connection status separately.
 */

import type {
  CapabilityDefinition,
  MarketplaceCategoryId,
  MarketplacePermission,
  ProviderDefinition,
} from './types';

type CapSeed = {
  action: string;
  name: string;
  description: string;
  permissions: MarketplacePermission[];
  executionMode?: CapabilityDefinition['executionMode'];
  requiresConnection?: boolean;
  supportsAsync?: boolean;
  requiresApproval?: boolean;
  inputRequired?: string[];
};

type ProviderSeed = ProviderDefinition & {
  capabilities: CapSeed[];
};

function presentationSchema(required: string[] = ['title', 'slides']) {
  return {
    type: 'object',
    required,
    additionalProperties: false,
    properties: {
      title: { type: 'string' },
      slides: { type: 'array' },
      theme: { type: 'string' },
      speakerNotes: { type: 'boolean' },
    },
  };
}

function cap(
  providerId: string,
  category: MarketplaceCategoryId,
  seed: CapSeed,
): CapabilityDefinition {
  return {
    id: `${providerId}.${seed.action}`,
    providerId,
    name: seed.name,
    description: seed.description,
    category,
    version: '1.0.0',
    inputSchema: {
      type: 'object',
      required: seed.inputRequired ?? ['title'],
      properties: {
        title: { type: 'string' },
        slides: { type: 'array' },
        query: { type: 'string' },
        url: { type: 'string' },
        content: { type: 'string' },
        to: { type: 'string' },
        subject: { type: 'string' },
        body: { type: 'string' },
        fileName: { type: 'string' },
        theme: { type: 'string' },
        speakerNotes: { type: 'boolean' },
      },
      additionalProperties: true,
    },
    outputSchema: {
      type: 'object',
      properties: {
        fileId: { type: 'string' },
        fileName: { type: 'string' },
        mimeType: { type: 'string' },
        reference: { type: 'string' },
        status: { type: 'string' },
      },
    },
    permissions: seed.permissions,
    executionMode: seed.executionMode ?? 'sync',
    requiresConnection: seed.requiresConnection ?? true,
    supportsAsync: seed.supportsAsync ?? false,
    supportsWebhook: false,
    requiresApproval: seed.requiresApproval ?? false,
    enabled: true,
  };
}

const SEEDS: ProviderSeed[] = [
  // —— Presentations ——
  {
    id: 'powerpoint',
    name: 'Microsoft PowerPoint',
    category: 'presentations',
    description: 'Create and edit professional presentations.',
    icon: 'pptx',
    mode: 'NATIVE_API',
    catalogStatus: 'available',
    auth: 'oauth',
    connectSupported: false,
    capabilities: [
      {
        action: 'create_presentation',
        name: 'Create presentation',
        description: 'Create a PPTX from title + slides.',
        permissions: ['content.write', 'files.write'],
        executionMode: 'async',
        supportsAsync: true,
        inputRequired: ['title', 'slides'],
      },
      {
        action: 'add_slides',
        name: 'Add slides',
        description: 'Append slides to an existing deck.',
        permissions: ['content.write', 'files.write'],
      },
      {
        action: 'modify_slides',
        name: 'Modify slides',
        description: 'Update slide content.',
        permissions: ['content.write', 'files.write'],
      },
      {
        action: 'speaker_notes',
        name: 'Speaker notes',
        description: 'Add or update speaker notes.',
        permissions: ['content.write'],
      },
      {
        action: 'export_pptx',
        name: 'Export PPTX',
        description: 'Export presentation as PPTX.',
        permissions: ['files.read'],
      },
    ],
  },
  {
    id: 'gamma',
    name: 'Gamma',
    category: 'presentations',
    description: 'AI presentation generation and transforms.',
    icon: 'gamma',
    mode: 'NATIVE_API',
    catalogStatus: 'available',
    auth: 'api_key',
    connectSupported: false,
    capabilities: [
      {
        action: 'create_presentation',
        name: 'Generate presentation',
        description: 'Generate a deck from structured content.',
        permissions: ['content.write', 'files.write'],
        executionMode: 'async',
        supportsAsync: true,
        inputRequired: ['title', 'slides'],
      },
      {
        action: 'transform_document',
        name: 'Transform content',
        description: 'Transform a document into slides.',
        permissions: ['content.write', 'files.write'],
      },
      {
        action: 'export',
        name: 'Export',
        description: 'Export Gamma output.',
        permissions: ['files.read'],
      },
    ],
  },
  {
    id: 'canva',
    name: 'Canva',
    category: 'design',
    description: 'Create and edit designs and presentations.',
    icon: 'canva',
    mode: 'NATIVE_API',
    catalogStatus: 'available',
    auth: 'oauth',
    connectSupported: false,
    capabilities: [
      {
        action: 'create_design',
        name: 'Create design',
        description: 'Create a Canva design.',
        permissions: ['content.write', 'files.write'],
        executionMode: 'async',
        supportsAsync: true,
      },
      {
        action: 'edit_design',
        name: 'Edit design',
        description: 'Edit an existing design.',
        permissions: ['content.write'],
      },
      {
        action: 'export',
        name: 'Export',
        description: 'Export design assets.',
        permissions: ['files.read'],
      },
      {
        action: 'create_presentation',
        name: 'Create presentation',
        description: 'Create a Canva presentation.',
        permissions: ['content.write', 'files.write'],
        supportsAsync: true,
        executionMode: 'async',
        inputRequired: ['title', 'slides'],
      },
    ],
  },

  // —— Documents ——
  {
    id: 'word',
    name: 'Microsoft Word',
    category: 'documents',
    description: 'Create and edit Word documents.',
    icon: 'docx',
    mode: 'NATIVE_API',
    catalogStatus: 'coming_soon',
    auth: 'oauth',
    connectSupported: false,
    capabilities: [
      {
        action: 'create_document',
        name: 'Create document',
        description: 'Create a DOCX.',
        permissions: ['files.write', 'content.write'],
      },
    ],
  },
  {
    id: 'google_docs',
    name: 'Google Docs',
    category: 'documents',
    description: 'Create and edit Google Docs.',
    icon: 'gdocs',
    mode: 'NATIVE_API',
    catalogStatus: 'coming_soon',
    auth: 'oauth',
    connectSupported: false,
    capabilities: [
      {
        action: 'create_document',
        name: 'Create document',
        description: 'Create a Google Doc.',
        permissions: ['files.write', 'content.write'],
      },
    ],
  },
  {
    id: 'pdf',
    name: 'PDF',
    category: 'documents',
    description: 'Generate and export PDF documents.',
    icon: 'pdf',
    mode: 'INTERNAL',
    catalogStatus: 'coming_soon',
    auth: 'none',
    connectSupported: false,
    capabilities: [
      {
        action: 'generate',
        name: 'Generate PDF',
        description: 'Generate a PDF from content.',
        permissions: ['files.write'],
        requiresConnection: false,
      },
    ],
  },

  // —— Spreadsheets ——
  {
    id: 'excel',
    name: 'Microsoft Excel',
    category: 'spreadsheets',
    description: 'Create and edit Excel workbooks.',
    icon: 'xlsx',
    mode: 'NATIVE_API',
    catalogStatus: 'coming_soon',
    auth: 'oauth',
    connectSupported: false,
    capabilities: [
      {
        action: 'create_workbook',
        name: 'Create workbook',
        description: 'Create an XLSX workbook.',
        permissions: ['files.write'],
      },
    ],
  },
  {
    id: 'google_sheets',
    name: 'Google Sheets',
    category: 'spreadsheets',
    description: 'Create and edit Google Sheets.',
    icon: 'gsheets',
    mode: 'NATIVE_API',
    catalogStatus: 'coming_soon',
    auth: 'oauth',
    connectSupported: false,
    capabilities: [
      {
        action: 'create_sheet',
        name: 'Create sheet',
        description: 'Create a Google Sheet.',
        permissions: ['files.write'],
      },
    ],
  },

  // —— Design / media gen ——
  {
    id: 'image_generation',
    name: 'Image Generation',
    category: 'design',
    description: 'Generate images via configured model providers.',
    icon: 'image',
    mode: 'INTERNAL',
    catalogStatus: 'coming_soon',
    auth: 'api_key',
    connectSupported: false,
    capabilities: [
      {
        action: 'generate',
        name: 'Generate image',
        description: 'Generate an image from a prompt.',
        permissions: ['media.generate'],
      },
    ],
  },

  // —— Research (internal wrappers — execution via existing tools where wired) ——
  {
    id: 'web_search',
    name: 'Web Search',
    category: 'research',
    description: 'Live web search through the configured search provider.',
    icon: 'search',
    mode: 'INTERNAL',
    catalogStatus: 'available',
    auth: 'internal',
    connectSupported: false,
    capabilities: [
      {
        action: 'search',
        name: 'Search the web',
        description: 'Run a web search query.',
        permissions: ['research.read'],
        requiresConnection: false,
        inputRequired: ['query'],
      },
    ],
  },
  {
    id: 'deep_research',
    name: 'Deep Research',
    category: 'research',
    description: 'Multi-source research jobs (existing Research subsystem).',
    icon: 'research',
    mode: 'INTERNAL',
    catalogStatus: 'available',
    auth: 'internal',
    connectSupported: false,
    capabilities: [
      {
        action: 'run',
        name: 'Run deep research',
        description: 'Start a research job.',
        permissions: ['research.read'],
        requiresConnection: false,
        supportsAsync: true,
        executionMode: 'async',
        inputRequired: ['query'],
      },
    ],
  },
  {
    id: 'web_scraper',
    name: 'Web Scraper',
    category: 'research',
    description: 'Public URL extraction (existing scrape tools).',
    icon: 'scrape',
    mode: 'INTERNAL',
    catalogStatus: 'available',
    auth: 'internal',
    connectSupported: false,
    capabilities: [
      {
        action: 'scrape_url',
        name: 'Scrape URL',
        description: 'Extract public page content.',
        permissions: ['research.read'],
        requiresConnection: false,
        inputRequired: ['url'],
      },
    ],
  },
  {
    id: 'knowledge_base',
    name: 'Knowledge Base',
    category: 'research',
    description: 'HARVYX-BOT Knowledge RAG search.',
    icon: 'knowledge',
    mode: 'INTERNAL',
    catalogStatus: 'available',
    auth: 'internal',
    connectSupported: false,
    capabilities: [
      {
        action: 'search',
        name: 'Search knowledge',
        description: 'Permission-filtered knowledge retrieval.',
        permissions: ['research.read'],
        requiresConnection: false,
        inputRequired: ['query'],
      },
    ],
  },

  // —— Communication ——
  {
    id: 'gmail',
    name: 'Gmail',
    category: 'communication',
    description: 'Gmail via existing OAuth connector.',
    icon: 'gmail',
    mode: 'NATIVE_API',
    catalogStatus: 'available',
    auth: 'oauth',
    connectSupported: true,
    capabilities: [
      {
        action: 'send_email',
        name: 'Send email',
        description: 'Send email (approval required).',
        permissions: ['email.send'],
        requiresApproval: true,
        inputRequired: ['to', 'subject', 'body'],
      },
      {
        action: 'search_emails',
        name: 'Search emails',
        description: 'Search mailbox.',
        permissions: ['email.read'],
        inputRequired: ['query'],
      },
    ],
  },
  {
    id: 'outlook',
    name: 'Outlook',
    category: 'communication',
    description: 'Microsoft Outlook email.',
    icon: 'outlook',
    mode: 'NATIVE_API',
    catalogStatus: 'coming_soon',
    auth: 'oauth',
    connectSupported: false,
    capabilities: [
      {
        action: 'send_email',
        name: 'Send email',
        description: 'Send Outlook email.',
        permissions: ['email.send'],
        requiresApproval: true,
      },
    ],
  },
  {
    id: 'slack',
    name: 'Slack',
    category: 'communication',
    description: 'Slack messaging.',
    icon: 'slack',
    mode: 'NATIVE_API',
    catalogStatus: 'coming_soon',
    auth: 'oauth',
    connectSupported: false,
    capabilities: [
      {
        action: 'post_message',
        name: 'Post message',
        description: 'Post to a Slack channel.',
        permissions: ['social.publish'],
        requiresApproval: true,
      },
    ],
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp',
    category: 'communication',
    description: 'WhatsApp messaging.',
    icon: 'whatsapp',
    mode: 'NATIVE_API',
    catalogStatus: 'coming_soon',
    auth: 'api_key',
    connectSupported: false,
    capabilities: [
      {
        action: 'send_message',
        name: 'Send message',
        description: 'Send a WhatsApp message.',
        permissions: ['social.publish'],
        requiresApproval: true,
      },
    ],
  },

  // —— Meetings ——
  {
    id: 'google_calendar',
    name: 'Google Calendar',
    category: 'meetings',
    description: 'Calendar via existing OAuth connector.',
    icon: 'gcal',
    mode: 'NATIVE_API',
    catalogStatus: 'available',
    auth: 'oauth',
    connectSupported: true,
    capabilities: [
      {
        action: 'list_events',
        name: 'List events',
        description: 'List calendar events.',
        permissions: ['calendar.read'],
        requiresConnection: true,
        inputRequired: [],
      },
      {
        action: 'create_event',
        name: 'Create event',
        description: 'Create a calendar event.',
        permissions: ['calendar.write'],
        requiresApproval: true,
      },
    ],
  },
  {
    id: 'zoom',
    name: 'Zoom',
    category: 'meetings',
    description: 'Zoom meetings.',
    icon: 'zoom',
    mode: 'NATIVE_API',
    catalogStatus: 'coming_soon',
    auth: 'oauth',
    connectSupported: false,
    capabilities: [
      {
        action: 'create_meeting',
        name: 'Create meeting',
        description: 'Create a Zoom meeting.',
        permissions: ['calendar.write'],
      },
    ],
  },
  {
    id: 'google_meet',
    name: 'Google Meet',
    category: 'meetings',
    description: 'Google Meet links.',
    icon: 'gmeet',
    mode: 'NATIVE_API',
    catalogStatus: 'coming_soon',
    auth: 'oauth',
    connectSupported: false,
    capabilities: [
      {
        action: 'create_meeting',
        name: 'Create meeting',
        description: 'Create a Meet link.',
        permissions: ['calendar.write'],
      },
    ],
  },

  // —— CRM ——
  {
    id: 'harvyx_crm',
    name: 'HARVYX CRM',
    category: 'harvyx',
    description: 'HARVYX leads, campaigns, outreach via external HTTP API. BOT does not own CRM data.',
    icon: 'harvyx',
    mode: 'INTERNAL',
    catalogStatus: 'available',
    auth: 'api_key',
    connectSupported: false,
    tags: ['harvyx'],
    capabilities: [
      {
        action: 'list_leads',
        name: 'List leads',
        description: 'List HARVYX leads (HTTP).',
        permissions: ['crm.read'],
        requiresConnection: false,
        inputRequired: [],
      },
      {
        action: 'search_leads',
        name: 'Search leads',
        description: 'Search HARVYX leads.',
        permissions: ['crm.read'],
        requiresConnection: false,
        inputRequired: ['query'],
      },
      {
        action: 'create_campaign',
        name: 'Create campaign',
        description: 'Create a HARVYX campaign.',
        permissions: ['crm.write'],
        requiresConnection: false,
      },
      {
        action: 'enrich_lead',
        name: 'Enrich lead',
        description: 'Enrich a lead via HARVYX.',
        permissions: ['crm.read'],
        requiresConnection: false,
      },
      {
        action: 'create_outreach',
        name: 'Create outreach draft',
        description: 'Create outreach draft (not send).',
        permissions: ['crm.write'],
        requiresConnection: false,
      },
      {
        action: 'send_outreach',
        name: 'Send outreach',
        description: 'Send outreach (approval required).',
        permissions: ['crm.write', 'email.send'],
        requiresApproval: true,
        requiresConnection: false,
      },
    ],
  },
  {
    id: 'hubspot',
    name: 'HubSpot',
    category: 'crm',
    description: 'HubSpot CRM.',
    icon: 'hubspot',
    mode: 'NATIVE_API',
    catalogStatus: 'coming_soon',
    auth: 'oauth',
    connectSupported: false,
    capabilities: [
      {
        action: 'list_contacts',
        name: 'List contacts',
        description: 'List HubSpot contacts.',
        permissions: ['crm.read'],
      },
    ],
  },
  {
    id: 'salesforce',
    name: 'Salesforce',
    category: 'crm',
    description: 'Salesforce CRM.',
    icon: 'salesforce',
    mode: 'NATIVE_API',
    catalogStatus: 'coming_soon',
    auth: 'oauth',
    connectSupported: false,
    capabilities: [
      {
        action: 'list_accounts',
        name: 'List accounts',
        description: 'List Salesforce accounts.',
        permissions: ['crm.read'],
      },
    ],
  },

  // —— Development ——
  {
    id: 'github',
    name: 'GitHub',
    category: 'development',
    description: 'GitHub issues and repositories.',
    icon: 'github',
    mode: 'NATIVE_API',
    catalogStatus: 'coming_soon',
    auth: 'oauth',
    connectSupported: false,
    capabilities: [
      {
        action: 'create_issue',
        name: 'Create issue',
        description: 'Create a GitHub issue.',
        permissions: ['github.write'],
        requiresApproval: true,
      },
      {
        action: 'list_repos',
        name: 'List repos',
        description: 'List repositories.',
        permissions: ['github.read'],
      },
    ],
  },
  {
    id: 'gitlab',
    name: 'GitLab',
    category: 'development',
    description: 'GitLab projects and issues.',
    icon: 'gitlab',
    mode: 'NATIVE_API',
    catalogStatus: 'coming_soon',
    auth: 'oauth',
    connectSupported: false,
    capabilities: [
      {
        action: 'create_issue',
        name: 'Create issue',
        description: 'Create a GitLab issue.',
        permissions: ['github.write'],
        requiresApproval: true,
      },
    ],
  },

  // —— Storage ——
  {
    id: 'google_drive',
    name: 'Google Drive',
    category: 'storage',
    description: 'Google Drive files.',
    icon: 'gdrive',
    mode: 'NATIVE_API',
    catalogStatus: 'coming_soon',
    auth: 'oauth',
    connectSupported: false,
    capabilities: [
      {
        action: 'upload_file',
        name: 'Upload file',
        description: 'Upload a file to Drive.',
        permissions: ['storage.write'],
      },
    ],
  },
  {
    id: 'onedrive',
    name: 'OneDrive',
    category: 'storage',
    description: 'Microsoft OneDrive.',
    icon: 'onedrive',
    mode: 'NATIVE_API',
    catalogStatus: 'coming_soon',
    auth: 'oauth',
    connectSupported: false,
    capabilities: [
      {
        action: 'upload_file',
        name: 'Upload file',
        description: 'Upload a file to OneDrive.',
        permissions: ['storage.write'],
      },
    ],
  },
  {
    id: 'dropbox',
    name: 'Dropbox',
    category: 'storage',
    description: 'Dropbox storage.',
    icon: 'dropbox',
    mode: 'NATIVE_API',
    catalogStatus: 'coming_soon',
    auth: 'oauth',
    connectSupported: false,
    capabilities: [
      {
        action: 'upload_file',
        name: 'Upload file',
        description: 'Upload a file to Dropbox.',
        permissions: ['storage.write'],
      },
    ],
  },
  {
    id: 'box',
    name: 'Box',
    category: 'storage',
    description: 'Box cloud storage.',
    icon: 'box',
    mode: 'NATIVE_API',
    catalogStatus: 'coming_soon',
    auth: 'oauth',
    connectSupported: false,
    capabilities: [
      {
        action: 'upload_file',
        name: 'Upload file',
        description: 'Upload a file to Box.',
        permissions: ['storage.write'],
      },
    ],
  },

  // —— AI models (catalog — keys stay in env, never in definitions) ——
  ...(['groq', 'nvidia', 'openai', 'anthropic', 'google_gemini', 'local_h100'] as const).map(
    (id) =>
      ({
        id,
        name:
          id === 'local_h100'
            ? 'Local H100'
            : id === 'google_gemini'
              ? 'Google Gemini'
              : id.charAt(0).toUpperCase() + id.slice(1),
        category: 'ai' as const,
        description: `${id} model provider (env-configured; not a marketplace secret).`,
        icon: id,
        mode: 'INTERNAL' as const,
        catalogStatus: 'available' as const,
        auth: 'internal' as const,
        connectSupported: false,
        capabilities: [
          {
            action: 'invoke',
            name: 'Invoke model',
            description: 'Route through existing model router — no keys in catalog.',
            permissions: ['ai.invoke'] as MarketplacePermission[],
            requiresConnection: false,
            inputRequired: ['content'],
          },
        ],
      }) satisfies ProviderSeed,
  ),

  // —— Media ——
  {
    id: 'media_image',
    name: 'Image',
    category: 'media',
    description: 'Image media capabilities.',
    icon: 'media-image',
    mode: 'CATALOG',
    catalogStatus: 'coming_soon',
    auth: 'api_key',
    connectSupported: false,
    capabilities: [
      {
        action: 'process',
        name: 'Process image',
        description: 'Process an image asset.',
        permissions: ['media.generate'],
      },
    ],
  },
  {
    id: 'media_video',
    name: 'Video',
    category: 'media',
    description: 'Video generation / processing.',
    icon: 'media-video',
    mode: 'CATALOG',
    catalogStatus: 'coming_soon',
    auth: 'api_key',
    connectSupported: false,
    capabilities: [
      {
        action: 'generate',
        name: 'Generate video',
        description: 'Generate video content.',
        permissions: ['media.generate'],
      },
    ],
  },
  {
    id: 'media_audio',
    name: 'Audio',
    category: 'media',
    description: 'Audio processing.',
    icon: 'media-audio',
    mode: 'CATALOG',
    catalogStatus: 'coming_soon',
    auth: 'api_key',
    connectSupported: false,
    capabilities: [
      {
        action: 'process',
        name: 'Process audio',
        description: 'Process audio content.',
        permissions: ['media.generate'],
      },
    ],
  },
  {
    id: 'speech_to_text',
    name: 'Speech-to-text',
    category: 'media',
    description: 'Transcription.',
    icon: 'stt',
    mode: 'CATALOG',
    catalogStatus: 'coming_soon',
    auth: 'api_key',
    connectSupported: false,
    capabilities: [
      {
        action: 'transcribe',
        name: 'Transcribe',
        description: 'Transcribe audio to text.',
        permissions: ['media.generate'],
      },
    ],
  },
  {
    id: 'text_to_speech',
    name: 'Text-to-speech',
    category: 'media',
    description: 'Speech synthesis.',
    icon: 'tts',
    mode: 'CATALOG',
    catalogStatus: 'coming_soon',
    auth: 'api_key',
    connectSupported: false,
    capabilities: [
      {
        action: 'synthesize',
        name: 'Synthesize speech',
        description: 'Convert text to speech.',
        permissions: ['media.generate'],
      },
    ],
  },

  // —— Automation ——
  {
    id: 'webhooks',
    name: 'Webhooks',
    category: 'automation',
    description: 'Register and receive verified webhooks.',
    icon: 'webhook',
    mode: 'WEBHOOK',
    catalogStatus: 'available',
    auth: 'none',
    connectSupported: false,
    capabilities: [
      {
        action: 'register',
        name: 'Register webhook',
        description: 'Register a webhook endpoint (secret via secret_ref only).',
        permissions: ['webhooks.receive', 'automation.execute'],
        requiresConnection: false,
        inputRequired: ['title'],
      },
    ],
  },
  {
    id: 'scheduled_jobs',
    name: 'Scheduled Jobs',
    category: 'automation',
    description: 'Scheduled automation via Mission Control.',
    icon: 'schedule',
    mode: 'INTERNAL',
    catalogStatus: 'available',
    auth: 'internal',
    connectSupported: false,
    capabilities: [
      {
        action: 'enqueue',
        name: 'Enqueue scheduled work',
        description: 'Enqueue work onto Mission Control.',
        permissions: ['automation.execute'],
        requiresConnection: false,
        supportsAsync: true,
        executionMode: 'async',
      },
    ],
  },
  {
    id: 'http_api',
    name: 'HTTP API',
    category: 'automation',
    description: 'Governed HTTP calls (SSRF-protected; allowlist only).',
    icon: 'http',
    mode: 'WEB',
    catalogStatus: 'coming_soon',
    auth: 'none',
    connectSupported: false,
    capabilities: [
      {
        action: 'request',
        name: 'HTTP request',
        description: 'Perform an allowlisted HTTP request.',
        permissions: ['automation.execute'],
        requiresApproval: true,
      },
    ],
  },

  // —— Safe internal mock (E2E) ——
  {
    id: 'mock',
    name: 'Mock Presentation',
    category: 'internal',
    description: 'Safe internal mock provider for tests and local E2E. Never calls external APIs.',
    icon: 'mock',
    mode: 'INTERNAL',
    catalogStatus: 'available',
    auth: 'none',
    connectSupported: true,
    tags: ['mock', 'test'],
    capabilities: [
      {
        action: 'presentation.create',
        name: 'Create mock presentation',
        description: 'Create an in-memory mock presentation artifact.',
        permissions: ['internal.mock', 'content.write', 'files.write'],
        requiresConnection: true,
        supportsAsync: true,
        executionMode: 'either',
        inputRequired: ['title', 'slides'],
      },
      {
        action: 'health.ping',
        name: 'Health ping',
        description: 'Ping the mock provider.',
        permissions: ['internal.mock'],
        requiresConnection: false,
        inputRequired: [],
      },
    ],
  },

  // —— MCP generic adapter entry ——
  {
    id: 'mcp_generic',
    name: 'MCP Adapter',
    category: 'automation',
    description: 'Generic MCP transport for registered MCP servers (provider-neutral).',
    icon: 'mcp',
    mode: 'MCP',
    catalogStatus: 'available',
    auth: 'mcp',
    connectSupported: true,
    capabilities: [
      {
        action: 'invoke',
        name: 'Invoke MCP tool',
        description: 'Invoke a tool on a connected MCP server.',
        permissions: ['automation.execute'],
        requiresConnection: true,
        inputRequired: ['title'],
      },
    ],
  },
];

function expandSeed(seed: ProviderSeed): {
  provider: ProviderDefinition;
  capabilities: CapabilityDefinition[];
} {
  const { capabilities: caps, ...provider } = seed;
  // Fix mock capability id (action contains dots)
  const capabilities = caps.map((c) => {
    if (provider.id === 'mock' && c.action.includes('.')) {
      const def = cap(provider.id, provider.category, { ...c, action: c.action.replace(/\./g, '_') });
      // Prefer dotted canonical ids for mock as specified: mock.presentation.create
      const next = {
        ...def,
        id: `${provider.id}.${c.action}`,
      };
      if (c.action.includes('presentation')) {
        return { ...next, inputSchema: presentationSchema() };
      }
      return next;
    }
    const def = cap(provider.id, provider.category, c);
    if (c.action.includes('presentation') || c.action === 'create_presentation') {
      return { ...def, inputSchema: presentationSchema() };
    }
    return def;
  });
  return { provider, capabilities };
}

const EXPANDED = SEEDS.map(expandSeed);

export const CATALOG_PROVIDERS: ProviderDefinition[] = EXPANDED.map((e) => e.provider);
export const CATALOG_CAPABILITIES: CapabilityDefinition[] = EXPANDED.flatMap((e) => e.capabilities);

export function getCatalogProvider(id: string): ProviderDefinition | undefined {
  return CATALOG_PROVIDERS.find((p) => p.id === id);
}

export function getCatalogCapability(id: string): CapabilityDefinition | undefined {
  return CATALOG_CAPABILITIES.find((c) => c.id === id);
}

export function listCatalogByCategory(category?: string): ProviderDefinition[] {
  if (!category) return [...CATALOG_PROVIDERS];
  return CATALOG_PROVIDERS.filter((p) => p.category === category);
}
