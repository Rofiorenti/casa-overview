// Gmail OAuth config da environment variables
export interface GmailTokens {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
}

export interface GmailOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
  auth_endpoint: string;
  token_endpoint: string;
  web?: {
    client_id: string;
    client_secret: string;
    auth_uri: string;
    token_uri: string;
    redirect_uris: string[];
  };
  ios?: {
    client_id: string;
  };
}

const clientId = import.meta.env.VITE_GMAIL_CLIENT_ID || '';
const clientSecret = import.meta.env.VITE_GMAIL_CLIENT_SECRET || '';
const redirectUri = import.meta.env.VITE_GMAIL_REDIRECT_URI || 'http://localhost:5173/auth-callback';

export const GMAIL_OAUTH_CONFIG: GmailOAuthConfig = {
  clientId,
  clientSecret,
  redirectUri,
  scopes: ['https://www.googleapis.com/auth/gmail.readonly'],
  auth_endpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  token_endpoint: 'https://oauth2.googleapis.com/token',
  web: {
    client_id: clientId,
    client_secret: clientSecret,
    auth_uri: 'https://accounts.google.com/o/oauth2/v2/auth',
    token_uri: 'https://oauth2.googleapis.com/token',
    redirect_uris: [redirectUri],
  },
  ios: {
    client_id: clientId,
  },
};

if (!clientId) {
  console.warn('VITE_GMAIL_CLIENT_ID non configurato');
}
