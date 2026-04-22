/**
 * Gmail OAuth 2.0 flow con PKCE.
 *
 * Strategia:
 * - Capacitor nativo (iOS/Mac Catalyst): apre Safari esterno via @capacitor/browser,
 *   intercetta il redirect tramite deep link custom scheme (configurato in Info.plist)
 * - Browser/dev: usa popup window + postMessage
 *
 * Token e refresh_token salvati in Preferences (Keychain su iOS).
 * Il refresh_token NON scade finché l'utente non revoca l'accesso da Google.
 */

import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { App as CapApp } from '@capacitor/app';
import { Preferences } from '@capacitor/preferences';
import { GMAIL_OAUTH_CONFIG, type GmailTokens } from './gmailConfig';

const KEY_TOKENS = 'co.gmail.tokens.v1';

// ============================================================================
// PKCE helpers
// ============================================================================

function base64UrlEncode(buf: Uint8Array): string {
  let bin = '';
  for (const b of buf) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sha256(input: string): Promise<Uint8Array> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return new Uint8Array(hash);
}

function randomString(byteLength = 32): string {
  const buf = new Uint8Array(byteLength);
  crypto.getRandomValues(buf);
  return base64UrlEncode(buf);
}

async function createPkcePair() {
  const code_verifier = randomString(32);
  const hash = await sha256(code_verifier);
  const code_challenge = base64UrlEncode(hash);
  return { code_verifier, code_challenge };
}

// ============================================================================
// Platform detection
// ============================================================================

function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

function getClientConfig() {
  return isNative() ? GMAIL_OAUTH_CONFIG.ios : GMAIL_OAUTH_CONFIG.web;
}

// ============================================================================
// Token storage
// ============================================================================

export async function loadGmailTokens(): Promise<GmailTokens | null> {
  const { value } = await Preferences.get({ key: KEY_TOKENS });
  if (!value) return null;
  try {
    return JSON.parse(value) as GmailTokens;
  } catch {
    return null;
  }
}

async function saveGmailTokens(t: GmailTokens): Promise<void> {
  await Preferences.set({ key: KEY_TOKENS, value: JSON.stringify(t) });
}

export async function clearGmailTokens(): Promise<void> {
  await Preferences.remove({ key: KEY_TOKENS });
}

// ============================================================================
// Authorization URL
// ============================================================================

function buildAuthUrl(code_challenge: string, state: string): string {
  const cfg = getClientConfig();
  const params = new URLSearchParams({
    client_id: cfg.client_id,
    redirect_uri: cfg.redirect_uri,
    response_type: 'code',
    scope: GMAIL_OAUTH_CONFIG.scopes.join(' '),
    code_challenge,
    code_challenge_method: 'S256',
    access_type: 'offline',         // richiede refresh_token
    prompt: 'consent',              // forza il consent screen (così otteniamo refresh_token)
    state,
  });
  return `${GMAIL_OAUTH_CONFIG.auth_endpoint}?${params.toString()}`;
}

// ============================================================================
// Token exchange
// ============================================================================

async function exchangeCodeForTokens(code: string, code_verifier: string): Promise<GmailTokens> {
  const cfg = getClientConfig();
  const bodyParams: Record<string, string> = {
    code,
    client_id: cfg.client_id,
    redirect_uri: cfg.redirect_uri,
    grant_type: 'authorization_code',
    code_verifier,
  };
  if (cfg.client_secret) bodyParams.client_secret = cfg.client_secret;
  const body = new URLSearchParams(bodyParams);
  const res = await fetch(GMAIL_OAUTH_CONFIG.token_endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`Token exchange fallito: HTTP ${res.status} — ${err}`);
  }
  const data = await res.json();
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + (data.expires_in ?? 3600) * 1000,
    token_type: data.token_type ?? 'Bearer',
    scope: data.scope ?? '',
  };
}

async function refreshAccessToken(refresh_token: string): Promise<GmailTokens> {
  const cfg = getClientConfig();
  const bodyParams: Record<string, string> = {
    client_id: cfg.client_id,
    refresh_token,
    grant_type: 'refresh_token',
  };
  if (cfg.client_secret) bodyParams.client_secret = cfg.client_secret;
  const body = new URLSearchParams(bodyParams);
  const res = await fetch(GMAIL_OAUTH_CONFIG.token_endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) {
    throw new Error(`Refresh token fallito: HTTP ${res.status}`);
  }
  const data = await res.json();
  return {
    access_token: data.access_token,
    refresh_token,  // il refresh_token non cambia in un refresh
    expires_at: Date.now() + (data.expires_in ?? 3600) * 1000,
    token_type: data.token_type ?? 'Bearer',
    scope: data.scope ?? '',
  };
}

/** Ritorna un access_token valido: se scaduto fa il refresh, se non esiste throwa */
export async function getValidAccessToken(): Promise<string> {
  const tokens = await loadGmailTokens();
  if (!tokens) throw new Error('Non autenticato con Gmail');

  // Se mancano meno di 60 secondi, refresh
  if (tokens.expires_at - Date.now() < 60_000) {
    if (!tokens.refresh_token) {
      throw new Error('Token scaduto e nessun refresh_token disponibile. Fai di nuovo login.');
    }
    const newTokens = await refreshAccessToken(tokens.refresh_token);
    await saveGmailTokens(newTokens);
    return newTokens.access_token;
  }
  return tokens.access_token;
}

// ============================================================================
// Login flow
// ============================================================================

/**
 * Avvia il login Gmail.
 * - Su iOS/Mac Catalyst: usa @capacitor/browser + deep link listener
 * - Su browser/web: apre una popup e attende il postMessage
 */
export async function loginGmail(): Promise<GmailTokens> {
  const { code_verifier, code_challenge } = await createPkcePair();
  const state = randomString(16);
  const url = buildAuthUrl(code_challenge, state);

  const code = await (isNative() ? nativeLogin(url, state) : webLogin(url, state));
  const tokens = await exchangeCodeForTokens(code, code_verifier);
  await saveGmailTokens(tokens);
  return tokens;
}

// ----- Native (Capacitor) -----

async function nativeLogin(url: string, expectedState: string): Promise<string> {
  return new Promise(async (resolve, reject) => {
    let settled = false;

    const listener = await CapApp.addListener('appUrlOpen', async (event) => {
      if (settled) return;
      try {
        const u = new URL(event.url);
        // Deep link arriva sia come "schemedns:/oauth2redirect?code=..." che path diverso
        const code = u.searchParams.get('code');
        const err = u.searchParams.get('error');
        const state = u.searchParams.get('state');
        if (!code && !err) return;
        settled = true;
        listener.remove();
        await Browser.close().catch(() => {});

        if (err) {
          reject(new Error(`Login Google annullato: ${err}`));
          return;
        }
        if (state !== expectedState) {
          reject(new Error('State mismatch — possibile attacco CSRF'));
          return;
        }
        resolve(code!);
      } catch (e) {
        settled = true;
        listener.remove();
        reject(e);
      }
    });

    // Timeout: se dopo 5 minuti l'utente non completa, annulla
    setTimeout(() => {
      if (!settled) {
        settled = true;
        listener.remove();
        Browser.close().catch(() => {});
        reject(new Error('Timeout login Google (5 min)'));
      }
    }, 5 * 60 * 1000);

    try {
      await Browser.open({ url, presentationStyle: 'popover' });
    } catch (e) {
      if (!settled) {
        settled = true;
        listener.remove();
        reject(e);
      }
    }
  });
}

// ----- Web (popup window) -----

async function webLogin(url: string, expectedState: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const popup = window.open(url, 'gmail_oauth', 'width=500,height=700');
    if (!popup) {
      reject(new Error('Popup bloccata. Disabilita il popup blocker.'));
      return;
    }

    let settled = false;
    const timer = setInterval(() => {
      if (settled) return;
      try {
        // Se la popup è stata chiusa senza completare
        if (popup.closed) {
          clearInterval(timer);
          if (!settled) {
            settled = true;
            reject(new Error('Login annullato'));
          }
          return;
        }
        // Prova a leggere l'URL della popup (funziona solo se stessa origin)
        const href = popup.location.href;
        if (href.startsWith(GMAIL_OAUTH_CONFIG.web.redirect_uri)) {
          const u = new URL(href);
          const code = u.searchParams.get('code');
          const err = u.searchParams.get('error');
          const state = u.searchParams.get('state');
          clearInterval(timer);
          settled = true;
          popup.close();
          if (err) return reject(new Error(`Login Google annullato: ${err}`));
          if (state !== expectedState) return reject(new Error('State mismatch'));
          if (!code) return reject(new Error('Nessun code ricevuto'));
          resolve(code);
        }
      } catch {
        // Cross-origin error: normale mentre l'utente è su accounts.google.com
      }
    }, 300);
  });
}

export async function isGmailConnected(): Promise<boolean> {
  const t = await loadGmailTokens();
  return !!t;
}
