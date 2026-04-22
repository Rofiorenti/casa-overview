/**
 * Gmail API: ricerca mail Vikey e estrazione link Google Cloud Storage.
 *
 * Replica la logica di fetch_vikey_link_from_gmail() dello script Python,
 * ma usando Gmail API HTTP invece di IMAP.
 */

import { getValidAccessToken } from './gmailAuth';

const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';
const VIKEY_SENDER = 'alert@mg.vikey.it';

// ---------------------------------------------------------------------------
// Gmail API helpers
// ---------------------------------------------------------------------------

interface GmailMessageMeta {
  id: string;
  threadId: string;
  internalDate?: string;
}

interface GmailMessageFull {
  id: string;
  internalDate?: string;
  payload?: {
    mimeType?: string;
    headers?: Array<{ name: string; value: string }>;
    body?: { data?: string; size?: number };
    parts?: GmailMessageFull['payload'][];
  };
  snippet?: string;
}

async function gmailFetch(path: string): Promise<any> {
  const token = await getValidAccessToken();
  const res = await fetch(`${GMAIL_API_BASE}${path}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Gmail API error ${res.status}: ${txt}`);
  }
  return res.json();
}

async function listMessages(query: string): Promise<GmailMessageMeta[]> {
  const q = encodeURIComponent(query);
  const data = await gmailFetch(`/messages?q=${q}&maxResults=20`);
  return data.messages ?? [];
}

async function getMessage(id: string): Promise<GmailMessageFull> {
  return gmailFetch(`/messages/${id}?format=full`);
}

// ---------------------------------------------------------------------------
// Body extraction e URL parsing
// ---------------------------------------------------------------------------

/** Estrae testo + HTML da un messaggio Gmail (ricorsiva sulle parts) */
function extractBodyText(msg: GmailMessageFull): string {
  const pieces: string[] = [];

  const walk = (part: GmailMessageFull['payload'] | undefined) => {
    if (!part) return;
    const mt = part.mimeType ?? '';
    if ((mt === 'text/plain' || mt === 'text/html') && part.body?.data) {
      pieces.push(decodeBase64Url(part.body.data));
    }
    if (part.parts) for (const p of part.parts) walk(p);
  };
  walk(msg.payload);
  return pieces.join('\n');
}

function decodeBase64Url(b64url: string): string {
  // Gmail usa base64url (- _ senza padding)
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  try {
    const decoded = atob(b64);
    // Converti da binario a utf8
    const bytes = new Uint8Array(decoded.length);
    for (let i = 0; i < decoded.length; i++) bytes[i] = decoded.charCodeAt(i);
    return new TextDecoder('utf-8').decode(bytes);
  } catch {
    return '';
  }
}

/** Trova l'URL del CSV export nelle mail Vikey.
 *  I CSV vanno su bucket "vikey-tmp-24h". Le mail contengono anche altri
 *  URL storage.googleapis.com (logo, immagini) che vanno ignorati.
 */
function findGcsUrl(text: string): string | null {
  // Le URL nelle mail HTML possono essere &amp;-encoded
  const cleaned = text.replace(/&amp;/g, '&').replace(/&#x3D;/g, '=');
  // Pattern specifico per il bucket dei CSV temporanei Vikey
  const match = cleaned.match(/https:\/\/storage\.googleapis\.com\/[^\s"'<>\)]*vikey-tmp-24h[^\s"'<>\)]+/);
  if (match) return match[0];
  // Fallback: qualsiasi URL che finisce in .csv su storage.googleapis.com
  const csvMatch = cleaned.match(/https:\/\/storage\.googleapis\.com\/[^\s"'<>\)]+\.csv[^\s"'<>\)]*/);
  return csvMatch?.[0] ?? null;
}

// ---------------------------------------------------------------------------
// Polling: aspetta l'arrivo di 2 mail Vikey dopo un certo timestamp
// ---------------------------------------------------------------------------

export interface VikeyEmailLinks {
  reservations?: string;
  buro?: string;
}

interface PollOptions {
  /** Timestamp minimo (in ms) delle mail da considerare */
  afterTimestamp: number;
  /** Funzione che riceve lo stato corrente durante il polling */
  onProgress?: (found: number, total: number, message: string) => void;
  /** Timeout totale in ms (default 3 min) */
  timeoutMs?: number;
  /** Intervallo polling in ms (default 15s) */
  pollIntervalMs?: number;
}

/**
 * Cerca le 2 mail Vikey (una per tipo di export) inviate dopo `afterTimestamp`.
 * Usa un'euristica semplice: le 2 mail più recenti sono presumibilmente reservations + buro,
 * ma non c'è un campo chiaro nell'email per distinguerle. Per ora prendiamo entrambi i link
 * e li trattiamo come un pool: l'utente dovrà capire quale è quale, oppure decidiamo che
 * il primo link pescato è reservations e il secondo buro (nell'ordine di arrivo).
 *
 * ATTENZIONE: Vikey manda email con testo identico sia per reservations che per buro —
 * differenziamo per ORDINE di arrivo, dal momento che l'app le richiede in sequenza.
 */
export async function pollForVikeyEmails(opts: PollOptions): Promise<VikeyEmailLinks> {
  const {
    afterTimestamp,
    onProgress = () => {},
    timeoutMs = 3 * 60 * 1000,
    pollIntervalMs = 15_000,
  } = opts;

  console.log('[GMAIL] Inizio polling. afterTimestamp=' + afterTimestamp + ' (' + new Date(afterTimestamp).toISOString() + ')');

  const deadline = Date.now() + timeoutMs;
  const alreadySeenIds = new Set<string>();
  const linksInOrder: Array<{ url: string; ts: number }> = [];

  const afterEpochSec = Math.floor(afterTimestamp / 1000);
  const query = `from:${VIKEY_SENDER} after:${afterEpochSec}`;
  console.log('[GMAIL] Query: ' + query);

  onProgress(0, 2, 'Cerco le email Vikey…');

  while (Date.now() < deadline && linksInOrder.length < 2) {
    try {
      console.log('[GMAIL] Fetch /messages?q=' + query);
      const messages = await listMessages(query);
      console.log('[GMAIL] Ricevute ' + messages.length + ' mail da API');

      const newMessages: Array<GmailMessageFull> = [];
      for (const m of messages) {
        if (alreadySeenIds.has(m.id)) continue;
        const full = await getMessage(m.id);
        alreadySeenIds.add(m.id);
        const ts = Number(full.internalDate ?? '0');
        console.log('[GMAIL] Mail id=' + m.id.slice(0, 10) + ' ts=' + ts + ' (' + new Date(ts).toISOString() + ')');
        if (ts < afterTimestamp - 5000) {
          console.log('[GMAIL] Mail scartata: troppo vecchia');
          continue;
        }
        newMessages.push(full);
      }
      newMessages.sort((a, b) => Number(a.internalDate ?? 0) - Number(b.internalDate ?? 0));

      for (const msg of newMessages) {
        const body = extractBodyText(msg);
        console.log('[GMAIL] Body lungo ' + body.length + ' char. Primi 200:', body.slice(0, 200));
        const url = findGcsUrl(body);
        console.log('[GMAIL] Link estratto:', url ? url.slice(0, 80) + '...' : 'NESSUNO');
        if (url && !linksInOrder.some((x) => x.url === url)) {
          linksInOrder.push({ url, ts: Number(msg.internalDate ?? 0) });
          console.log('[GMAIL] Aggiunto link ' + linksInOrder.length + '/2');
          onProgress(linksInOrder.length, 2, `Trovata mail ${linksInOrder.length}/2`);
        }
      }

      if (linksInOrder.length >= 2) break;

      const remainingSec = Math.max(0, Math.round((deadline - Date.now()) / 1000));
      console.log('[GMAIL] Attendo ' + pollIntervalMs + 'ms. Rimangono ' + remainingSec + 's totali');
      onProgress(linksInOrder.length, 2, `Attendo email… (${remainingSec}s rimanenti)`);
      await new Promise((r) => setTimeout(r, pollIntervalMs));
    } catch (e: any) {
      console.error('[GMAIL] Errore nel polling:', e);
      console.error('[GMAIL] Errore message:', e?.message);
      console.error('[GMAIL] Errore stack:', e?.stack);
      onProgress(linksInOrder.length, 2, `Errore: ${e?.message}`);
      await new Promise((r) => setTimeout(r, pollIntervalMs));
    }
  }

  console.log('[GMAIL] Fine polling. Link raccolti: ' + linksInOrder.length);

  return {
    reservations: linksInOrder[0]?.url,
    buro: linksInOrder[1]?.url,
  };
}
