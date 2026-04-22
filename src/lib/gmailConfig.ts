// Gmail OAuth config — LEGGI DA ENVIRONMENT VARIABLES
// Configura le variabili nel tuo .env.local durante lo sviluppo
// Su GitHub Actions, usa Actions Secrets

export const GMAIL_CLIENT_ID = import.meta.env.VITE_GMAIL_CLIENT_ID || '';
export const GMAIL_CLIENT_SECRET = import.meta.env.VITE_GMAIL_CLIENT_SECRET || '';
export const GMAIL_REDIRECT_URI = import.meta.env.VITE_GMAIL_REDIRECT_URI || 'http://localhost:5173/auth-callback';

if (!GMAIL_CLIENT_ID) {
  console.warn('VITE_GMAIL_CLIENT_ID non configurato');
}
