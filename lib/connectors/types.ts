export type ConnectorProvider = 'gmail' | 'outlook' | 'whatsapp' | 'linkedin' | 'calendar';

export interface ConnectorAccount {
  id: string;
  provider: ConnectorProvider;
  accountEmail: string;
  scopes: string[];
  tokenType: string;
  expiresAt?: string;
  connectedAt: string;
  updatedAt: string;
}

/** Public shape returned to the browser — no tokens ever included. */
export interface ConnectorStatus {
  provider: ConnectorProvider;
  connected: boolean;
  accountEmail?: string;
  scopes?: string[];
  connectedAt?: string;
}

export interface ConnectorAccountRow {
  id: string;
  provider: string;
  account_email: string;
  scopes_json: string;
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_at?: string;
  connected_at: string;
  updated_at: string;
}
