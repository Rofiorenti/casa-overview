import Papa from 'papaparse';
import type { GuestRecord, LocalCode } from './types';

/**
 * Parser tollerante del CSV "burocrazia" di Vikey: una riga per singolo ospite,
 * con i dati di documento/nascita/residenza.
 *
 * Il formato preciso del CSV può variare per versioni/export. Il parser
 * accetta un ampio set di alias per ciascun campo.
 */

function pick<T extends string>(row: Record<string, any>, candidates: T[]): string {
  for (const k of candidates) {
    const v = row[k];
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
  }
  return '';
}

/** Normalizza data: accetta "YYYY-MM-DD", "DD-MM-YYYY", "DD/MM/YYYY", "YYYY-MM-DD HH:MM:SS" */
function normalizeDate(s: string): string {
  if (!s) return '';
  const clean = s.trim().split(/\s+/)[0]; // toglie ora
  // ISO già
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;
  // DD-MM-YYYY o DD/MM/YYYY
  const m = clean.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (m) {
    const [, d, mo, y] = m;
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return clean;
}

function parseBool(v: any): boolean {
  if (v === true) return true;
  const s = String(v ?? '').trim().toLowerCase();
  return s === 'true' || s === '1' || s === 'yes' || s === 'si';
}

function parseNum(v: any): number | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : undefined;
}

export function parseBuroCsv(csvText: string): GuestRecord[] {
  if (!csvText) return [];

  // Prova prima con punto e virgola (default Vikey IT), poi con virgola
  let parsed = Papa.parse<Record<string, any>>(csvText, {
    header: true,
    skipEmptyLines: true,
    delimiter: ';',
  });
  if (parsed.errors.length > 0 || parsed.data.length === 0) {
    parsed = Papa.parse<Record<string, any>>(csvText, {
      header: true,
      skipEmptyLines: true,
      delimiter: ',',
    });
  }

  const out: GuestRecord[] = [];
  for (const r of parsed.data) {
    const resv_key = pick(r, [
      'resv_key', 'reservation_key', 'reservationKey', 'reservation_id', 'id_resv', 'prenotazione',
    ]);
    if (!resv_key) continue;
    if (parseBool(pick(r, ['DEL', 'deleted', 'cancelled', 'cancellata']))) continue;

    const local_name = pick(r, ['local_name', 'localname', 'casa', 'struttura_name']);
    const date_from = normalizeDate(pick(r, ['date_from', 'checkin', 'data_from', 'data_checkin']));
    const date_to = normalizeDate(pick(r, ['date_to', 'checkout', 'data_to', 'data_checkout']));
    if (!date_from || !date_to) continue;

    const birthdate = normalizeDate(pick(r, [
      'dateofbirth', 'date_of_birth', 'birthdate', 'birth_date', 'data_nascita', 'nascita',
    ]));

    out.push({
      resv_key,
      local_name: local_name as LocalCode,
      date_from,
      date_to,
      channel: pick(r, ['channel', 'canale']),
      cancelled: parseBool(pick(r, ['DEL', 'cancelled'])),
      name: pick(r, ['name', 'firstname', 'first_name', 'nome']),
      surname: pick(r, ['surname', 'lastname', 'last_name', 'cognome']),
      birthdate,
      birthplace: pick(r, ['placeofbirth', 'place_of_birth', 'birthplace', 'comune_nascita', 'luogo_nascita']),
      residence_city: pick(r, [
        'residence_city', 'residence', 'residence_comune', 'city_of_residence',
        'comune_residenza', 'residenza_comune', 'city', 'residenza',
      ]),
      residence_province: pick(r, [
        'residence_province', 'residence_prov', 'provincia_residenza', 'residenza_provincia',
      ]),
      residence_country: pick(r, [
        'residence_country', 'country_of_residence', 'stato_residenza', 'residenza_stato', 'nazione_residenza',
      ]),
      nationality: pick(r, ['nationality', 'citizenship', 'cittadinanza', 'nazionalita']),
      document_type: pick(r, ['document_type', 'doc_type', 'tipo_documento']),
      document_number: pick(r, ['document_number', 'doc_number', 'numero_documento']),
      num_paganti: parseNum(pick(r, ['num_paganti', 'paying_guests'])),
      citytax_tot: parseNum(pick(r, ['citytax_tot', 'city_tax', 'tassa_soggiorno'])),
    });
  }
  return out;
}
