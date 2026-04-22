import { Preferences } from '@capacitor/preferences';
import type {
  Credentials,
  DataSourceConfig,
  BudgetParams,
  CostComponents,
  LocalCode,
  CleaningPreferences,
  CleaningOverride,
  ReservationNote,
  FatturaPulizieMonth,
  VisibilityPrefs,
  CleaningFormulas,
  CleaningFormulaHouse,
  CleaningFormulaRow,
} from './types';

// ----- KEYS -----
const KEY_CREDS = 'co.credentials.v1';
const KEY_DATASRC = 'co.data_source.v1';
const KEY_BUDGET_ACTIVE = 'co.budget.active_year';
const KEY_BUDGET = (year: number) => `co.budget.${year}.v1`;
const KEY_COSTS = 'co.cost_components.v1';
const KEY_CLEAN_PREFS = 'co.clean.prefs.v1';
const KEY_CLEAN_OVERRIDES = 'co.clean.overrides.v1';
const KEY_RESV_NOTES = 'co.resv.notes.v1';
const KEY_FATTURA = 'co.fattura.v1';
const KEY_CSV_CACHE = 'co.csv.cache.v1';
const KEY_CSV_META = 'co.csv.meta.v1';
const KEY_VISIBILITY = 'co.visibility.v1';
const KEY_CLEAN_FORMULAS = 'co.clean.formulas.v1';

async function getJson<T>(key: string): Promise<T | null> {
  const { value } = await Preferences.get({ key });
  if (!value) return null;
  try { return JSON.parse(value) as T; } catch { return null; }
}
async function setJson<T>(key: string, value: T): Promise<void> {
  await Preferences.set({ key, value: JSON.stringify(value) });
}

// ---------- CREDENZIALI ----------
export async function loadCredentials(): Promise<Credentials> {
  return (await getJson<Credentials>(KEY_CREDS)) ?? {
    vikey_email: '',
    vikey_password: '',
    gmail_user: '',
    gmail_app_password: '',
  };
}
export async function saveCredentials(c: Credentials): Promise<void> {
  await setJson(KEY_CREDS, c);
}

// ---------- DATA SOURCE ----------
export async function loadDataSource(): Promise<DataSourceConfig> {
  return (await getJson<DataSourceConfig>(KEY_DATASRC)) ?? {
    csv_path: '/Users/rofiorenti/scripts/casa-overview_v2/data/reservations.csv',
    buro_csv_path: '/Users/rofiorenti/scripts/casa-overview_v2/data/buro.csv',
    auto_refresh_on_open: true,
    auto_trigger_vikey_sync: true,
  };
}
export async function saveDataSource(d: DataSourceConfig): Promise<void> {
  await setJson(KEY_DATASRC, d);
}

// ---------- BUDGET ----------
const DEFAULT_BUDGET_2026: BudgetParams = {
  year: 2026,
  cedolare: { C3A: 0.21, VV14: 0.26, DA23: 0.26 },
  commissioni: 0.19,
  tassa_soggiorno_pp: 9.5,
  laundry_per_stay: { C3A: 50, VV14: 40, DA23: 35 },
  cleaning_per_stay: { C3A: 100, VV14: 50, DA23: 50 },
  fixed_monthly: {
    C3A: { electricity: 80, gas: 60, internet: 30, condo: 250 },
    DA23: { electricity: 60, gas: 30, internet: 30, condo: 180 },
    VV14: { electricity: 50, gas: 30, internet: 30, condo: 140 },
  },
  codice_fiscale: {
    C3A: 'FRNFNC64S10H037I',
    DA23: 'FRNFNC64S10H037I',
    VV14: 'FRNRRT01L11F205U',
  },
};
const DEFAULT_BUDGET_2025: BudgetParams = { ...DEFAULT_BUDGET_2026, year: 2025, tassa_soggiorno_pp: 6.3 };

export async function loadBudget(year: number): Promise<BudgetParams> {
  const b = await getJson<BudgetParams>(KEY_BUDGET(year));
  if (b) return b;
  if (year === 2025) return DEFAULT_BUDGET_2025;
  return { ...DEFAULT_BUDGET_2026, year };
}
export async function saveBudget(b: BudgetParams): Promise<void> {
  await setJson(KEY_BUDGET(b.year), b);
}
export async function getActiveBudgetYear(): Promise<number> {
  const v = (await Preferences.get({ key: KEY_BUDGET_ACTIVE })).value;
  return v ? Number(v) : new Date().getFullYear();
}
export async function setActiveBudgetYear(y: number): Promise<void> {
  await Preferences.set({ key: KEY_BUDGET_ACTIVE, value: String(y) });
}

// ---------- COST COMPONENTS ----------
const DEFAULT_COSTS: CostComponents = { KM: 12.7, KS: 8.5, CI: 0.4, KB: 0.6, CP: 95, VVP: 50, DAP: 50 };
export async function loadCosts(): Promise<CostComponents> {
  return (await getJson<CostComponents>(KEY_COSTS)) ?? DEFAULT_COSTS;
}
export async function saveCosts(c: CostComponents): Promise<void> {
  await setJson(KEY_COSTS, c);
}

// ---------- CLEANING FORMULAS (per-casa, dinamico) ----------

/**
 * Formula default per le case storiche (replicata dalla formula hardcoded legacy).
 * Genera righe per guests = 1..max.
 */
function makeLegacyFormula(local: LocalCode): CleaningFormulaHouse {
  const maxGuests = 8;
  const rows: CleaningFormulaRow[] = [];
  for (let n = 1; n <= maxGuests; n++) {
    let KM_qty = 0, KS_qty = 0, CI_qty = 0, KB_qty = 0;
    if (local === 'C3A') {
      // 4*KM + 6*CI + n*KB + CP (base 95)
      KM_qty = 4; CI_qty = 6; KB_qty = n;
    } else if (local === 'VV14') {
      // VVP + 4*CI + n*KB + KM + KS adjustments
      KM_qty = 1; CI_qty = 4; KB_qty = n;
      if (n === 2) KS_qty = 1;
      else if (n === 3 || n === 4) KS_qty = 2;
      else if (n >= 5) { KM_qty = 2; KS_qty = 2; }
    } else if (local === 'DA23') {
      // DAP + 4*CI + n*KB + KM*{1,2,3}
      CI_qty = 4; KB_qty = n;
      if (n === 1) KM_qty = 1;
      else if (n === 2) KM_qty = 2;
      else KM_qty = 3;
    }
    rows.push({ guests: n, KM_qty, KS_qty, CI_qty, KB_qty });
  }
  const base_eur = local === 'C3A' ? 95 : local === 'VV14' ? 50 : local === 'DA23' ? 50 : 0;
  return { max_guests: maxGuests, base_eur, rows };
}

const DEFAULT_CLEAN_FORMULAS: CleaningFormulas = {
  C3A: makeLegacyFormula('C3A'),
  VV14: makeLegacyFormula('VV14'),
  DA23: makeLegacyFormula('DA23'),
};

export async function loadCleaningFormulas(): Promise<CleaningFormulas> {
  return (await getJson<CleaningFormulas>(KEY_CLEAN_FORMULAS)) ?? DEFAULT_CLEAN_FORMULAS;
}
export async function saveCleaningFormulas(f: CleaningFormulas): Promise<void> {
  await setJson(KEY_CLEAN_FORMULAS, f);
}

/** Crea una formula vuota per una casa nuova, con N pax massimi */
export function makeEmptyFormula(maxGuests: number = 4): CleaningFormulaHouse {
  const rows: CleaningFormulaRow[] = [];
  for (let n = 1; n <= maxGuests; n++) {
    rows.push({ guests: n, KM_qty: 0, KS_qty: 0, CI_qty: 0, KB_qty: 0 });
  }
  return { max_guests: maxGuests, base_eur: 0, rows };
}

/** Espande/contrae la tabella righe quando cambia max_guests */
export function resizeFormulaRows(f: CleaningFormulaHouse, newMax: number): CleaningFormulaHouse {
  const safe = Math.max(1, Math.min(20, Math.floor(newMax)));
  const rows: CleaningFormulaRow[] = [];
  for (let n = 1; n <= safe; n++) {
    const existing = f.rows.find(r => r.guests === n);
    rows.push(existing ?? { guests: n, KM_qty: 0, KS_qty: 0, CI_qty: 0, KB_qty: 0 });
  }
  return { ...f, max_guests: safe, rows };
}

/**
 * Calcolo costo soggiorno NUOVO (basato su formule per-casa).
 * Cerca prima la formula custom, fallback alla formula legacy hardcoded.
 */
export function computeStayCostWithFormulas(
  local: string,
  personeNum: number,
  kits: CostComponents,
  formulas: CleaningFormulas | null | undefined,
): number {
  const n = Math.max(1, personeNum);
  const f = formulas?.[local];
  if (f) {
    // Per pax oltre la tabella, usa l'ultima riga disponibile (max_guests)
    const clampedN = Math.min(n, f.max_guests);
    const row = f.rows.find(r => r.guests === clampedN);
    if (row) {
      return f.base_eur
        + row.KM_qty * kits.KM
        + row.KS_qty * kits.KS
        + row.CI_qty * kits.CI
        + row.KB_qty * kits.KB;
    }
  }
  // Fallback: formula legacy hardcoded (per C3A/VV14/DA23) o 0
  return computeStayCost(local as LocalCode, n, kits);
}

/**
 * Risolve i quantitativi effettivi (kit + base) per una pulizia, partendo dalla formula
 * della casa e applicando eventuali override puntuali presenti sull'override object.
 */
export function resolveCleaningParams(
  local: string,
  personeNum: number,
  formulas: CleaningFormulas | null | undefined,
  override?: {
    custom_KM_qty?: number;
    custom_KS_qty?: number;
    custom_CI_qty?: number;
    custom_KB_qty?: number;
    custom_base_eur?: number;
  } | null,
): { KM_qty: number; KS_qty: number; CI_qty: number; KB_qty: number; base_eur: number } {
  const n = Math.max(1, personeNum);
  const f = formulas?.[local];
  let KM_qty = 0, KS_qty = 0, CI_qty = 0, KB_qty = 0, base_eur = 0;
  if (f) {
    const clampedN = Math.min(n, f.max_guests);
    const row = f.rows.find(r => r.guests === clampedN);
    if (row) {
      KM_qty = row.KM_qty; KS_qty = row.KS_qty; CI_qty = row.CI_qty; KB_qty = row.KB_qty;
    }
    base_eur = f.base_eur;
  }
  // Applica override puntuali
  if (override?.custom_KM_qty !== undefined) KM_qty = override.custom_KM_qty;
  if (override?.custom_KS_qty !== undefined) KS_qty = override.custom_KS_qty;
  if (override?.custom_CI_qty !== undefined) CI_qty = override.custom_CI_qty;
  if (override?.custom_KB_qty !== undefined) KB_qty = override.custom_KB_qty;
  if (override?.custom_base_eur !== undefined) base_eur = override.custom_base_eur;
  return { KM_qty, KS_qty, CI_qty, KB_qty, base_eur };
}

/**
 * Calcolo costo pulizia con override selettivi sui singoli parametri.
 * Se non ci sono override sui kit, equivale a computeStayCostWithFormulas.
 */
export function computeStayCostWithOverrides(
  local: string,
  personeNum: number,
  kits: CostComponents,
  formulas: CleaningFormulas | null | undefined,
  override?: {
    custom_KM_qty?: number;
    custom_KS_qty?: number;
    custom_CI_qty?: number;
    custom_KB_qty?: number;
    custom_base_eur?: number;
  } | null,
): number {
  const p = resolveCleaningParams(local, personeNum, formulas, override);
  return p.base_eur + p.KM_qty * kits.KM + p.KS_qty * kits.KS + p.CI_qty * kits.CI + p.KB_qty * kits.KB;
}

/** Formula legacy conservata per compatibilità / fallback */
export function computeStayCost(local: LocalCode, personeNum: number, c: CostComponents): number {
  const n = Math.max(1, personeNum);
  switch (local) {
    case 'C3A':
      return 4 * c.KM + 6 * c.CI + n * c.KB + c.CP;
    case 'VV14': {
      let base = c.VVP + c.CI * 4 + c.KB * n + c.KM;
      if (n === 2) base += c.KS;
      else if (n === 3 || n === 4) base += c.KS * 2;
      else if (n >= 5) base += c.KM + c.KS * 2;
      return base;
    }
    case 'DA23': {
      let km_mult = 1;
      if (n === 2) km_mult = 2;
      else if (n >= 3) km_mult = 3;
      return c.DAP + c.CI * 4 + c.KB * n + c.KM * km_mult;
    }
    default:
      return 0;
  }
}

// ---------- CLEANING PREFERENCES ----------
const DEFAULT_CLEAN_PREFS: CleaningPreferences = {
  offsets: { C3A: 0, VV14: 0, DA23: 0 },  // stesso giorno del checkout
  times: {
    C3A: { from: '10:00', to: '15:00' },
    VV14: { from: '10:00', to: '14:00' },
    DA23: { from: '10:00', to: '14:00' },
  },
};
export async function loadCleaningPrefs(): Promise<CleaningPreferences> {
  return (await getJson<CleaningPreferences>(KEY_CLEAN_PREFS)) ?? DEFAULT_CLEAN_PREFS;
}
export async function saveCleaningPrefs(p: CleaningPreferences): Promise<void> {
  await setJson(KEY_CLEAN_PREFS, p);
}

// ---------- CLEANING OVERRIDES ----------
export async function loadCleaningOverrides(): Promise<CleaningOverride[]> {
  return (await getJson<CleaningOverride[]>(KEY_CLEAN_OVERRIDES)) ?? [];
}
export async function saveCleaningOverrides(o: CleaningOverride[]): Promise<void> {
  await setJson(KEY_CLEAN_OVERRIDES, o);
}
export async function upsertCleaningOverride(o: CleaningOverride): Promise<CleaningOverride[]> {
  const current = await loadCleaningOverrides();
  const idx = current.findIndex((x) => x.resv_key === o.resv_key);
  let next: CleaningOverride[];
  // Se l'override è "vuoto" (nessun campo utile) → rimuovilo
  const isEmpty =
    !o.custom_date && !o.custom_from && !o.custom_to && !o.note && !o.completed && !o.skipped;
  if (isEmpty) {
    next = current.filter((x) => x.resv_key !== o.resv_key);
  } else if (idx >= 0) {
    next = [...current];
    next[idx] = o;
  } else {
    next = [...current, o];
  }
  await saveCleaningOverrides(next);
  return next;
}

// ---------- RESERVATION NOTES ----------
export async function loadResvNotes(): Promise<ReservationNote[]> {
  return (await getJson<ReservationNote[]>(KEY_RESV_NOTES)) ?? [];
}
export async function saveResvNotes(n: ReservationNote[]): Promise<void> {
  await setJson(KEY_RESV_NOTES, n);
}
export async function upsertResvNote(resv_key: string, text: string): Promise<ReservationNote[]> {
  const current = await loadResvNotes();
  const now = new Date().toISOString();
  const idx = current.findIndex((x) => x.resv_key === resv_key);
  let next: ReservationNote[];
  if (!text.trim()) {
    next = current.filter((x) => x.resv_key !== resv_key);
  } else if (idx >= 0) {
    next = [...current];
    next[idx] = { resv_key, text, updated_at: now };
  } else {
    next = [...current, { resv_key, text, updated_at: now }];
  }
  await saveResvNotes(next);
  return next;
}

// ---------- FATTURA PULIZIE (ex lavanderia) ----------
export async function loadFattura(): Promise<FatturaPulizieMonth[]> {
  return (await getJson<FatturaPulizieMonth[]>(KEY_FATTURA)) ?? [];
}
export async function saveFattura(rows: FatturaPulizieMonth[]): Promise<void> {
  await setJson(KEY_FATTURA, rows);
}
export async function upsertFattura(row: FatturaPulizieMonth): Promise<FatturaPulizieMonth[]> {
  const current = await loadFattura();
  const idx = current.findIndex((x) => x.id === row.id);
  let next: FatturaPulizieMonth[];
  if (idx >= 0) {
    next = [...current];
    next[idx] = { ...row, updated_at: new Date().toISOString() };
  } else {
    next = [...current, { ...row, updated_at: new Date().toISOString() }];
  }
  await saveFattura(next);
  return next;
}

// ---------- CSV CACHE ----------
export async function getCsvCache(): Promise<{ csv: string | null; lastSync: string | null }> {
  const csv = (await Preferences.get({ key: KEY_CSV_CACHE })).value ?? null;
  const lastSync = (await Preferences.get({ key: KEY_CSV_META })).value ?? null;
  return { csv, lastSync };
}
export async function setCsvCache(csv: string): Promise<string> {
  await Preferences.set({ key: KEY_CSV_CACHE, value: csv });
  const ts = new Date().toISOString();
  await Preferences.set({ key: KEY_CSV_META, value: ts });
  return ts;
}

// ---------- VISIBILITY PREFS ----------
const DEFAULT_VISIBILITY: VisibilityPrefs = {
  visible_locals: [],
  hidden_locals: [],
  visible_years: [],
  hidden_years: [],
};
export async function loadVisibility(): Promise<VisibilityPrefs> {
  const v = await getJson<VisibilityPrefs>(KEY_VISIBILITY);
  if (!v) return DEFAULT_VISIBILITY;
  // retrocompatibilità su valori mancanti
  return {
    visible_locals: v.visible_locals ?? [],
    hidden_locals: v.hidden_locals ?? [],
    visible_years: v.visible_years ?? [],
    hidden_years: v.hidden_years ?? [],
  };
}
export async function saveVisibility(v: VisibilityPrefs): Promise<void> {
  await setJson(KEY_VISIBILITY, v);
}

