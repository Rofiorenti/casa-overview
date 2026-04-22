import type { GuestRecord, Reservation, TaxCategory, BudgetParams } from './types';
import { MESI_IT } from './types';

// ------------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------------
function ageOnDate(birthdate: string | undefined, refDate: string): number | null {
  if (!birthdate) return null;
  const b = new Date(birthdate);
  const r = new Date(refDate);
  if (isNaN(b.getTime()) || isNaN(r.getTime())) return null;
  let age = r.getFullYear() - b.getFullYear();
  const mDiff = r.getMonth() - b.getMonth();
  if (mDiff < 0 || (mDiff === 0 && r.getDate() < b.getDate())) age--;
  return age;
}

function isResidenteMilano(g: GuestRecord): boolean {
  const city = (g.residence_city ?? '').trim().toLowerCase();
  if (!city) return false;
  if (city === 'milano') return true;
  if (city === 'f205') return true;
  return false;
}

export function categorize(g: GuestRecord, isAirbnb: boolean): TaxCategory {
  const age = ageOnDate(g.birthdate, g.date_from);
  if (age !== null && age < 18) return 'minori';
  if (isResidenteMilano(g)) return 'residenti_milano';
  if (isAirbnb) return 'airbnb';
  return 'paganti_ota';
}

interface NightsPerMonth { [month_key: string]: number; }

function nightsByMonth(date_from: string, date_to: string): NightsPerMonth {
  const out: NightsPerMonth = {};
  const start = new Date(date_from);
  const end = new Date(date_to);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) return out;
  const cur = new Date(start);
  while (cur < end) {
    const key = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`;
    out[key] = (out[key] ?? 0) + 1;
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

// ------------------------------------------------------------------------
// Aggregazione per trimestre/mese
// ------------------------------------------------------------------------

/** Una cella = un (categoria × locale × mese). Contiene ospiti distinti e pernotti. */
export interface TaxCell {
  guests: number;    // numero di ospiti in questo conteggio
  pernotti: number;  // numero di pernotti (persone × notti)
}

const EMPTY_CELL = (): TaxCell => ({ guests: 0, pernotti: 0 });

export interface TaxMonthCell {
  year: number;
  month: number;
  month_key: string;
  local: string;
  byCategory: Record<TaxCategory, TaxCell>;
  /** Tariffa * pernotti_paganti_ota (Airbnb paga direttamente) */
  importo_dovuto: number;
}

function emptyMonthCell(year: number, month: number, local: string): TaxMonthCell {
  return {
    year, month,
    month_key: `${year}-${String(month).padStart(2, '0')}`,
    local,
    byCategory: {
      paganti_ota: EMPTY_CELL(),
      airbnb: EMPTY_CELL(),
      minori: EMPTY_CELL(),
      residenti_milano: EMPTY_CELL(),
    },
    importo_dovuto: 0,
  };
}

interface AggregateParams {
  year: number;
  budget: BudgetParams;
  guests: GuestRecord[];
  reservations: Reservation[];
  locals: string[];  // solo quelle visibili
}

export function buildTaxMonthly({ year, budget, guests, reservations, locals }: AggregateParams) {
  const localsSet = new Set(locals);
  const byLocal: Record<string, TaxMonthCell[]> = {};
  for (const l of locals) {
    byLocal[l] = [];
    for (let m = 1; m <= 12; m++) byLocal[l].push(emptyMonthCell(year, m, l));
  }

  const tariffa = budget.tassa_soggiorno_pp ?? 0;

  // Indicizza i guests per resv_key
  const guestsByResv = new Map<string, GuestRecord[]>();
  for (const g of guests) {
    if (!localsSet.has(g.local_name)) continue;
    const arr = guestsByResv.get(g.resv_key) ?? [];
    arr.push(g);
    guestsByResv.set(g.resv_key, arr);
  }

  for (const r of reservations) {
    if (!localsSet.has(r.local_name)) continue;
    if (r.cancelled) continue;
    const local = r.local_name;
    const gs = guestsByResv.get(r.resv_key);
    const isAirbnb = (r.channel ?? '').toUpperCase() === 'AIRBNB';
    const nights = nightsByMonth(r.date_from, r.date_to);

    if (gs && gs.length > 0) {
      // Per ogni ospite, determina la categoria e contribuisce con le proprie notti
      for (const g of gs) {
        if (g.cancelled) continue;
        const cat = categorize(g, isAirbnb);
        for (const [mkey, count] of Object.entries(nights)) {
          const [yStr, mStr] = mkey.split('-');
          if (Number(yStr) !== year) continue;
          const m = Number(mStr);
          const cell = byLocal[local][m - 1].byCategory[cat];
          // Un guest = 1 persona. Incremento guests di 1 *solo nel primo mese* per non duplicare
          // l'ospite distinto? No: per come vogliamo contare (ospiti totali in un mese), se un
          // ospite sta in due mesi, conta in entrambi i mesi. È più utile così.
          cell.guests += 1;
          cell.pernotti += count;
        }
      }
    } else {
      // Fallback senza buro: considero tutti in una categoria "generica"
      // → se Airbnb va in airbnb, altrimenti paganti_ota
      const cat: TaxCategory = isAirbnb ? 'airbnb' : 'paganti_ota';
      const guests_num = Math.max(1, r.guests_num);
      for (const [mkey, count] of Object.entries(nights)) {
        const [yStr, mStr] = mkey.split('-');
        if (Number(yStr) !== year) continue;
        const m = Number(mStr);
        const cell = byLocal[local][m - 1].byCategory[cat];
        cell.guests += guests_num;
        cell.pernotti += count * guests_num;
      }
    }
  }

  // Importo dovuto: solo paganti_ota pagano a me (Airbnb versa direttamente)
  for (const l of locals) {
    for (const c of byLocal[l]) {
      c.importo_dovuto = c.byCategory.paganti_ota.pernotti * tariffa;
    }
  }

  // Totali annuo per casa
  const totals: Record<string, TaxMonthCell> = {};
  for (const l of locals) {
    const t = emptyMonthCell(year, 0, l);
    for (const c of byLocal[l]) {
      (['paganti_ota', 'airbnb', 'minori', 'residenti_milano'] as TaxCategory[]).forEach((cat) => {
        t.byCategory[cat].guests += c.byCategory[cat].guests;
        t.byCategory[cat].pernotti += c.byCategory[cat].pernotti;
      });
      t.importo_dovuto += c.importo_dovuto;
    }
    totals[l] = t;
  }

  return {
    byLocal,
    totals,
    hasBuroData: guests.length > 0,
    months: MESI_IT.map((m, i) => ({ num: i + 1, name: m })),
  };
}

/** Determina quali mesi mostrare per un trimestre (1-4) */
export function quarterMonths(q: number): number[] {
  return [(q - 1) * 3 + 1, (q - 1) * 3 + 2, (q - 1) * 3 + 3];
}
