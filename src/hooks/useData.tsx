import * as React from 'react';
import { App as CapApp } from '@capacitor/app';
import type {
  Reservation, BudgetParams, CostComponents,
  CleaningPreferences, CleaningOverride, ReservationNote, FatturaPulizieMonth,
  GuestRecord, VisibilityPrefs, CleaningFormulas,
} from '@/lib/types';
import { parseVikeyCsv } from '@/lib/csvParser';
import { parseBuroCsv } from '@/lib/buroCsvParser';
import {
  loadBudget, saveBudget,
  loadCosts, saveCosts,
  loadCleaningFormulas, saveCleaningFormulas,
  loadCleaningPrefs, saveCleaningPrefs,
  loadCleaningOverrides, upsertCleaningOverride,
  loadResvNotes, upsertResvNote,
  loadFattura, upsertFattura,
  getActiveBudgetYear, setActiveBudgetYear,
  loadDataSource,
  loadVisibility, saveVisibility,
} from '@/lib/storage';
import {
  loadReservationsCsv, loadBuroCsv,
  importReservationsCsv, importBuroCsv,
  triggerAllExports, downloadCsvFromUrl, runFullSync,
  type ExportKind, type FullSyncProgress,
} from '@/lib/vikey';
import { filterReservationsByVisibility } from '@/lib/visibility';

interface DataCtx {
  reservations: Reservation[];        // già filtrate per visibility
  reservationsAll: Reservation[];     // raw, non filtrate (per Impostazioni)
  guestRecords: GuestRecord[];
  lastSync: string | null;
  lastSyncBuro: string | null;
  loading: boolean;
  syncStatus: 'idle' | 'syncing' | 'error' | 'ok';
  syncMessage: string | null;
  error: string | null;

  activeYear: number;
  setYear: (y: number) => Promise<void>;
  budget: BudgetParams;
  saveBudgetParams: (b: BudgetParams) => Promise<void>;

  costs: CostComponents;
  saveCostComponents: (c: CostComponents) => Promise<void>;

  cleaningFormulas: CleaningFormulas;
  saveCleaningFormulasData: (f: CleaningFormulas) => Promise<void>;

  // Visibility
  visibility: VisibilityPrefs;
  saveVisibilityPrefs: (v: VisibilityPrefs) => Promise<void>;

  // Cleaning
  cleaningPrefs: CleaningPreferences;
  saveCleaningPreferences: (p: CleaningPreferences) => Promise<void>;
  cleaningOverrides: CleaningOverride[];
  saveCleaningOverride: (o: CleaningOverride) => Promise<void>;

  // Notes
  resvNotes: ReservationNote[];
  saveResvNote: (resv_key: string, text: string) => Promise<void>;
  getNote: (resv_key: string) => string;

  // Fattura
  fattura: FatturaPulizieMonth[];
  saveFatturaRow: (row: FatturaPulizieMonth) => Promise<void>;

  // Actions
  refresh: () => Promise<void>;
  triggerSync: () => Promise<void>;
  fullSync: (onProgress?: FullSyncProgress) => Promise<{ ok: boolean; message: string }>;
  downloadFromLink: (url: string, kind: ExportKind) => Promise<void>;
  importCsv: (csv: string) => Promise<void>;
  importBuroCsvData: (csv: string) => Promise<void>;
}

const Ctx = React.createContext<DataCtx | null>(null);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [reservationsAll, setReservationsAll] = React.useState<Reservation[]>([]);
  const [reservations, setReservations] = React.useState<Reservation[]>([]);
  const [guestRecords, setGuestRecords] = React.useState<GuestRecord[]>([]);
  const [lastSync, setLastSync] = React.useState<string | null>(null);
  const [lastSyncBuro, setLastSyncBuro] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [syncStatus, setSyncStatus] = React.useState<'idle' | 'syncing' | 'error' | 'ok'>('idle');
  const [syncMessage, setSyncMessage] = React.useState<string | null>(null);

  const [activeYear, setActiveYear] = React.useState<number>(new Date().getFullYear());
  const [budget, setBudget] = React.useState<BudgetParams | null>(null);
  const [costs, setCosts] = React.useState<CostComponents | null>(null);
  const [cleaningFormulas, setCleaningFormulas] = React.useState<CleaningFormulas | null>(null);
  const [visibility, setVisibility] = React.useState<VisibilityPrefs | null>(null);
  const [cleaningPrefs, setCleaningPrefs] = React.useState<CleaningPreferences | null>(null);
  const [cleaningOverrides, setCleaningOverrides] = React.useState<CleaningOverride[]>([]);
  const [resvNotes, setResvNotes] = React.useState<ReservationNote[]>([]);
  const [fattura, setFattura] = React.useState<FatturaPulizieMonth[]>([]);

  const applyVis = React.useCallback((all: Reservation[], vis: VisibilityPrefs) => {
    setReservations(filterReservationsByVisibility(all, vis));
  }, []);

  const reparse = React.useCallback((csv: string, b: BudgetParams, vis: VisibilityPrefs) => {
    const rows = parseVikeyCsv(csv, { budget: b });
    setReservationsAll(rows);
    applyVis(rows, vis);
  }, [applyVis]);

  const reparseBuro = React.useCallback((csv: string) => {
    const rows = parseBuroCsv(csv);
    setGuestRecords(rows);
  }, []);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [y, c, cf, prefs, ovs, notes, ft, cfg, vis] = await Promise.all([
        getActiveBudgetYear(),
        loadCosts(),
        loadCleaningFormulas(),
        loadCleaningPrefs(),
        loadCleaningOverrides(),
        loadResvNotes(),
        loadFattura(),
        loadDataSource(),
        loadVisibility(),
      ]);
      const b = await loadBudget(y);
      setActiveYear(y);
      setBudget(b);
      setCosts(c);
      setCleaningFormulas(cf);
      setVisibility(vis);
      setCleaningPrefs(prefs);
      setCleaningOverrides(ovs);
      setResvNotes(notes);
      setFattura(ft);

      // Carica reservations da cache
      const resv = await loadReservationsCsv();
      if (resv) {
        setLastSync(resv.lastSync);
        reparse(resv.csv, b, vis);
      } else {
        setReservationsAll([]);
        setReservations([]);
        setLastSync(null);
      }

      // Carica buro da cache
      const buro = await loadBuroCsv();
      if (buro) {
        setLastSyncBuro(buro.lastSync);
        reparseBuro(buro.csv);
      } else {
        setGuestRecords([]);
        setLastSyncBuro(null);
      }
    } catch (e: any) {
      console.error(e);
      setError(e?.message ?? 'Errore di caricamento');
    } finally {
      setLoading(false);
    }
  }, [reparse, reparseBuro]);

  React.useEffect(() => {
    refresh();
    const subPromise = CapApp.addListener('appStateChange', ({ isActive }) => {
      if (isActive) refresh();
    });
    return () => { subPromise.then((l) => l.remove()).catch(() => {}); };
  }, [refresh]);

  const triggerSync = React.useCallback(async () => {
    setSyncStatus('syncing');
    setSyncMessage('Login Vikey…');
    try {
      const r = await triggerAllExports();
      setSyncStatus(r.ok ? 'ok' : 'error');
      setSyncMessage(r.message);
    } catch (e: any) {
      setSyncStatus('error');
      setSyncMessage(e?.message ?? 'Errore');
    }
  }, []);

  const fullSync = React.useCallback(async (onProgress?: FullSyncProgress) => {
    setSyncStatus('syncing');
    setSyncMessage('Avvio sync completo…');
    const wrappedProgress: FullSyncProgress = (phase, message) => {
      setSyncMessage(message);
      onProgress?.(phase, message);
    };
    try {
      const r = await runFullSync(wrappedProgress);
      setSyncStatus(r.ok ? 'ok' : 'error');
      setSyncMessage(r.message);
      if (r.ok) {
        // Ricarica i dati dalla cache appena aggiornata
        const [resv, buro] = await Promise.all([loadReservationsCsv(), loadBuroCsv()]);
        if (resv && budget && visibility) {
          setLastSync(resv.lastSync);
          reparse(resv.csv, budget, visibility);
        }
        if (buro) {
          setLastSyncBuro(buro.lastSync);
          reparseBuro(buro.csv);
        }
      }
      return r;
    } catch (e: any) {
      const msg = e?.message ?? 'Errore';
      setSyncStatus('error');
      setSyncMessage(msg);
      return { ok: false, message: msg };
    }
  }, [budget, visibility, reparse, reparseBuro]);

  const downloadFromLink = React.useCallback(async (url: string, kind: ExportKind) => {
    setSyncStatus('syncing');
    setSyncMessage(`Scarico ${kind}…`);
    try {
      const result = await downloadCsvFromUrl(url, kind);
      if (kind === 'reservations' && budget && visibility) {
        setLastSync(result.lastSync);
        reparse(result.csv, budget, visibility);
      } else if (kind === 'buro') {
        setLastSyncBuro(result.lastSync);
        reparseBuro(result.csv);
      }
      setSyncStatus('ok');
      setSyncMessage(`${kind}.csv scaricato`);
    } catch (e: any) {
      setSyncStatus('error');
      setSyncMessage(e?.message ?? 'Errore download');
      throw e;
    }
  }, [budget, visibility, reparse, reparseBuro]);

  const importCsv = React.useCallback(async (csv: string) => {
    const ts = await importReservationsCsv(csv);
    setLastSync(ts);
    if (budget && visibility) reparse(csv, budget, visibility);
  }, [budget, visibility, reparse]);

  const importBuroCsvData = React.useCallback(async (csv: string) => {
    const ts = await importBuroCsv(csv);
    setLastSyncBuro(ts);
    reparseBuro(csv);
  }, [reparseBuro]);

  const saveBudgetParams = React.useCallback(async (b: BudgetParams) => {
    await saveBudget(b);
    setBudget(b);
    const res = await loadReservationsCsv();
    if (res && visibility) reparse(res.csv, b, visibility);
  }, [visibility, reparse]);

  const setYear = React.useCallback(async (y: number) => {
    await setActiveBudgetYear(y);
    setActiveYear(y);
    const b = await loadBudget(y);
    setBudget(b);
    const res = await loadReservationsCsv();
    if (res && visibility) reparse(res.csv, b, visibility);
  }, [visibility, reparse]);

  const saveCostComponents = React.useCallback(async (c: CostComponents) => {
    await saveCosts(c); setCosts(c);
  }, []);

  const saveCleaningFormulasData = React.useCallback(async (f: CleaningFormulas) => {
    await saveCleaningFormulas(f); setCleaningFormulas(f);
  }, []);

  const saveVisibilityPrefs = React.useCallback(async (v: VisibilityPrefs) => {
    await saveVisibility(v);
    setVisibility(v);
    applyVis(reservationsAll, v);
  }, [reservationsAll, applyVis]);

  const saveCleaningPreferences = React.useCallback(async (p: CleaningPreferences) => {
    await saveCleaningPrefs(p); setCleaningPrefs(p);
  }, []);

  const saveCleaningOverride = React.useCallback(async (o: CleaningOverride) => {
    const next = await upsertCleaningOverride(o); setCleaningOverrides(next);
  }, []);

  const saveResvNote = React.useCallback(async (resv_key: string, text: string) => {
    const next = await upsertResvNote(resv_key, text); setResvNotes(next);
  }, []);

  const getNote = React.useCallback((resv_key: string) => {
    return resvNotes.find((n) => n.resv_key === resv_key)?.text ?? '';
  }, [resvNotes]);

  const saveFatturaRow = React.useCallback(async (row: FatturaPulizieMonth) => {
    const next = await upsertFattura(row); setFattura(next);
  }, []);

  if (!budget || !costs || !cleaningFormulas || !cleaningPrefs || !visibility) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="text-center">
          <div className="display text-2xl text-muted-foreground">Casa Overview</div>
          <div className="text-sm text-muted-foreground mt-2">Caricamento…</div>
        </div>
      </div>
    );
  }

  const value: DataCtx = {
    reservations, reservationsAll, guestRecords,
    lastSync, lastSyncBuro, loading, error, syncStatus, syncMessage,
    activeYear, setYear, budget, saveBudgetParams,
    costs, saveCostComponents,
    cleaningFormulas, saveCleaningFormulasData,
    visibility, saveVisibilityPrefs,
    cleaningPrefs, saveCleaningPreferences,
    cleaningOverrides, saveCleaningOverride,
    resvNotes, saveResvNote, getNote,
    fattura, saveFatturaRow,
    refresh, triggerSync, fullSync, downloadFromLink, importCsv, importBuroCsvData,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useData() {
  const v = React.useContext(Ctx);
  if (!v) throw new Error('useData must be inside DataProvider');
  return v;
}
