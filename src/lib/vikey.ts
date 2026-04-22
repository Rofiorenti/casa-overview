import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { loadCredentials, setCsvCache, getCsvCache, loadDataSource } from './storage';

// ----- Cache keys separati per buro -----
const KEY_BURO_CACHE = 'co.buro.cache.v1';
const KEY_BURO_META = 'co.buro.meta.v1';

// Keys per salvare gli ultimi link GCS (per retry download)
const KEY_LAST_LINK_RESV = 'co.vikey.last_link.reservations';
const KEY_LAST_LINK_BURO = 'co.vikey.last_link.buro';

async function readBuroCache(): Promise<{ csv: string | null; lastSync: string | null }> {
  const csv = (await Preferences.get({ key: KEY_BURO_CACHE })).value ?? null;
  const lastSync = (await Preferences.get({ key: KEY_BURO_META })).value ?? null;
  return { csv, lastSync };
}
async function writeBuroCache(csv: string): Promise<string> {
  await Preferences.set({ key: KEY_BURO_CACHE, value: csv });
  const ts = new Date().toISOString();
  await Preferences.set({ key: KEY_BURO_META, value: ts });
  return ts;
}

// ========================================================================
// Loading: sempre dalla cache (l'app è self-contained, no filesystem)
// ========================================================================

export async function loadReservationsCsv(): Promise<{
  csv: string; lastSync: string;
} | null> {
  const { csv, lastSync } = await getCsvCache();
  if (csv) return { csv, lastSync: lastSync ?? new Date().toISOString() };
  return null;
}

export async function loadBuroCsv(): Promise<{
  csv: string; lastSync: string;
} | null> {
  const { csv, lastSync } = await readBuroCache();
  if (csv) return { csv, lastSync: lastSync ?? new Date().toISOString() };
  return null;
}

/** Import manuale (file picker o paste) — primary entry point per iPhone */
export async function importReservationsCsv(csvText: string): Promise<string> {
  return setCsvCache(csvText);
}
export async function importBuroCsv(csvText: string): Promise<string> {
  return writeBuroCache(csvText);
}

// ========================================================================
// Vikey API — login e richiesta export via email
// Replica la logica di scripts/sync_vikey.py
// ========================================================================

const LOGIN_URL = 'https://api.vikey.it/api/v3/auth/login';
const EXPORT_URL = 'https://api.vikey.it/api/v3/resv/action';

const BASE_HEADERS = {
  accept: '*/*',
  'content-type': 'application/json',
  origin: 'https://my.vikey.it',
  referer: 'https://my.vikey.it/',
};

export type ExportKind = 'reservations' | 'buro';

const EXPORT_FLAGS: Record<ExportKind, Record<string, number>> = {
  reservations: {
    do_invoice: 0, do_docs: 0, do_docs_extra_guest: 0,
    do_extra: 0, do_citytax: 0, do_buro: 0,
  },
  buro: {
    do_invoice: 0, do_docs: 1, do_docs_extra_guest: 1,
    do_extra: 0, do_citytax: 1, do_buro: 1,
  },
};

function getDefaultDateTo(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 3);
  return d.toISOString().slice(0, 10);
}

export interface VikeyLoginTokens {
  access_token: string;
  struct_token: string;
}

export async function vikeyLogin(): Promise<VikeyLoginTokens> {
  const creds = await loadCredentials();
  if (!creds.vikey_email || !creds.vikey_password) {
    throw new Error('Credenziali Vikey non configurate. Vai in Impostazioni.');
  }
  const res = await fetch(LOGIN_URL, {
    method: 'POST',
    headers: BASE_HEADERS,
    body: JSON.stringify({
      email: creds.vikey_email,
      password: creds.vikey_password,
    }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Login Vikey fallito (HTTP ${res.status}). ${txt}`);
  }
  const data = await res.json();
  const access_token = data.access_token;
  const struct_token = data.old_token;
  if (!access_token || !struct_token) {
    throw new Error('Token mancanti nella risposta di login');
  }
  return { access_token, struct_token };
}

/** Triggera l'invio dell'email di export da parte di Vikey */
export async function vikeyRequestExport(
  tokens: VikeyLoginTokens,
  kind: ExportKind,
  dateFrom = '2023-12-31',
  dateTo = getDefaultDateTo(),
): Promise<void> {
  const params = new URLSearchParams({
    action: 'RESERVATIONSCSV',
    date_from: dateFrom,
    date_to: dateTo,
    token: tokens.struct_token,
    ...Object.fromEntries(Object.entries(EXPORT_FLAGS[kind]).map(([k, v]) => [k, String(v)])),
  });
  const res = await fetch(`${EXPORT_URL}?${params}`, {
    method: 'GET',
    headers: {
      ...BASE_HEADERS,
      authorization: `Bearer ${tokens.access_token}`,
    },
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Richiesta export ${kind} fallita (HTTP ${res.status}). ${txt}`);
  }
}

/** Scarica un CSV da un URL GCS (che arriva via mail Vikey) e lo salva in cache */
export async function downloadCsvFromUrl(
  url: string, kind: ExportKind,
): Promise<{ csv: string; lastSync: string }> {
  console.log('[DOWNLOAD] Inizio download', kind, 'da', url.slice(0, 100));

  let csv: string;

  // Su Capacitor nativo (iOS/Mac Catalyst) il fetch() del WebView ha problemi
  // con storage.googleapis.com (CORS/redirect). Usiamo CapacitorHttp che
  // usa URLSession nativa e bypassa queste limitazioni.
  if (Capacitor.isNativePlatform()) {
    console.log('[DOWNLOAD] Uso CapacitorHttp (nativo)');
    const response = await CapacitorHttp.get({
      url,
      headers: { 'accept': 'text/csv,*/*' },
      responseType: 'text',  // forza decodifica testo
    });
    console.log('[DOWNLOAD] CapacitorHttp risposta status=', response.status);
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`Download CSV fallito (HTTP ${response.status})`);
    }
    if (typeof response.data === 'string') {
      csv = response.data;
    } else if (response.data == null) {
      throw new Error('Download CSV: risposta vuota');
    } else {
      // CapacitorHttp a volte ritorna un oggetto se il content-type non è testo
      throw new Error('Download CSV: formato risposta non testuale (URL forse non è un CSV)');
    }
  } else {
    console.log('[DOWNLOAD] Uso fetch browser');
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Download CSV fallito (HTTP ${res.status})`);
    }
    csv = await res.text();
  }

  console.log('[DOWNLOAD] CSV ricevuto, lunghezza:', csv.length);
  if (!csv || csv.length < 50) {
    throw new Error('CSV scaricato vuoto o troppo piccolo');
  }
  // Sanity check: un CSV deve avere almeno una virgola o punto-e-virgola
  // e non essere HTML/binario
  if (csv.startsWith('<!') || csv.startsWith('<html') || csv.startsWith('PK')) {
    throw new Error('Download CSV: risposta non è CSV (HTML o binario)');
  }
  if (!csv.includes(',') && !csv.includes(';')) {
    throw new Error('Download CSV: risposta non sembra CSV (nessun delimitatore)');
  }
  const ts = kind === 'reservations'
    ? await setCsvCache(csv)
    : await writeBuroCache(csv);
  // Salva anche l'URL per retry futuri
  await Preferences.set({
    key: kind === 'reservations' ? KEY_LAST_LINK_RESV : KEY_LAST_LINK_BURO,
    value: url,
  });
  console.log('[DOWNLOAD] Salvato in cache', kind);
  return { csv, lastSync: ts };
}

export async function getLastLink(kind: ExportKind): Promise<string | null> {
  const { value } = await Preferences.get({
    key: kind === 'reservations' ? KEY_LAST_LINK_RESV : KEY_LAST_LINK_BURO,
  });
  return value ?? null;
}

/** Triggera entrambi gli export. Non scarica — serve il link via email. */
export async function triggerAllExports(): Promise<{ ok: boolean; message: string }> {
  try {
    const tokens = await vikeyLogin();
    await vikeyRequestExport(tokens, 'reservations');
    await vikeyRequestExport(tokens, 'buro');
    return {
      ok: true,
      message: 'Export richiesti. Controlla la mail: ti arriveranno 2 link (reservations + buro). Incollali in Impostazioni per scaricare i CSV.',
    };
  } catch (e: any) {
    return { ok: false, message: e?.message ?? String(e) };
  }
}

// ========================================================================
// Sync completo automatico con Gmail API
// ========================================================================

import { pollForVikeyEmails } from './gmailFetch';
import { isGmailConnected } from './gmailAuth';

export interface FullSyncProgress {
  (phase: 'login' | 'trigger' | 'wait-mail' | 'download' | 'done' | 'error', message: string): void;
}

/**
 * Sync completo end-to-end:
 *  1. Login Vikey
 *  2. Richiede 2 export via API Vikey
 *  3. Polla Gmail API per i 2 link (fino a 3 min)
 *  4. Scarica i 2 CSV e aggiorna la cache
 *
 * Richiede che l'utente abbia già fatto il login Gmail almeno una volta.
 */
export async function runFullSync(
  onProgress: FullSyncProgress = () => {}
): Promise<{ ok: boolean; message: string; resvUrl?: string; buroUrl?: string }> {
  console.log('[SYNC] ===== Avvio runFullSync =====');

  // Verifica Gmail connesso
  if (!(await isGmailConnected())) {
    console.log('[SYNC] Gmail non connesso');
    return {
      ok: false,
      message: 'Collega prima Gmail in Impostazioni per scaricare le mail automaticamente.',
    };
  }
  console.log('[SYNC] Gmail OK, procedo');

  try {
    // 1. Login Vikey
    onProgress('login', 'Login Vikey…');
    console.log('[SYNC] Step 1: login Vikey');
    const tokens = await vikeyLogin();
    console.log('[SYNC] Login Vikey OK');

    // 2. Richiede export (ordine garantito: reservations → buro)
    const requestTime = Date.now();
    console.log('[SYNC] Step 2: richiesta export reservations (ts=' + requestTime + ')');
    onProgress('trigger', 'Richiedo export prenotazioni…');
    await vikeyRequestExport(tokens, 'reservations');
    console.log('[SYNC] Export reservations richiesto');
    await new Promise((r) => setTimeout(r, 2000));
    console.log('[SYNC] Step 2b: richiesta export buro');
    onProgress('trigger', 'Richiedo export ospiti…');
    await vikeyRequestExport(tokens, 'buro');
    console.log('[SYNC] Export buro richiesto');

    // 3. Polling Gmail
    console.log('[SYNC] Step 3: inizio polling Gmail');
    onProgress('wait-mail', 'Attendo email…');
    const links = await pollForVikeyEmails({
      afterTimestamp: requestTime - 60_000,
      onProgress: (found, total, msg) => {
        console.log(`[SYNC] Polling: ${found}/${total} - ${msg}`);
        onProgress('wait-mail', `${msg} (${found}/${total})`);
      },
      timeoutMs: 3 * 60 * 1000,
      pollIntervalMs: 15_000,
    });
    console.log('[SYNC] Polling finito. Link reservations:', links.reservations ? 'TROVATO' : 'NON TROVATO', '| Link buro:', links.buro ? 'TROVATO' : 'NON TROVATO');

    if (!links.reservations || !links.buro) {
      const got = (links.reservations ? 1 : 0) + (links.buro ? 1 : 0);
      console.log('[SYNC] INCOMPLETO: ' + got + '/2 link trovati');
      return {
        ok: false,
        message: `Timeout: trovate ${got}/2 email. Riprova o scarica manualmente i link.`,
        resvUrl: links.reservations,
        buroUrl: links.buro,
      };
    }

    // 4. Download entrambi i CSV
    console.log('[SYNC] Step 4a: download reservations.csv da', links.reservations);
    onProgress('download', 'Scarico reservations.csv…');
    await downloadCsvFromUrl(links.reservations, 'reservations');
    console.log('[SYNC] Reservations scaricato');
    console.log('[SYNC] Step 4b: download buro.csv da', links.buro);
    onProgress('download', 'Scarico buro.csv…');
    await downloadCsvFromUrl(links.buro, 'buro');
    console.log('[SYNC] Buro scaricato');

    onProgress('done', 'Sync completo!');
    console.log('[SYNC] ===== runFullSync COMPLETATO =====');
    return {
      ok: true,
      message: 'Sincronizzazione completata con successo',
      resvUrl: links.reservations,
      buroUrl: links.buro,
    };
  } catch (e: any) {
    console.error('[SYNC] ERRORE in runFullSync:', e);
    console.error('[SYNC] Error message:', e?.message);
    console.error('[SYNC] Error name:', e?.name);
    console.error('[SYNC] Error stack:', e?.stack);
    onProgress('error', e?.message ?? String(e));
    return { ok: false, message: e?.message ?? String(e) };
  }
}
