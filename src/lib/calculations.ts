import type {
  Reservation,
  BudgetParams,
  BudgetMonthRow,
  LocalCode,
  CleaningPreferences,
  CleaningOverride,
  CleaningSession,
  FatturaPulizieMonth,
  CostComponents,
  CleaningFormulas,
} from './types';
import { LOCAL_CODES, MESI_IT } from './types';
import { computeStayCost, computeStayCostWithFormulas, computeStayCostWithOverrides } from './storage';

// ---------------- DASHBOARD PIVOT ----------------

export interface PivotCell {
  guests: number;
  pernotti: number;
  lordo: number;
  profit: number;
  count: number;
}

export interface DashboardPivot {
  byMonthLocal: Record<string, Record<string, PivotCell>>;
  totals: Record<string, PivotCell>;
  monthKeys: string[];
  locals: string[];
}

function emptyCell(): PivotCell { return { guests: 0, pernotti: 0, lordo: 0, profit: 0, count: 0 }; }
function addTo(cell: PivotCell, r: Reservation) {
  cell.guests += r.guests_num;
  cell.pernotti += r.pernotti ?? 0;
  cell.lordo += r.lordo ?? 0;
  cell.profit += r.profit ?? 0;
  cell.count += 1;
}

export function buildDashboardPivot(reservations: Reservation[]): DashboardPivot {
  const byMonthLocal: DashboardPivot['byMonthLocal'] = {};
  const totals: Record<string, PivotCell> = {};
  const monthKeysSet = new Set<string>();
  const localsSet = new Set<string>();

  for (const r of reservations) {
    if (!r.month_key || !r.local_name) continue;
    monthKeysSet.add(r.month_key);
    localsSet.add(r.local_name);
    byMonthLocal[r.month_key] ??= {};
    byMonthLocal[r.month_key][r.local_name] ??= emptyCell();
    addTo(byMonthLocal[r.month_key][r.local_name], r);
    totals[r.local_name] ??= emptyCell();
    addTo(totals[r.local_name], r);
  }
  return {
    byMonthLocal,
    totals,
    monthKeys: [...monthKeysSet].sort(),
    locals: [...localsSet].sort(),
  };
}

// ---------------- COUNTRY ----------------
export interface CountryAgg {
  country: string;
  lordo: number;
  count: number;
  guests: number;
  pernotti: number;
}
export function buildCountryAnalysis(reservations: Reservation[], filterLocal?: string): CountryAgg[] {
  const m: Record<string, CountryAgg> = {};
  for (const r of reservations) {
    if (filterLocal && filterLocal !== 'ALL' && r.local_name !== filterLocal) continue;
    const c = r.nationality ?? 'Unknown';
    m[c] ??= { country: c, lordo: 0, count: 0, guests: 0, pernotti: 0 };
    m[c].lordo += r.lordo ?? 0;
    m[c].count += 1;
    m[c].guests += r.guests_num;
    m[c].pernotti += r.pernotti ?? 0;
  }
  return Object.values(m).sort((a, b) => b.lordo - a.lordo);
}

// ---------------- BUDGET MENSILE ----------------
export function buildBudgetMonthly(
  reservations: Reservation[],
  year: number,
  budget: BudgetParams,
  locals?: string[],
): { byLocal: Record<string, BudgetMonthRow[]>; totals: BudgetMonthRow[] } {
  const yearRows = reservations.filter((r) => r.year === year);
  const effectiveLocals = locals && locals.length > 0 ? locals : (LOCAL_CODES as unknown as string[]);
  const byLocal: Record<string, BudgetMonthRow[]> = {};
  for (const l of effectiveLocals) byLocal[l] = [];
  const totals: BudgetMonthRow[] = [];

  for (let m = 1; m <= 12; m++) {
    const month_key = `${year}-${String(m).padStart(2, '0')}`;
    const tot: BudgetMonthRow = {
      local: 'TOTALE',
      mese: MESI_IT[m - 1],
      month_key,
      numero_soggiorni: 0, pernotti: 0, lordo: 0,
      commissioni: 0, tassa_soggiorno: 0, cedolare_secca: 0,
      pulizie: 0, costi_fissi: 0, profitto_netto: 0,
    };

    for (const local of effectiveLocals) {
      const rows = yearRows.filter((r) => r.month === m && r.local_name === local);
      const numero_soggiorni = rows.length;
      const pernotti = rows.reduce((s, r) => s + (r.pernotti ?? 0), 0);
      const lordo = rows.reduce((s, r) => s + (r.lordo ?? 0), 0);
      const commissioni = lordo * (budget.commissioni ?? 0.19);
      const tassa_soggiorno = pernotti * (budget.tassa_soggiorno_pp ?? 6.3);
      const netto_platforma = lordo - commissioni;
      // cedolare/pulizie/fixed: fallback se la casa non è in budget params
      const cedolareRate = (budget.cedolare as any)[local] ?? 0.21;
      const cedolare_secca = netto_platforma * cedolareRate;
      const laundry = (budget.laundry_per_stay as any)[local] ?? 0;
      const cleaning = (budget.cleaning_per_stay as any)[local] ?? 0;
      const pulizie = numero_soggiorni * (laundry + cleaning);
      const ff = (budget.fixed_monthly as any)[local];
      const costi_fissi = ff ? ff.electricity + ff.gas + ff.internet + ff.condo : 0;
      const profitto_netto = netto_platforma - cedolare_secca - tassa_soggiorno - pulizie - costi_fissi;

      const row: BudgetMonthRow = {
        local: local as any, mese: MESI_IT[m - 1], month_key,
        numero_soggiorni, pernotti, lordo, commissioni,
        tassa_soggiorno, cedolare_secca, pulizie, costi_fissi, profitto_netto,
      };
      byLocal[local].push(row);
      tot.numero_soggiorni += numero_soggiorni;
      tot.pernotti += pernotti;
      tot.lordo += lordo;
      tot.commissioni += commissioni;
      tot.tassa_soggiorno += tassa_soggiorno;
      tot.cedolare_secca += cedolare_secca;
      tot.pulizie += pulizie;
      tot.costi_fissi += costi_fissi;
      tot.profitto_netto += profitto_netto;
    }
    totals.push(tot);
  }
  return { byLocal, totals };
}

export function sumBudget(rows: BudgetMonthRow[]): BudgetMonthRow {
  const t: BudgetMonthRow = {
    local: 'TOTALE', mese: 'Totale', month_key: '',
    numero_soggiorni: 0, pernotti: 0, lordo: 0, commissioni: 0,
    tassa_soggiorno: 0, cedolare_secca: 0, pulizie: 0, costi_fissi: 0, profitto_netto: 0,
  };
  for (const r of rows) {
    t.numero_soggiorni += r.numero_soggiorni;
    t.pernotti += r.pernotti;
    t.lordo += r.lordo;
    t.commissioni += r.commissioni;
    t.tassa_soggiorno += r.tassa_soggiorno;
    t.cedolare_secca += r.cedolare_secca;
    t.pulizie += r.pulizie;
    t.costi_fissi += r.costi_fissi;
    t.profitto_netto += r.profitto_netto;
  }
  return t;
}

// ---------------- CLEANING SCHEDULE ----------------
function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Genera le sessioni di pulizia dalle prenotazioni + applica gli override */
export function generateCleaningSessions(
  reservations: Reservation[],
  prefs: CleaningPreferences,
  overrides: CleaningOverride[],
  costs?: CostComponents | null,
  formulas?: CleaningFormulas | null,
): CleaningSession[] {
  const ovMap = new Map(overrides.map((o) => [o.resv_key, o]));
  const sessions: CleaningSession[] = [];

  // Raggruppa per casa per trovare "prossima prenotazione"
  const byLocal = new Map<string, Reservation[]>();
  for (const r of reservations) {
    if (!r.local_name) continue;
    const arr = byLocal.get(r.local_name) ?? [];
    arr.push(r);
    byLocal.set(r.local_name, arr);
  }
  for (const [l, arr] of byLocal) {
    arr.sort((a, b) => a.date_from.localeCompare(b.date_from));
    byLocal.set(l, arr);
  }

  for (const r of reservations) {
    if (!r.local_name) continue;
    const local = r.local_name;
    const ov = ovMap.get(r.resv_key);
    const offset = prefs.offsets[local] ?? 0;
    const defaultDate = addDays(r.date_to, offset);
    const defaultTimes = prefs.times[local] ?? { from: '10:00', to: '15:00' };

    // Prossima prenotazione stessa casa
    const list = byLocal.get(local) ?? [];
    const next = list.find((x) => x.date_from > r.date_to);
    const defaultGuests = next ? next.guests_num : r.guests_num;
    const guestsUsed = ov?.custom_guests ?? defaultGuests;

    // Costo da formula pura
    const formulaCost = costs
      ? (formulas
          ? computeStayCostWithFormulas(local, guestsUsed, costs, formulas)
          : computeStayCost(local as LocalCode, guestsUsed, costs))
      : 0;
    // Costo con override kit
    const hasKitOverride = !!ov && (
      ov.custom_KM_qty !== undefined || ov.custom_KS_qty !== undefined ||
      ov.custom_CI_qty !== undefined || ov.custom_KB_qty !== undefined ||
      ov.custom_base_eur !== undefined
    );
    const costAfterKitOverride = (hasKitOverride && costs && formulas)
      ? computeStayCostWithOverrides(local, guestsUsed, costs, formulas, ov)
      : formulaCost;
    const finalCost = ov?.custom_cost_eur ?? costAfterKitOverride;

    sessions.push({
      resv_key: r.resv_key,
      local,
      guest_name: r.name ?? '—',
      guests_num: r.guests_num,
      checkout_date: r.date_to,
      date: ov?.custom_date ?? defaultDate,
      from: ov?.custom_from ?? defaultTimes.from,
      to: ov?.custom_to ?? defaultTimes.to,
      note: ov?.note,
      completed: ov?.completed,
      skipped: ov?.skipped,
      next_guests: next?.guests_num,
      custom_guests: ov?.custom_guests,
      custom_cost_eur: ov?.custom_cost_eur,
      cost_reason: ov?.cost_reason,
      formula_cost: formulaCost,
      final_cost: finalCost,
      hasOverride: !!ov && (
        !!ov.custom_date || !!ov.custom_from || !!ov.custom_to ||
        !!ov.note || !!ov.completed || !!ov.skipped ||
        ov.custom_guests !== undefined || ov.custom_cost_eur !== undefined ||
        ov.custom_KM_qty !== undefined || ov.custom_KS_qty !== undefined ||
        ov.custom_CI_qty !== undefined || ov.custom_KB_qty !== undefined ||
        ov.custom_base_eur !== undefined
      ),
    });
  }
  return sessions.sort((a, b) => a.date.localeCompare(b.date));
}

// ---------------- FATTURA PULIZIE AUTO-CALC ----------------

/** Calcola il totale fattura atteso per un mese/casa dalle reservations */
/**
 * Costo fattura pulizie per un mese×casa.
 *
 * Logica: la pulizia avviene al check-out e prepara la casa per la prenotazione
 * SUCCESSIVA. Quindi:
 *  - si contano i CHECK-OUT avvenuti nel mese target (r.date_to in quel mese)
 *  - per ogni checkout si usa il numero di ospiti della PRENOTAZIONE SUCCESSIVA
 *    nella stessa casa (ordinata per date_from)
 *  - se non esiste prenotazione successiva (ultimo soggiorno della casa),
 *    la pulizia viene comunque fatta ma si usa come fallback il numero di ospiti
 *    della prenotazione appena terminata
 */
/** Dettaglio di una singola riga della fattura pulizie (per ogni checkout nel mese) */
export interface FatturaDetailRow {
  resv_key: string;
  checkout_date: string;
  checkout_guest: string;
  /** Pax usati per il calcolo (next prenotazione, o override) */
  guests_used: number;
  /** Pax della prossima prenotazione (undefined se è l'ultimo checkout) */
  guests_next?: number;
  /** Pax originali prenotazione corrente (per info) */
  guests_current: number;
  /** Costo calcolato da formula (senza override) */
  formula_cost: number;
  /** Costo effettivo usato (potrebbe essere formula_cost o override) */
  final_cost: number;
  /** True se la riga ha un override di pax o costo */
  hasOverride: boolean;
  /** Motivo override (se presente) */
  reason?: string;
  skipped?: boolean;
}

export function computeFatturaAuto(
  reservations: Reservation[],
  local: string,
  month_key: string,
  costs: CostComponents,
  formulas?: CleaningFormulas | null,
  overrides?: CleaningOverride[] | null,
): { auto_totale_eur: number; auto_sconto_10_eur: number; auto_num_soggiorni: number; details: FatturaDetailRow[] } {
  // Tutte le prenotazioni della casa, ordinate per check-in
  const sameLocal = reservations
    .filter((r) => r.local_name === local)
    .slice()
    .sort((a, b) => a.date_from.localeCompare(b.date_from));

  const ovMap = new Map<string, CleaningOverride>();
  if (overrides) {
    for (const o of overrides) ovMap.set(o.resv_key, o);
  }

  // Filtriamo quelle che hanno CHECK-OUT nel mese target
  const checkoutsInMonth = sameLocal.filter((r) => {
    if (!r.date_to) return false;
    const d = new Date(r.date_to);
    if (Number.isNaN(d.getTime())) return false;
    const mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    return mk === month_key;
  });

  let totale = 0;
  const details: FatturaDetailRow[] = [];

  for (const r of checkoutsInMonth) {
    const ov = ovMap.get(r.resv_key);

    // Se skipped, pulizia non eseguita → salta riga
    if (ov?.skipped) {
      details.push({
        resv_key: r.resv_key,
        checkout_date: r.date_to,
        checkout_guest: r.name ?? '—',
        guests_used: 0,
        guests_current: r.guests_num,
        formula_cost: 0,
        final_cost: 0,
        hasOverride: true,
        reason: ov.cost_reason ?? 'Pulizia saltata',
        skipped: true,
      });
      continue;
    }

    // Trova la prenotazione successiva nella stessa casa
    const next = sameLocal.find((x) => x.date_from > r.date_to);
    const defaultGuests = next ? next.guests_num : r.guests_num;
    const guestsUsed = ov?.custom_guests ?? defaultGuests;

    // Costo da formula pura (senza nessun override)
    const formulaCost = formulas
      ? computeStayCostWithFormulas(local, guestsUsed, costs, formulas)
      : computeStayCost(local as LocalCode, guestsUsed, costs);

    // Costo con override dei singoli kit (se presenti)
    const hasKitOverride = !!ov && (
      ov.custom_KM_qty !== undefined || ov.custom_KS_qty !== undefined ||
      ov.custom_CI_qty !== undefined || ov.custom_KB_qty !== undefined ||
      ov.custom_base_eur !== undefined
    );
    const costAfterKitOverride = hasKitOverride && formulas
      ? computeStayCostWithOverrides(local, guestsUsed, costs, formulas, ov)
      : formulaCost;

    // custom_cost_eur ha priorità assoluta (sovrascrive tutto)
    const finalCost = ov?.custom_cost_eur ?? costAfterKitOverride;

    const hasOverride = !!ov && (
      ov.custom_guests !== undefined ||
      ov.custom_cost_eur !== undefined ||
      hasKitOverride
    );

    totale += finalCost;
    details.push({
      resv_key: r.resv_key,
      checkout_date: r.date_to,
      checkout_guest: r.name ?? '—',
      guests_used: guestsUsed,
      guests_next: next?.guests_num,
      guests_current: r.guests_num,
      formula_cost: formulaCost,
      final_cost: finalCost,
      hasOverride,
      reason: ov?.cost_reason,
    });
  }

  const sconto = totale * 0.9;
  return {
    auto_totale_eur: totale,
    auto_sconto_10_eur: sconto,
    auto_num_soggiorni: details.filter(d => !d.skipped).length,
    details,
  };
}

/** Mesi rilevanti per fattura pulizie (almeno un CHECK-OUT in quel mese×casa) */
export function enumerateFatturaMonths(
  reservations: Reservation[],
  localsFilter?: string[],
): Array<{ local: string; month_key: string }> {
  const set = new Set<string>();
  const allowed = localsFilter ? new Set(localsFilter) : null;
  for (const r of reservations) {
    if (!r.local_name || !r.date_to) continue;
    if (allowed && !allowed.has(r.local_name)) continue;
    const d = new Date(r.date_to);
    if (Number.isNaN(d.getTime())) continue;
    const mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    set.add(`${r.local_name}|${mk}`);
  }
  return [...set]
    .map((k) => {
      const [local, month_key] = k.split('|');
      return { local, month_key };
    })
    .sort((a, b) => b.month_key.localeCompare(a.month_key) || a.local.localeCompare(b.local));
}

// ---------------- UPCOMING / IN-PROGRESS ----------------
export interface ReservationBuckets {
  inProgress: Reservation[];
  upcoming: Reservation[];
}
export function buildUpcomingBuckets(reservations: Reservation[], today = new Date()): ReservationBuckets {
  const t = today.toISOString().slice(0, 10);
  const plus30 = addDays(t, 30);
  const inProgress: Reservation[] = [];
  const upcoming: Reservation[] = [];
  for (const r of reservations) {
    if (r.date_from <= t && r.date_to >= t) inProgress.push(r);
    else if (r.date_from > t && r.date_from <= plus30) upcoming.push(r);
  }
  inProgress.sort((a, b) => a.date_to.localeCompare(b.date_to));
  upcoming.sort((a, b) => a.date_from.localeCompare(b.date_from));
  return { inProgress, upcoming };
}

// ---------------- GEO PROJECTION ----------------
/** Proiezione Mercator semplificata per SVG */
export function projectLatLng(lat: number, lng: number, width: number, height: number) {
  const x = (lng + 180) * (width / 360);
  const latRad = (lat * Math.PI) / 180;
  const mercN = Math.log(Math.tan(Math.PI / 4 + latRad / 2));
  // clip la latitudine per non esplodere ai poli
  const maxMerc = Math.log(Math.tan(Math.PI / 4 + (85 * Math.PI) / 180 / 2));
  const y = height / 2 - (width * mercN) / (2 * Math.PI);
  return { x, y: Math.max(0, Math.min(height, y)) };
}
