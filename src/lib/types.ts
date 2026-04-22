// ==========================================
// Casa Overview — domain types
// ==========================================

export type LocalCode = 'C3A' | 'VV14' | 'DA23';
export type Channel = 'AIRBNB' | 'BOOKING' | 'DIRECT' | 'OTHER' | string;

export interface Reservation {
  resv_key: string;
  external_key?: string;
  date_from: string;
  date_to: string;
  checkin_status?: string;
  name?: string;
  guest_email?: string;
  guests_num: number;
  guest_phone?: string;
  channel: Channel;
  price: number;
  nightnum: number;
  lang?: string;
  local_name: LocalCode | string;
  local_city?: string;
  local_address?: string;
  local_turismo5_id?: string;
  cancelled?: boolean;

  // Derived
  lordo?: number;
  netto21?: number;
  netto?: number;
  pulizie_costo?: number;
  profit?: number;
  profit_night?: number;
  pernotti?: number;
  tassa_soggiorno?: number;
  month_key?: string;
  year?: number;
  month?: number;
  nationality?: string;
}

export interface BudgetParams {
  year: number;
  cedolare: Record<LocalCode, number>;
  commissioni: number;
  tassa_soggiorno_pp: number;
  laundry_per_stay: Record<LocalCode, number>;
  cleaning_per_stay: Record<LocalCode, number>;
  fixed_monthly: Record<LocalCode, {
    electricity: number;
    gas: number;
    internet: number;
    condo: number;
  }>;
  codice_fiscale: Record<LocalCode, string>;
}

export interface Credentials {
  vikey_email: string;
  vikey_password: string;
  gmail_user: string;
  gmail_app_password: string;
}

export interface DataSourceConfig {
  csv_path: string;
  buro_csv_path: string;
  auto_refresh_on_open: boolean;
  auto_trigger_vikey_sync: boolean;
  last_sync_at?: string;
}

/** Preferenze utente su quali case/anni mostrare nell'app.
 * Se un set è vuoto, mostra TUTTE le case/anni presenti nei dati. */
export interface VisibilityPrefs {
  visible_locals: string[];  // LocalCode[] o stringhe arbitrarie (le case sono dinamiche)
  hidden_locals: string[];   // case esplicitamente nascoste
  visible_years: number[];
  hidden_years: number[];
}

// ---------- Pulizie ----------
export interface CleaningPreferences {
  /** Offset in giorni dal checkout per casa (default 0) */
  offsets: Record<string, number>;
  /** Orari di default per casa */
  times: Record<string, { from: string; to: string }>;
}

/** Override utente legato al resv_key, persistente */
export interface CleaningOverride {
  resv_key: string;
  custom_date?: string;
  custom_from?: string;
  custom_to?: string;
  note?: string;
  completed?: boolean;
  skipped?: boolean;
  /** Numero ospiti da usare per il calcolo costo (override del pax "prossima prenotazione") */
  custom_guests?: number;
  /** Override diretto del costo totale pulizia in € (sovrascrive anche la formula) */
  custom_cost_eur?: number;
  /** Motivo override costo (visibile in fattura) */
  cost_reason?: string;
  /** Override quantità singolo kit (se presente, usa questo invece di quello della formula standard) */
  custom_KM_qty?: number;
  custom_KS_qty?: number;
  custom_CI_qty?: number;
  custom_KB_qty?: number;
  /** Override del costo base fisso della casa per questa singola pulizia */
  custom_base_eur?: number;
}

/** Evento pulizia risolto */
export interface CleaningSession {
  resv_key: string;
  local: string;
  guest_name: string;
  guests_num: number;
  checkout_date: string;
  date: string;
  from: string;
  to: string;
  note?: string;
  completed?: boolean;
  skipped?: boolean;
  hasOverride: boolean;
  /** Pax della prossima prenotazione nella stessa casa (per calcolo costo pulizia) */
  next_guests?: number;
  /** Override pax per costo pulizia */
  custom_guests?: number;
  /** Override costo in euro */
  custom_cost_eur?: number;
  /** Motivo override costo */
  cost_reason?: string;
  /** Costo da formula (senza override) */
  formula_cost: number;
  /** Costo finale usato (formula o override) */
  final_cost: number;
}

// ---------- Note prenotazioni (persistenti per resv_key) ----------
export interface ReservationNote {
  resv_key: string;
  text: string;
  updated_at: string;
}

// ---------- Fattura pulizie (ex Lavanderia) ----------
export interface FatturaPulizieMonth {
  id: string;
  local: string;
  month_key: string;
  // Auto-calcolati (da reservations):
  auto_totale_eur?: number;
  auto_sconto_10_eur?: number;
  auto_num_soggiorni?: number;
  // Manuali:
  prezzo_effettivo_eur?: number | null;
  numero_fattura?: string | null;
  stato: 'da_pagare' | 'corretto' | 'pagato';
  updated_at?: string;
}

export interface CostComponents {
  KM: number;
  KS: number;
  CI: number;
  KB: number;
  CP: number;
  VVP: number;
  DAP: number;
}

/** Riga tabella formule pulizie: per un dato numero di ospiti, quanti kit usare */
export interface CleaningFormulaRow {
  guests: number;    // numero ospiti (1..maxGuests)
  KM_qty: number;    // quantità KM
  KS_qty: number;    // quantità KS
  CI_qty: number;    // quantità CI
  KB_qty: number;    // quantità KB
}

/** Formule pulizie per una singola casa */
export interface CleaningFormulaHouse {
  max_guests: number;             // numero massimo ospiti (definisce righe tabella)
  base_eur: number;               // costo base fisso casa (era CP/VVP/DAP)
  rows: CleaningFormulaRow[];     // una riga per ogni guests 1..max_guests
}

/** Mappa casa → formula pulizie */
export type CleaningFormulas = Record<string, CleaningFormulaHouse>;

export interface BudgetMonthRow {
  local: string;
  mese: string;
  month_key: string;
  numero_soggiorni: number;
  pernotti: number;
  lordo: number;
  commissioni: number;
  tassa_soggiorno: number;
  cedolare_secca: number;
  pulizie: number;
  costi_fissi: number;
  profitto_netto: number;
}

export const LOCAL_CODES: LocalCode[] = ['C3A', 'VV14', 'DA23'];

// ---------- Guest records (da buro.csv) ----------
/** Un record per singolo ospite, dal CSV burocrazia Vikey */
export interface GuestRecord {
  resv_key: string;
  local_name: LocalCode | string;
  date_from: string;
  date_to: string;
  channel?: string;
  cancelled?: boolean;
  name?: string;
  surname?: string;
  birthdate?: string;
  birthplace?: string;
  residence_city?: string;
  residence_province?: string;
  residence_country?: string;
  nationality?: string;
  document_type?: string;
  document_number?: string;
  num_paganti?: number;
  citytax_tot?: number;
}

// ---------- Tassa di soggiorno ----------
export type TaxCategory = 'paganti_ota' | 'airbnb' | 'minori' | 'residenti_milano';

export const MESI_IT = [
  'gennaio','febbraio','marzo','aprile','maggio','giugno',
  'luglio','agosto','settembre','ottobre','novembre','dicembre',
];
export const MESI_IT_SHORT = ['gen','feb','mar','apr','mag','giu','lug','ago','set','ott','nov','dic'];

/** Centroidi lat/lng dei paesi che compaiono nei dati */
export const COUNTRY_CENTROIDS: Record<string, { lat: number; lng: number }> = {
  'Austria': { lat: 47.5, lng: 14.5 },
  'Belgium': { lat: 50.5, lng: 4.5 },
  'Brazil': { lat: -10.0, lng: -55.0 },
  'Chile': { lat: -35.0, lng: -71.0 },
  'Denmark': { lat: 56.0, lng: 10.0 },
  'France': { lat: 46.0, lng: 2.0 },
  'Germany': { lat: 51.0, lng: 10.0 },
  'Greece': { lat: 39.0, lng: 22.0 },
  'Hong Kong': { lat: 22.3, lng: 114.2 },
  'Hungary': { lat: 47.2, lng: 19.5 },
  'Ireland': { lat: 53.0, lng: -8.0 },
  'Italy': { lat: 42.0, lng: 12.5 },
  'Israel': { lat: 31.0, lng: 35.0 },
  'Japan': { lat: 36.2, lng: 138.2 },
  'Luxembourg': { lat: 49.6, lng: 6.1 },
  'Malta': { lat: 35.9, lng: 14.5 },
  'Morocco': { lat: 31.8, lng: -7.1 },
  'Netherlands': { lat: 52.5, lng: 5.5 },
  'Norway': { lat: 62.0, lng: 10.0 },
  'Poland': { lat: 52.0, lng: 19.0 },
  'Portugal': { lat: 39.4, lng: -8.2 },
  'Romania': { lat: 45.9, lng: 24.9 },
  'Russia': { lat: 60.0, lng: 90.0 },
  'South Africa': { lat: -30.5, lng: 22.9 },
  'Spain': { lat: 40.0, lng: -4.0 },
  'Sweden': { lat: 62.0, lng: 15.0 },
  'Switzerland': { lat: 47.0, lng: 8.0 },
  'UAE': { lat: 24.0, lng: 54.0 },
  'United Kingdom': { lat: 54.0, lng: -2.0 },
  'USA/Canada': { lat: 48.0, lng: -100.0 },
  'Egypt': { lat: 27.0, lng: 30.0 },
  'China': { lat: 35.0, lng: 105.0 },
  'Australia': { lat: -25.0, lng: 133.0 },
  'Czech Republic': { lat: 49.8, lng: 15.5 },
};
