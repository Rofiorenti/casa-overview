import Papa from 'papaparse';
import type { Reservation, LocalCode, BudgetParams } from './types';

/** Normalizza prefisso internazionale dal campo guest_phone per mappare a Paese ISD */
const ISD_MAP: Array<{ prefix: string; country: string }> = [
  { prefix: '1', country: 'USA/Canada' },
  { prefix: '7', country: 'Russia' },
  { prefix: '20', country: 'Egypt' },
  { prefix: '27', country: 'South Africa' },
  { prefix: '30', country: 'Greece' },
  { prefix: '31', country: 'Netherlands' },
  { prefix: '32', country: 'Belgium' },
  { prefix: '33', country: 'France' },
  { prefix: '34', country: 'Spain' },
  { prefix: '36', country: 'Hungary' },
  { prefix: '39', country: 'Italy' },
  { prefix: '40', country: 'Romania' },
  { prefix: '41', country: 'Switzerland' },
  { prefix: '43', country: 'Austria' },
  { prefix: '44', country: 'United Kingdom' },
  { prefix: '45', country: 'Denmark' },
  { prefix: '46', country: 'Sweden' },
  { prefix: '47', country: 'Norway' },
  { prefix: '48', country: 'Poland' },
  { prefix: '49', country: 'Germany' },
  { prefix: '212', country: 'Morocco' },
  { prefix: '351', country: 'Portugal' },
  { prefix: '352', country: 'Luxembourg' },
  { prefix: '353', country: 'Ireland' },
  { prefix: '356', country: 'Malta' },
  { prefix: '420', country: 'Czech Republic' },
  { prefix: '55', country: 'Brazil' },
  { prefix: '56', country: 'Chile' },
  { prefix: '61', country: 'Australia' },
  { prefix: '81', country: 'Japan' },
  { prefix: '86', country: 'China' },
  { prefix: '852', country: 'Hong Kong' },
  { prefix: '971', country: 'UAE' },
  { prefix: '972', country: 'Israel' },
];

export function phoneToCountry(phone: string | undefined): string {
  if (!phone) return 'Unknown';
  const cleaned = String(phone).replace(/\D/g, '');
  // Match longest prefix first
  const sorted = [...ISD_MAP].sort((a, b) => b.prefix.length - a.prefix.length);
  for (const { prefix, country } of sorted) {
    if (cleaned.startsWith(prefix)) return country;
  }
  return 'Unknown';
}

function toNum(v: unknown): number {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') return v;
  const s = String(v).trim().replace(/\s/g, '').replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function toDateIso(v: unknown): string {
  if (!v) return '';
  const s = String(v).trim();
  // Vikey tipico: "2026-07-06 15:00:00"
  const d = new Date(s.replace(' ', 'T'));
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return '';
}

export interface ParseOptions {
  budget: BudgetParams;
  /** Indice VV14/DA23 per NETTO 26% (nel tuo Excel spesso 0.918 o 1) */
  indice_vv_da?: number;
}

/** Parsa il CSV e calcola tutti i campi derivati replicando le formule dell'Excel */
export function parseVikeyCsv(csvText: string, opts: ParseOptions): Reservation[] {
  const { budget, indice_vv_da = 0.918 } = opts;

  const { data } = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (h) => h.trim(),
  });

  const rows: Reservation[] = [];
  for (const r of data) {
    if (!r.resv_key) continue;

    const date_from = toDateIso(r.date_from);
    const date_to = toDateIso(r.date_to);
    const local_name = (r.local_name || '').trim() as LocalCode;
    const guests_num = Math.max(1, toNum(r.guests_num));
    const price = toNum(r.price);
    const nightnum = toNum(r.nightnum);
    const channel = (r.channel || 'OTHER').trim().toUpperCase();
    const cancelled = String(r.DEL ?? r.del ?? '').toLowerCase() === 'true' || r.checkin_status === 'DEL';

    // === LORDO ===
    // price è il netto piattaforma; lordo = price / (1 - commissioni)
    const commissioni = budget.commissioni ?? 0.19;
    const lordo = price > 0 ? price / (1 - commissioni) : 0;

    // === NETTO 21% (cedolare) ===
    const cedolare = budget.cedolare[local_name as LocalCode] ?? 0.21;
    const netto21 = lordo * (1 - cedolare);

    // === NETTO (VV14/DA23 applicano un ulteriore indice) ===
    const netto = local_name === 'C3A' ? netto21 : netto21 * indice_vv_da;

    // === PULIZIE ===
    const laundry = budget.laundry_per_stay[local_name as LocalCode] ?? 0;
    const cleaning = budget.cleaning_per_stay[local_name as LocalCode] ?? 0;
    const pulizie_costo = laundry + cleaning;

    // === PROFIT ===
    const profit = netto - pulizie_costo;
    const profit_night = nightnum > 0 ? profit / nightnum : 0;

    // === PERNOTTI ===
    const pernotti = guests_num * nightnum;

    // === TASSA SOGGIORNO ===
    const tax_pp = budget.tassa_soggiorno_pp ?? 6.3;
    const tassa_soggiorno = guests_num * nightnum * tax_pp;

    // === MONTH KEY ===
    const d = new Date(date_from);
    const month_key = !Number.isNaN(d.getTime())
      ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      : '';
    const year = !Number.isNaN(d.getTime()) ? d.getFullYear() : 0;
    const month = !Number.isNaN(d.getTime()) ? d.getMonth() + 1 : 0;

    rows.push({
      resv_key: r.resv_key,
      external_key: r.external_key,
      date_from,
      date_to,
      checkin_status: r.checkin_status,
      name: r.name,
      guest_email: r.guest_email,
      guests_num,
      guest_phone: r.guest_phone,
      channel,
      price,
      nightnum,
      lang: r.lang,
      local_name,
      local_city: r.local_city,
      local_address: r.local_address,
      local_turismo5_id: r.local_turismo5_id,
      cancelled,

      lordo,
      netto21,
      netto,
      pulizie_costo,
      profit,
      profit_night,
      pernotti,
      tassa_soggiorno,
      month_key,
      year,
      month,
      nationality: phoneToCountry(r.guest_phone),
    });
  }

  // filtra cancellate
  return rows.filter((r) => !r.cancelled);
}
