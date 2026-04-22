import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, Input, Label, Badge, Separator } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { useData } from '@/hooks/useData';
import { loadCredentials, saveCredentials } from '@/lib/storage';
import { loginGmail, clearGmailTokens, isGmailConnected } from '@/lib/gmailAuth';
import type { Credentials, BudgetParams, VisibilityPrefs } from '@/lib/types';
import { getAllLocals, getAllYears } from '@/lib/visibility';
import { Eye, EyeOff, Save, ShieldCheck, Download, Link2, CheckCircle2, AlertCircle, RefreshCw, Mail, LogOut, Zap } from 'lucide-react';
import { CsvImportButton } from './CsvImport';

export function SettingsPage() {
  return (
    <div className="space-y-8">
      <div>
        <div className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground">Impostazioni</div>
        <h1 className="display text-3xl lg:text-4xl mt-2">Configurazione</h1>
      </div>

      <VikeySyncSection />
      <GmailConnectionSection />
      <CredentialsSection />
      <VisibilitySection />
      <BudgetParamsSection />
    </div>
  );
}

// ==================== GMAIL CONNECTION ====================
function GmailConnectionSection() {
  const [connected, setConnected] = React.useState<boolean | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    setConnected(await isGmailConnected());
  }, []);

  React.useEffect(() => { refresh(); }, [refresh]);

  const connect = async () => {
    setBusy(true); setErr(null);
    try {
      await loginGmail();
      await refresh();
    } catch (e: any) {
      setErr(e?.message ?? 'Errore login');
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    setBusy(true);
    try {
      await clearGmailTokens();
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Mail className="w-4 h-4 text-accent" />
          <CardTitle>Connessione Gmail</CardTitle>
        </div>
        <CardDescription>
          Necessaria per il sync automatico: l'app legge le mail di Vikey ed estrae i link ai CSV.
          Concedi solo il permesso di <b>lettura</b> della posta.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {connected === null ? (
          <div className="text-sm text-muted-foreground">Verifico…</div>
        ) : connected ? (
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <div className="text-sm font-medium">Gmail collegato</div>
            </div>
            <Button variant="outline" size="sm" onClick={disconnect} disabled={busy}>
              <LogOut className="w-3.5 h-3.5" /> Disconnetti
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="text-sm text-muted-foreground">Non collegato</div>
            <Button variant="ember" size="sm" onClick={connect} disabled={busy}>
              <Mail className="w-3.5 h-3.5" />
              {busy ? 'In corso…' : 'Collega Gmail'}
            </Button>
          </div>
        )}
        {err && (
          <div className="text-xs px-3 py-2 rounded-md bg-rose-50 text-rose-800 dark:bg-rose-950/30 dark:text-rose-200">
            <AlertCircle className="inline w-3.5 h-3.5 mr-1" /> {err}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ==================== VIKEY SYNC ====================
function VikeySyncSection() {
  const { fullSync, triggerSync, downloadFromLink, syncStatus, syncMessage, lastSync, lastSyncBuro } = useData();
  const [linkResv, setLinkResv] = React.useState('');
  const [linkBuro, setLinkBuro] = React.useState('');
  const [downloadingResv, setDownloadingResv] = React.useState(false);
  const [downloadingBuro, setDownloadingBuro] = React.useState(false);
  const [errorResv, setErrorResv] = React.useState<string | null>(null);
  const [errorBuro, setErrorBuro] = React.useState<string | null>(null);
  const [gmailReady, setGmailReady] = React.useState(false);

  React.useEffect(() => { isGmailConnected().then(setGmailReady); }, [syncStatus]);

  const handleFullSync = async () => {
    await fullSync();
  };

  const handleDownload = async (url: string, kind: 'reservations' | 'buro') => {
    if (!url.trim()) return;
    if (kind === 'reservations') { setDownloadingResv(true); setErrorResv(null); }
    else { setDownloadingBuro(true); setErrorBuro(null); }
    try {
      await downloadFromLink(url.trim(), kind);
      if (kind === 'reservations') setLinkResv('');
      else setLinkBuro('');
    } catch (e: any) {
      const msg = e?.message ?? 'Errore download';
      if (kind === 'reservations') setErrorResv(msg);
      else setErrorBuro(msg);
    } finally {
      if (kind === 'reservations') setDownloadingResv(false);
      else setDownloadingBuro(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Download className="w-4 h-4 text-accent" />
          <CardTitle>Sync dati Vikey</CardTitle>
        </div>
        <CardDescription>
          {gmailReady
            ? 'Gmail è collegato: puoi sincronizzare con un singolo click.'
            : 'Collega Gmail qui sopra per il sync automatico, oppure procedi manualmente con i link.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* One-click sync */}
        {gmailReady && (
          <div className="rounded-md border border-accent/30 bg-accent/5 p-4 space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <div className="text-sm font-medium flex items-center gap-2">
                  <Zap className="w-4 h-4 text-accent" />
                  Sync completo automatico
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Richiede export a Vikey, legge le mail e scarica i CSV in un'unica operazione
                </div>
              </div>
              <Button variant="ember" onClick={handleFullSync} disabled={syncStatus === 'syncing'}>
                <Zap className={`w-4 h-4 ${syncStatus === 'syncing' ? 'animate-pulse' : ''}`} />
                {syncStatus === 'syncing' ? 'In corso…' : 'Sincronizza ora'}
              </Button>
            </div>
            {syncMessage && (
              <div className={`text-xs px-3 py-2 rounded-md ${
                syncStatus === 'ok' ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200'
                  : syncStatus === 'error' ? 'bg-rose-50 text-rose-800 dark:bg-rose-950/30 dark:text-rose-200'
                    : 'bg-muted text-muted-foreground'
              }`}>
                {syncStatus === 'ok' && <CheckCircle2 className="inline w-3.5 h-3.5 mr-1" />}
                {syncStatus === 'error' && <AlertCircle className="inline w-3.5 h-3.5 mr-1" />}
                {syncMessage}
              </div>
            )}
          </div>
        )}

        <Separator />

        {/* Manual sync (sempre disponibile come fallback) */}
        <div className="rounded-md border border-border/60 p-4 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <div className="text-sm font-medium">Sync manuale</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Se il sync automatico non funziona o Gmail non è collegato
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={triggerSync} disabled={syncStatus === 'syncing'}>
              <RefreshCw className={`w-3.5 h-3.5 ${syncStatus === 'syncing' ? 'animate-spin' : ''}`} />
              Richiedi solo export
            </Button>
          </div>

          {/* Reservations */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Link prenotazioni (reservations.csv)</Label>
              {lastSync && (
                <span className="text-[10px] text-muted-foreground num">
                  Ultimo: {new Date(lastSync).toLocaleString('it-IT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="https://storage.googleapis.com/..."
                value={linkResv}
                onChange={(e) => setLinkResv(e.target.value)}
                className="font-mono text-xs flex-1"
              />
              <Button size="sm" onClick={() => handleDownload(linkResv, 'reservations')} disabled={!linkResv.trim() || downloadingResv}>
                <Link2 className="w-3.5 h-3.5" />
                {downloadingResv ? 'Scarico…' : 'Scarica'}
              </Button>
            </div>
            {errorResv && <div className="text-[10px] text-rose-700">{errorResv}</div>}
          </div>

          {/* Buro */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Link ospiti/burocrazia (buro.csv)</Label>
              {lastSyncBuro && (
                <span className="text-[10px] text-muted-foreground num">
                  Ultimo: {new Date(lastSyncBuro).toLocaleString('it-IT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="https://storage.googleapis.com/..."
                value={linkBuro}
                onChange={(e) => setLinkBuro(e.target.value)}
                className="font-mono text-xs flex-1"
              />
              <Button size="sm" onClick={() => handleDownload(linkBuro, 'buro')} disabled={!linkBuro.trim() || downloadingBuro}>
                <Link2 className="w-3.5 h-3.5" />
                {downloadingBuro ? 'Scarico…' : 'Scarica'}
              </Button>
            </div>
            {errorBuro && <div className="text-[10px] text-rose-700">{errorBuro}</div>}
          </div>
        </div>

        {/* Alternative: import manuale */}
        <div className="rounded-md bg-muted/40 p-4 space-y-2">
          <div className="text-sm font-medium">Alternativa: importa un file CSV</div>
          <div className="text-xs text-muted-foreground">
            Se preferisci, puoi caricare direttamente un file CSV dal dispositivo.
          </div>
          <CsvImportButton variant="outline" />
        </div>
      </CardContent>
    </Card>
  );
}

// ==================== CREDENZIALI ====================
function CredentialsSection() {
  const [c, setC] = React.useState<Credentials | null>(null);
  const [showPwd, setShowPwd] = React.useState(false);
  const [saved, setSaved] = React.useState(false);

  React.useEffect(() => { loadCredentials().then(setC); }, []);

  const save = async () => {
    if (!c) return;
    await saveCredentials(c);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (!c) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-accent" />
          <CardTitle>Credenziali Vikey</CardTitle>
        </div>
        <CardDescription>
          Salvate localmente (iOS Keychain/macOS secure storage). Usate per il login automatico.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Email Vikey</Label>
            <Input
              type="email"
              className="mt-1.5"
              value={c.vikey_email}
              onChange={(e) => setC({ ...c, vikey_email: e.target.value })}
            />
          </div>
          <div>
            <Label>Password Vikey</Label>
            <div className="relative mt-1.5">
              <Input
                type={showPwd ? 'text' : 'password'}
                className="pr-8"
                value={c.vikey_password}
                onChange={(e) => setC({ ...c, vikey_password: e.target.value })}
              />
              <button
                type="button"
                onClick={() => setShowPwd(!showPwd)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPwd ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3">
          {saved && <Badge variant="success">Salvato</Badge>}
          <Button variant="ember" onClick={save}>
            <Save className="w-4 h-4" /> Salva credenziali
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ==================== VISIBILITY ====================
function VisibilitySection() {
  const { reservationsAll, visibility, saveVisibilityPrefs } = useData();
  const allLocals = React.useMemo(() => getAllLocals(reservationsAll), [reservationsAll]);
  const allYears = React.useMemo(() => getAllYears(reservationsAll), [reservationsAll]);

  const [draft, setDraft] = React.useState<VisibilityPrefs>(visibility);
  const [saved, setSaved] = React.useState(false);

  React.useEffect(() => setDraft(visibility), [visibility]);

  // Default: se visible_locals vuoto e hidden_locals vuoto → mostro tutte
  const isLocalVisible = (l: string) => {
    if (draft.visible_locals.length > 0) return draft.visible_locals.includes(l);
    return !draft.hidden_locals.includes(l);
  };
  const isYearVisible = (y: number) => {
    if (draft.visible_years.length > 0) return draft.visible_years.includes(y);
    return !draft.hidden_years.includes(y);
  };

  const toggleLocal = (l: string) => {
    const currentlyVisible = isLocalVisible(l);
    if (currentlyVisible) {
      // Nascondi: aggiungi a hidden_locals, rimuovi da visible_locals
      setDraft({
        ...draft,
        visible_locals: draft.visible_locals.filter((x) => x !== l),
        hidden_locals: draft.hidden_locals.includes(l) ? draft.hidden_locals : [...draft.hidden_locals, l],
      });
    } else {
      // Mostra: rimuovi da hidden, aggiungi a visible (se c'era una selezione esplicita)
      setDraft({
        ...draft,
        hidden_locals: draft.hidden_locals.filter((x) => x !== l),
        visible_locals: draft.visible_locals.length > 0
          ? (draft.visible_locals.includes(l) ? draft.visible_locals : [...draft.visible_locals, l])
          : draft.visible_locals,
      });
    }
  };

  const toggleYear = (y: number) => {
    const currentlyVisible = isYearVisible(y);
    if (currentlyVisible) {
      setDraft({
        ...draft,
        visible_years: draft.visible_years.filter((x) => x !== y),
        hidden_years: draft.hidden_years.includes(y) ? draft.hidden_years : [...draft.hidden_years, y],
      });
    } else {
      setDraft({
        ...draft,
        hidden_years: draft.hidden_years.filter((x) => x !== y),
        visible_years: draft.visible_years.length > 0
          ? (draft.visible_years.includes(y) ? draft.visible_years : [...draft.visible_years, y])
          : draft.visible_years,
      });
    }
  };

  const resetToAll = () => {
    setDraft({ visible_locals: [], hidden_locals: [], visible_years: [], hidden_years: [] });
  };

  const save = async () => {
    await saveVisibilityPrefs(draft);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const dirty = JSON.stringify(draft) !== JSON.stringify(visibility);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Case e anni visibili</CardTitle>
        <CardDescription>
          Scegli quali case e quali anni visualizzare nell'app. Le case/anni nascosti sono esclusi da tutti i calcoli e filtri.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {allLocals.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nessuna casa trovata nei dati. Sincronizza prima i CSV Vikey.</p>
        ) : (
          <>
            <div>
              <h4 className="text-sm font-semibold mb-2">Case ({allLocals.length})</h4>
              <div className="flex flex-wrap gap-2">
                {allLocals.map((l) => {
                  const visible = isLocalVisible(l);
                  return (
                    <button
                      key={l}
                      onClick={() => toggleLocal(l)}
                      className={`px-3 py-1.5 rounded-full text-sm font-mono transition-all ${
                        visible
                          ? 'bg-accent/15 text-accent border border-accent/30'
                          : 'bg-muted text-muted-foreground/60 border border-transparent line-through'
                      }`}
                    >
                      {l}
                    </button>
                  );
                })}
              </div>
            </div>

            <Separator />

            <div>
              <h4 className="text-sm font-semibold mb-2">Anni ({allYears.length})</h4>
              {allYears.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nessun anno disponibile.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {allYears.map((y) => {
                    const visible = isYearVisible(y);
                    return (
                      <button
                        key={y}
                        onClick={() => toggleYear(y)}
                        className={`px-3 py-1.5 rounded-full text-sm num transition-all ${
                          visible
                            ? 'bg-accent/15 text-accent border border-accent/30'
                            : 'bg-muted text-muted-foreground/60 border border-transparent line-through'
                        }`}
                      >
                        {y}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-2">
              <Button variant="ghost" size="sm" onClick={resetToAll}>
                <RefreshCw className="w-3.5 h-3.5" /> Mostra tutto
              </Button>
              <div className="flex items-center gap-3">
                {saved && <Badge variant="success">Salvato</Badge>}
                <Button variant="ember" onClick={save} disabled={!dirty}>
                  <Save className="w-4 h-4" /> Salva visibilità
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ==================== BUDGET PARAMS ====================
function BudgetParamsSection() {
  const { budget, saveBudgetParams, activeYear, reservationsAll } = useData();
  const allLocals = React.useMemo(() => getAllLocals(reservationsAll), [reservationsAll]);
  const [draft, setDraft] = React.useState<BudgetParams>(budget);
  const [saved, setSaved] = React.useState(false);

  React.useEffect(() => setDraft(budget), [budget]);

  // Prendi solo le case che esistono nel draft budget (quelle standard C3A/VV14/DA23)
  // oppure mostra tutte quelle nei dati con fallback a valori default
  const locals = allLocals.length > 0 ? allLocals : Object.keys(draft.cedolare);

  const getCedolare = (l: string) => (draft.cedolare as any)[l] ?? 0.21;
  const getLaundry = (l: string) => (draft.laundry_per_stay as any)[l] ?? 0;
  const getCleaning = (l: string) => (draft.cleaning_per_stay as any)[l] ?? 0;
  const getFixed = (l: string) => (draft.fixed_monthly as any)[l] ?? { electricity: 0, gas: 0, internet: 0, condo: 0 };
  const getCf = (l: string) => (draft.codice_fiscale as any)[l] ?? '';

  const save = async () => {
    await saveBudgetParams(draft);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const dirty = JSON.stringify(draft) !== JSON.stringify(budget);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Parametri budget — anno {activeYear}</CardTitle>
        <CardDescription>Commissioni piattaforme, cedolare secca, tassa di soggiorno, pulizie, costi fissi.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <NumField label="Commissioni piattaforme (%)" value={draft.commissioni * 100} step={0.1} suffix="%" onChange={(v) => setDraft({ ...draft, commissioni: v / 100 })} />
          <NumField label="Tassa di soggiorno (€/persona/notte)" value={draft.tassa_soggiorno_pp} step={0.1} suffix="€" onChange={(v) => setDraft({ ...draft, tassa_soggiorno_pp: v })} />
        </div>

        <Separator />
        <div>
          <h4 className="text-sm font-semibold mb-3">Cedolare secca per casa</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {locals.map((l) => (
              <NumField
                key={l}
                label={`${l} (%)`}
                value={getCedolare(l) * 100}
                step={0.1}
                suffix="%"
                onChange={(v) => setDraft({ ...draft, cedolare: { ...draft.cedolare, [l]: v / 100 } })}
              />
            ))}
          </div>
        </div>

        <Separator />
        <div>
          <h4 className="text-sm font-semibold mb-3">Pulizie per stay</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {locals.map((l) => (
              <div key={l} className="space-y-2 rounded-md border border-border/60 p-3">
                <div className="text-xs font-medium font-mono">{l}</div>
                <NumField label="Lavanderia (€)" value={getLaundry(l)} step={1} suffix="€" onChange={(v) => setDraft({ ...draft, laundry_per_stay: { ...draft.laundry_per_stay, [l]: v } })} />
                <NumField label="Pulizia (€)" value={getCleaning(l)} step={1} suffix="€" onChange={(v) => setDraft({ ...draft, cleaning_per_stay: { ...draft.cleaning_per_stay, [l]: v } })} />
              </div>
            ))}
          </div>
        </div>

        <Separator />
        <div>
          <h4 className="text-sm font-semibold mb-3">Costi fissi mensili</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {locals.map((l) => {
              const f = getFixed(l);
              const upd = (k: string, v: number) => setDraft({ ...draft, fixed_monthly: { ...draft.fixed_monthly, [l]: { ...f, [k]: v } } });
              return (
                <div key={l} className="rounded-md border border-border/60 p-3 space-y-2">
                  <div className="text-xs font-medium font-mono">{l}</div>
                  <NumField label="Elettricità" value={f.electricity} step={1} suffix="€" onChange={(v) => upd('electricity', v)} />
                  <NumField label="Gas" value={f.gas} step={1} suffix="€" onChange={(v) => upd('gas', v)} />
                  <NumField label="Internet" value={f.internet} step={1} suffix="€" onChange={(v) => upd('internet', v)} />
                  <NumField label="Spese cond." value={f.condo} step={1} suffix="€" onChange={(v) => upd('condo', v)} />
                </div>
              );
            })}
          </div>
        </div>

        <Separator />
        <div>
          <h4 className="text-sm font-semibold mb-3">Codici fiscali proprietari</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {locals.map((l) => (
              <div key={l}>
                <Label>{l}</Label>
                <Input
                  className="mt-1.5 font-mono text-xs"
                  value={getCf(l)}
                  onChange={(e) => setDraft({ ...draft, codice_fiscale: { ...draft.codice_fiscale, [l]: e.target.value.toUpperCase() } })}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          {saved && <Badge variant="success">Parametri salvati</Badge>}
          <Button variant="ember" onClick={save} disabled={!dirty} className="ml-auto">
            <Save className="w-4 h-4" /> Salva parametri
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function NumField({ label, value, onChange, step = 1, suffix }: { label: string; value: number; onChange: (v: number) => void; step?: number; suffix?: string }) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="relative mt-1.5">
        <Input type="number" step={step} className="num pr-8" value={value} onChange={(e) => onChange(Number(e.target.value) || 0)} />
        {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">{suffix}</span>}
      </div>
    </div>
  );
}
