// Gmail OAuth config da environment variables
export interface GmailTokens {
  access_token: string;
  refresh_token?: string;
  expires_at: number;
  token_type?: string;
  scope?: string;
}

interface ClientConfig {
  client_id: string;
  client_secret?: string;
  redirect_uri: string;
}

export interface GmailOAuthConfig {
  auth_endpoint: string;
  token_endpoint: string;
  scopes: string[];
  web: ClientConfig;
  ios: ClientConfig;
}

const clientId = import.meta.env.VITE_GMAIL_CLIENT_ID || '';
const clientSecret = import.meta.env.VITE_GMAIL_CLIENT_SECRET || '';
const redirectUri = import.meta.env.VITE_GMAIL_REDIRECT_URI || 'http://localhost:5173/auth-callback';

export const GMAIL_OAUTH_CONFIG: GmailOAuthConfig = {
  auth_endpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  token_endpoint: 'https://oauth2.googleapis.com/token',
  scopes: ['https://www.googleapis.com/auth/gmail.readonly'],
  web: {
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
  },
  ios: {
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
  },
};

if (!clientId) {
  console.warn('VITE_GMAIL_CLIENT_ID non configurato');
}
