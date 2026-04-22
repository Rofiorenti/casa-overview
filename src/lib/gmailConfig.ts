// Gmail OAuth config da environment variables (Vite)
export const GMAIL_CLIENT_ID = import.meta.env.VITE_GMAIL_CLIENT_ID || '';
export const GMAIL_CLIENT_SECRET = import.meta.env.VITE_GMAIL_CLIENT_SECRET || '';
export const GMAIL_REDIRECT_URI = import.meta.env.VITE_GMAIL_REDIRECT_URI || 'http://localhost:5173/auth-callback';

// Type per il token di Gmail
export interface GmailTokens {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
}

// Config OAuth
export const GMAIL_OAUTH_CONFIG = {
  clientId: GMAIL_CLIENT_ID,
  clientSecret: GMAIL_CLIENT_SECRET,
  redirectUri: GMAIL_REDIRECT_URI,
  scopes: ['https://www.googleapis.com/auth/gmail.readonly'],
};

if (!GMAIL_CLIENT_ID) {
  console.warn('VITE_GMAIL_CLIENT_ID non configurato');
}
