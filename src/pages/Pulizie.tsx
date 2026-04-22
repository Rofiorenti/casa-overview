import * as React from 'react';
import { useData } from '@/hooks/useData';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, Input, Select, Label, Badge, Empty, Separator } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { formatDate, cn } from '@/lib/utils';
import { type CleaningSession } from '@/lib/types';
import { getVisibleLocals } from '@/lib/visibility';
import { generateCleaningSessions } from '@/lib/calculations';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Download, CheckCircle2, Circle, Settings2, X, Save, RotateCcw } from 'lucide-react';
import { saveTextFile, saveBlobFile } from '@/lib/fileSave';

export function PulizePage() {
  const { reservations, cleaningPrefs, cleaningOverrides, costs, cleaningFormulas } = useData();
  const [editing, setEditing] = React.useState<CleaningSession | null>(null);
  const [showPrefs, setShowPrefs] = React.useState(false);
  const [showExport, setShowExport] = React.useState(false);

  const sessions = React.useMemo(
    () => generateCleaningSessions(reservations, cleaningPrefs, cleaningOverrides, costs, cleaningFormulas),
    [reservations, cleaningPrefs, cleaningOverrides, costs, cleaningFormulas]
  );

  const now = new Date().toISOString().slice(0, 10);
  const upcoming = sessions.filter((s) => !s.skipped && s.date >= now).slice(0, 50);
  const past = sessions.filter((s) => !s.skipped && s.date < now).reverse().slice(0, 50);
  const skipped = sessions.filter((s) => s.skipped);

  if (reservations.length === 0) {
    return <Empty title="Calendario pulizie vuoto" description="Nessuna prenotazione per generare il calendario automatico." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground">Pulizie</div>
          <h1 className="display text-3xl lg:text-4xl mt-2">Calendario automatico</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Sessioni generate dalle prenotazioni. Le modifiche sono persistenti e legate al codice prenotazione.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => setShowPrefs(true)}>
            <Settings2 className="w-4 h-4" />
            Preferenze
          </Button>
          <Button variant="ember" size="sm" onClick={() => setShowExport(true)}>
            <Download className="w-4 h-4" />
            Esporta
          </Button>
        </div>
      </div>

      <Tabs defaultValue="upcoming">
        <TabsList>
          <TabsTrigger value="upcoming">Prossime ({upcoming.length})</TabsTrigger>
          <TabsTrigger value="past">Passate ({past.length})</TabsTrigger>
          {skipped.length > 0 && <TabsTrigger value="skipped">Saltate ({skipped.length})</TabsTrigger>}
        </TabsList>
        <TabsContent value="upcoming">
          <SessionsList sessions={upcoming} onEdit={setEditing} />
        </TabsContent>
        <TabsContent value="past">
          <SessionsList sessions={past} onEdit={setEditing} />
        </TabsContent>
        {skipped.length > 0 && (
          <TabsContent value="skipped">
            <SessionsList sessions={skipped} onEdit={setEditing} />
          </TabsContent>
        )}
      </Tabs>

      {editing && <SessionEditor session={editing} onClose={() => setEditing(null)} />}
      {showPrefs && <PreferencesModal onClose={() => setShowPrefs(false)} />}
      {showExport && <ExportModal sessions={sessions} onClose={() => setShowExport(false)} />}
    </div>
  );
}

// -------------- SESSION LIST --------------
function SessionsList({ sessions, onEdit }: { sessions: CleaningSession[]; onEdit: (s: CleaningSession) => void }) {
  if (sessions.length === 0) {
    return <Empty title="Nessuna sessione" description="Non ci sono sessioni in questa vista." />;
  }
  return (
    <Card>
      <CardContent className="p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
              <th className="px-4 py-3 font-medium w-10"></th>
              <th className="px-3 py-3 font-medium">Casa</th>
              <th className="px-3 py-3 font-medium">Data</th>
              <th className="px-3 py-3 font-medium">Orario</th>
              <th className="px-3 py-3 font-medium">Ospite precedente</th>
              <th className="px-3 py-3 text-right font-medium">Persone</th>
              <th className="px-3 py-3 font-medium">Note</th>
              <th className="px-3 py-3 w-10" />
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => (
              <tr key={s.resv_key} className={cn('row-hover border-t border-border/50', s.skipped && 'opacity-50')}>
                <td className="px-4 py-2.5">
                  {s.completed ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <Circle className="w-4 h-4 text-muted-foreground/40" />
                  )}
                </td>
                <td className="px-3 py-2.5"><Badge variant="outline">{s.local}</Badge></td>
                <td className="px-3 py-2.5 num font-medium">
                  {formatDate(s.date, { weekday: 'short', day: '2-digit', month: 'short' })}
                  {s.hasOverride && <span className="ml-1.5 text-[9px] text-accent uppercase tracking-wider">mod.</span>}
                </td>
                <td className="px-3 py-2.5 num text-muted-foreground">{s.from} – {s.to}</td>
                <td className="px-3 py-2.5 text-foreground/80 truncate max-w-[160px]">{s.guest_name}</td>
                <td className="px-3 py-2.5 text-right num">{s.guests_num}</td>
                <td className="px-3 py-2.5 text-muted-foreground text-xs truncate max-w-[200px]">{s.note || '—'}</td>
                <td className="px-3 py-2.5">
                  <button onClick={() => onEdit(s)} className="text-xs text-accent hover:underline">
                    modifica
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

// -------------- SESSION EDITOR --------------
function SessionEditor({ session, onClose }: { session: CleaningSession; onClose: () => void }) {
  const { saveCleaningOverride, cleaningPrefs, costs, cleaningFormulas } = useData();
  const defaultDate = (() => {
    const d = new Date(session.checkout_date);
    d.setDate(d.getDate() + (cleaningPrefs.offsets[session.local] ?? 0));
    return d.toISOString().slice(0, 10);
  })();
  const defaultTimes = cleaningPrefs.times[session.local] ?? { from: '10:00', to: '15:00' };

  const [date, setDate] = React.useState(session.date);
  const [from, setFrom] = React.useState(session.from);
  const [to, setTo] = React.useState(session.to);
  const [note, setNote] = React.useState(session.note ?? '');
  const [completed, setCompleted] = React.useState(!!session.completed);
  const [skipped, setSkipped] = React.useState(!!session.skipped);

  // Override pax / costo totale
  const defaultPax = session.next_guests ?? session.guests_num;
  const [useCustomGuests, setUseCustomGuests] = React.useState(session.custom_guests !== undefined);
  const [customGuests, setCustomGuests] = React.useState(session.custom_guests ?? defaultPax);
  const [useCustomCost, setUseCustomCost] = React.useState(session.custom_cost_eur !== undefined);
  const [customCost, setCustomCost] = React.useState(session.custom_cost_eur ?? session.formula_cost);
  const [costReason, setCostReason] = React.useState(session.cost_reason ?? '');

  // Override dei singoli kit
  const formulaForHouse = cleaningFormulas?.[session.local];
  const currentPaxForKits = useCustomGuests ? customGuests : defaultPax;
  // Quantità default dalla formula della casa per il numero di ospiti corrente
  const defaultKitParams = React.useMemo(() => {
    if (!formulaForHouse) return { KM_qty: 0, KS_qty: 0, CI_qty: 0, KB_qty: 0, base_eur: 0 };
    const clampedN = Math.min(Math.max(1, currentPaxForKits), formulaForHouse.max_guests);
    const row = formulaForHouse.rows.find(r => r.guests === clampedN);
    return {
      KM_qty: row?.KM_qty ?? 0,
      KS_qty: row?.KS_qty ?? 0,
      CI_qty: row?.CI_qty ?? 0,
      KB_qty: row?.KB_qty ?? 0,
      base_eur: formulaForHouse.base_eur,
    };
  }, [formulaForHouse, currentPaxForKits]);

  // Flag: almeno un parametro kit è salvato come override?
  // Fallback sicuro: parte disattivato, l'utente lo attiva se serve
  const [useCustomKits, setUseCustomKits] = React.useState(false);

  // Stato locali per i singoli parametri (inizializzati dai default)
  const [kmQty, setKmQty] = React.useState(defaultKitParams.KM_qty);
  const [ksQty, setKsQty] = React.useState(defaultKitParams.KS_qty);
  const [ciQty, setCiQty] = React.useState(defaultKitParams.CI_qty);
  const [kbQty, setKbQty] = React.useState(defaultKitParams.KB_qty);
  const [baseEur, setBaseEur] = React.useState(defaultKitParams.base_eur);

  // Quando l'utente cambia i pax e NON ha attivato override kit, i default si aggiornano
  React.useEffect(() => {
    if (!useCustomKits) {
      setKmQty(defaultKitParams.KM_qty);
      setKsQty(defaultKitParams.KS_qty);
      setCiQty(defaultKitParams.CI_qty);
      setKbQty(defaultKitParams.KB_qty);
      setBaseEur(defaultKitParams.base_eur);
    }
  }, [defaultKitParams, useCustomKits]);

  const [saving, setSaving] = React.useState(false);

  // Preview totale calcolato con i kit correnti
  const previewKitCost = React.useMemo(() => {
    if (!costs) return 0;
    return baseEur + kmQty * costs.KM + ksQty * costs.KS + ciQty * costs.CI + kbQty * costs.KB;
  }, [baseEur, kmQty, ksQty, ciQty, kbQty, costs]);

  const save = async () => {
    setSaving(true);
    try {
      await saveCleaningOverride({
        resv_key: session.resv_key,
        custom_date: date !== defaultDate ? date : undefined,
        custom_from: from !== defaultTimes.from ? from : undefined,
        custom_to: to !== defaultTimes.to ? to : undefined,
        note: note.trim() || undefined,
        completed: completed || undefined,
        skipped: skipped || undefined,
        custom_guests: useCustomGuests && customGuests !== defaultPax ? customGuests : undefined,
        custom_cost_eur: useCustomCost ? customCost : undefined,
        cost_reason: (useCustomGuests || useCustomCost || useCustomKits) && costReason.trim() ? costReason.trim() : undefined,
        // Override kit singoli — solo se diversi dai default e l'utente ha attivato la sezione
        custom_KM_qty: useCustomKits && kmQty !== defaultKitParams.KM_qty ? kmQty : undefined,
        custom_KS_qty: useCustomKits && ksQty !== defaultKitParams.KS_qty ? ksQty : undefined,
        custom_CI_qty: useCustomKits && ciQty !== defaultKitParams.CI_qty ? ciQty : undefined,
        custom_KB_qty: useCustomKits && kbQty !== defaultKitParams.KB_qty ? kbQty : undefined,
        custom_base_eur: useCustomKits && baseEur !== defaultKitParams.base_eur ? baseEur : undefined,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    setSaving(true);
    try {
      await saveCleaningOverride({ resv_key: session.resv_key });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 bg-ink/40 backdrop-blur-sm animate-in fade-in" onClick={onClose}>
      <div
        className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-background border-l border-border shadow-2xl p-6 overflow-y-auto animate-in slide-in-from-right"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <Badge variant="outline" className="font-mono">{session.local}</Badge>
            <h3 className="display text-xl mt-2">Modifica sessione</h3>
            <div className="text-xs text-muted-foreground mt-1">
              Ospite: <span className="font-medium">{session.guest_name}</span> · {session.guests_num}p
            </div>
            <div className="text-[10px] text-muted-foreground font-mono mt-1">
              Prenotazione: {session.resv_key}
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5 num">
              Check-out: {formatDate(session.checkout_date)}
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <Label>Data pulizia</Label>
            <Input type="date" className="mt-1.5" value={date} onChange={(e) => setDate(e.target.value)} />
            {date !== defaultDate && (
              <div className="text-[10px] text-accent mt-1">Modificata dal default ({formatDate(defaultDate)})</div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Dalle</Label>
              <Input type="time" className="mt-1.5" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <Label>Alle</Label>
              <Input type="time" className="mt-1.5" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>

          <div>
            <Label>Note (persistenti)</Label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={4}
              placeholder="Istruzioni particolari, consegna chiavi…"
              className="w-full mt-1.5 rounded-md border border-input bg-background/60 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 resize-y"
            />
          </div>

          <Separator />
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={completed} onChange={(e) => setCompleted(e.target.checked)} />
              Completata
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={skipped} onChange={(e) => setSkipped(e.target.checked)} />
              Salta questa sessione (esclusa dalla fattura)
            </label>
          </div>

          <Separator />
          <div className="space-y-3">
            <div>
              <div className="text-xs font-medium text-foreground">Fatturazione pulizia</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                Default: pax {defaultPax} {session.next_guests != null ? `(prossima prenot.)` : `(ultima nella casa)`} →
                {' '}€ {session.formula_cost.toFixed(2)} da formula
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={useCustomGuests}
                onChange={(e) => setUseCustomGuests(e.target.checked)}
              />
              Override numero ospiti
            </label>
            {useCustomGuests && (
              <div className="flex items-center gap-2 pl-5">
                <Input
                  type="number"
                  min={1}
                  max={20}
                  className="num w-20 h-9"
                  value={customGuests}
                  onChange={(e) => setCustomGuests(Math.max(1, Number(e.target.value) || 1))}
                />
                <span className="text-[10px] text-muted-foreground">
                  pax (ricalcola i kit)
                </span>
              </div>
            )}

            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={useCustomKits}
                onChange={(e) => setUseCustomKits(e.target.checked)}
              />
              Personalizza composizione kit
            </label>
            {useCustomKits && (
              <div className="pl-5 space-y-2">
                <div className="rounded-md border border-border/60 overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/40">
                      <tr>
                        <th className="px-2 py-1.5 text-left">Kit</th>
                        <th className="px-2 py-1.5 text-center">Default</th>
                        <th className="px-2 py-1.5 text-center">Qta</th>
                        <th className="px-2 py-1.5 text-right">€/cad</th>
                      </tr>
                    </thead>
                    <tbody>
                      <KitRow label="KM" defaultQty={defaultKitParams.KM_qty} qty={kmQty} setQty={setKmQty} price={costs?.KM ?? 0} />
                      <KitRow label="KS" defaultQty={defaultKitParams.KS_qty} qty={ksQty} setQty={setKsQty} price={costs?.KS ?? 0} />
                      <KitRow label="CI" defaultQty={defaultKitParams.CI_qty} qty={ciQty} setQty={setCiQty} price={costs?.CI ?? 0} />
                      <KitRow label="KB" defaultQty={defaultKitParams.KB_qty} qty={kbQty} setQty={setKbQty} price={costs?.KB ?? 0} />
                      <tr className="border-t border-border/40">
                        <td className="px-2 py-1.5 text-left font-medium">Base</td>
                        <td className="px-2 py-1.5 text-center text-muted-foreground num">€ {defaultKitParams.base_eur.toFixed(0)}</td>
                        <td className="px-1 py-1">
                          <Input
                            type="number"
                            min={0}
                            step={1}
                            className="num text-center h-7 text-xs"
                            value={baseEur}
                            onChange={(e) => setBaseEur(Math.max(0, Number(e.target.value) || 0))}
                          />
                        </td>
                        <td className="px-2 py-1.5 text-right text-muted-foreground">—</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground">Totale ricalcolato</span>
                  <span className="num font-medium">€ {previewKitCost.toFixed(2)}</span>
                </div>
              </div>
            )}

            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={useCustomCost}
                onChange={(e) => setUseCustomCost(e.target.checked)}
              />
              Override costo finale (€) — sovrascrive tutto
            </label>
            {useCustomCost && (
              <div className="flex items-center gap-2 pl-5">
                <Input
                  type="number"
                  min={0}
                  step={0.5}
                  className="num w-28 h-9"
                  value={customCost}
                  onChange={(e) => setCustomCost(Math.max(0, Number(e.target.value) || 0))}
                />
                <span className="text-[10px] text-muted-foreground">€ totali</span>
              </div>
            )}

            {(useCustomGuests || useCustomCost || useCustomKits) && (
              <div>
                <Label className="text-xs">Motivo (visibile in fattura)</Label>
                <Input
                  className="mt-1.5 text-xs"
                  placeholder="es. Ospite extra non previsto, kit aggiuntivo, pulizia straordinaria…"
                  value={costReason}
                  onChange={(e) => setCostReason(e.target.value)}
                />
              </div>
            )}
          </div>

          <div className="flex justify-between gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={reset} disabled={saving}>
              <RotateCcw className="w-3.5 h-3.5" /> Ripristina default
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={onClose}>Annulla</Button>
              <Button variant="ember" size="sm" onClick={save} disabled={saving}>
                <Save className="w-3.5 h-3.5" /> Salva
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// -------------- PREFERENCES MODAL --------------
function PreferencesModal({ onClose }: { onClose: () => void }) {
  const { cleaningPrefs, saveCleaningPreferences, reservationsAll, visibility } = useData();
  const locals = React.useMemo(() => getVisibleLocals(reservationsAll, visibility), [reservationsAll, visibility]);

  // Assicura che ogni casa abbia un valore (crea se mancante)
  const [draft, setDraft] = React.useState(() => {
    const d = { offsets: { ...cleaningPrefs.offsets }, times: { ...cleaningPrefs.times } };
    for (const l of locals) {
      if (!(l in d.offsets)) d.offsets[l] = 0;
      if (!(l in d.times)) d.times[l] = { from: '10:00', to: '14:00' };
    }
    return d;
  });
  const [saving, setSaving] = React.useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await saveCleaningPreferences(draft);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 bg-ink/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-background rounded-lg border border-border shadow-2xl max-w-lg w-full p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="display text-xl">Preferenze pulizia</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Quando programmare le pulizie per ogni casa. Ogni prenotazione può comunque essere modificata individualmente.
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          {locals.map((l) => (
            <div key={l} className="rounded-md border border-border/60 p-3 space-y-3">
              <Badge variant="outline" className="font-mono">{l}</Badge>
              <div>
                <Label>Giorno pulizia</Label>
                <Select
                  className="mt-1.5 w-full"
                  value={String(draft.offsets[l] ?? 0)}
                  onChange={(e) => setDraft({ ...draft, offsets: { ...draft.offsets, [l]: Number(e.target.value) } })}
                >
                  <option value="-1">Giorno prima del check-out</option>
                  <option value="0">Giorno del check-out</option>
                  <option value="1">Giorno dopo il check-out</option>
                  <option value="2">2 giorni dopo il check-out</option>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Dalle</Label>
                  <Input type="time" className="mt-1.5" value={draft.times[l]?.from ?? '10:00'} onChange={(e) => setDraft({ ...draft, times: { ...draft.times, [l]: { from: e.target.value, to: draft.times[l]?.to ?? '14:00' } } })} />
                </div>
                <div>
                  <Label>Alle</Label>
                  <Input type="time" className="mt-1.5" value={draft.times[l]?.to ?? '14:00'} onChange={(e) => setDraft({ ...draft, times: { ...draft.times, [l]: { from: draft.times[l]?.from ?? '10:00', to: e.target.value } } })} />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" size="sm" onClick={onClose}>Annulla</Button>
          <Button variant="ember" size="sm" onClick={save} disabled={saving}>
            <Save className="w-3.5 h-3.5" /> Salva preferenze
          </Button>
        </div>
      </div>
    </div>
  );
}

// -------------- EXPORT MODAL --------------
function ExportModal({ sessions, onClose }: { sessions: CleaningSession[]; onClose: () => void }) {
  const { reservationsAll, visibility } = useData();
  const locals = React.useMemo(() => getVisibleLocals(reservationsAll, visibility), [reservationsAll, visibility]);
  const today = new Date().toISOString().slice(0, 10);
  const in30 = (() => {
    const d = new Date(); d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  })();
  const [from, setFrom] = React.useState(today);
  const [to, setTo] = React.useState(in30);
  const [selectedLocals, setSelectedLocals] = React.useState<Set<string>>(new Set(locals));

  const filtered = sessions
    .filter((s) => !s.skipped)
    .filter((s) => s.date >= from && s.date <= to)
    .filter((s) => selectedLocals.has(s.local));

  const [exportingCsv, setExportingCsv] = React.useState(false);
  const [exportingPdf, setExportingPdf] = React.useState(false);

  const downloadCsv = async () => {
    setExportingCsv(true);
    try {
      const header = ['Casa', 'Data', 'Giorno', 'Dalle', 'Alle', 'Ospite uscente', 'Persone', 'Note', 'Codice'];
      const rows = filtered.map((s) => {
        const date = new Date(s.date);
        const dayName = new Intl.DateTimeFormat('it-IT', { weekday: 'long' }).format(date);
        return [
          s.local,
          s.date,
          dayName,
          s.from,
          s.to,
          (s.guest_name || '').replace(/"/g, '""'),
          s.guests_num,
          (s.note || '').replace(/"/g, '""'),
          s.resv_key,
        ];
      });
      const csv = [header, ...rows].map((r) => r.map((v) => `"${v}"`).join(',')).join('\n');
      await saveTextFile(`calendario-pulizie_${from}_${to}.csv`, csv, 'text/csv;charset=utf-8;');
      onClose();
    } catch (e: any) {
      console.error('[EXPORT CSV] Error:', e);
      alert(`Errore salvataggio: ${e?.message ?? e}`);
    } finally {
      setExportingCsv(false);
    }
  };

  const printable = async () => {
    setExportingPdf(true);
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Calendario pulizie ${from} - ${to}</title>
      <style>body{font-family:-apple-system,sans-serif;padding:40px;color:#222}h1{font-weight:500}table{width:100%;border-collapse:collapse;margin-top:20px;font-size:13px}th,td{padding:8px 10px;text-align:left;border-bottom:1px solid #ddd}th{background:#f5f5f5;font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:.08em}</style>
    </head><body>
    <h1>Calendario pulizie</h1>
    <p>Dal ${from} al ${to} · Case: ${[...selectedLocals].join(', ')}</p>
    <table><thead><tr><th>Casa</th><th>Data</th><th>Giorno</th><th>Orario</th><th>Ospite</th><th>Pers.</th><th>Note</th></tr></thead>
    <tbody>${filtered.map((s) => {
      const date = new Date(s.date);
      const dayName = new Intl.DateTimeFormat('it-IT', { weekday: 'long' }).format(date);
      return `<tr><td><strong>${s.local}</strong></td><td>${s.date}</td><td>${dayName}</td><td>${s.from} – ${s.to}</td><td>${s.guest_name}</td><td>${s.guests_num}</td><td>${s.note || ''}</td></tr>`;
    }).join('')}</tbody></table>
    </body></html>`;

    try {
      const { jsPDF } = await import('jspdf');
      const html2canvas = (await import('html2canvas')).default;

      const element = document.createElement('div');
      element.innerHTML = html;
      element.style.padding = '20px';
      element.style.width = '210mm';
      element.style.background = 'white';
      document.body.appendChild(element);

      console.log('[PDF CALENDAR] Canvas rendering...');
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
      });
      document.body.removeChild(element);

      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pageWidth = 210;
      const pageHeight = 297;
      const imgWidth = pageWidth - 10;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      let heightLeft = imgHeight;
      let position = 5;

      doc.addImage(imgData, 'JPEG', 5, position, imgWidth, imgHeight);
      heightLeft -= pageHeight - 10;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight + 5;
        doc.addPage();
        doc.addImage(imgData, 'JPEG', 5, position, imgWidth, imgHeight);
        heightLeft -= pageHeight - 10;
      }

      console.log('[PDF CALENDAR] Salvataggio...');
      const blob = doc.output('blob') as Blob;
      await saveBlobFile(`calendario-pulizie_${from}_${to}.pdf`, blob);
      onClose();
    } catch (e: any) {
      console.error('[PDF CALENDAR] Errore:', e);
      alert(`Errore generazione PDF: ${e?.message ?? e}`);
    } finally {
      setExportingPdf(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 bg-ink/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-background rounded-lg border border-border shadow-2xl max-w-lg w-full p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <h3 className="display text-xl">Esporta calendario pulizie</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Dal</Label>
              <Input type="date" className="mt-1.5" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <Label>Al</Label>
              <Input type="date" className="mt-1.5" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Case</Label>
            <div className="flex gap-2 mt-1.5 flex-wrap">
              {locals.map((l) => (
                <button
                  key={l}
                  onClick={() => {
                    const next = new Set(selectedLocals);
                    if (next.has(l)) next.delete(l);
                    else next.add(l);
                    setSelectedLocals(next);
                  }}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-xs font-mono transition-all',
                    selectedLocals.has(l) ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground'
                  )}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
          <div className="rounded-md bg-muted/50 px-4 py-3 text-sm">
            <b className="num">{filtered.length}</b> sessioni nel periodo selezionato
          </div>
          <div className="flex gap-2 justify-end">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={async () => {
                console.log('[PDF CALENDAR BTN] Starting...');
                try {
                  await printable();
                  console.log('[PDF CALENDAR BTN] Complete');
                } catch (e) {
                  console.error('[PDF CALENDAR BTN] Failed:', e);
                }
              }}
              disabled={filtered.length === 0 || exportingPdf}
            >
              {exportingPdf ? '…' : 'Stampa'} / PDF
            </Button>
            <Button 
              variant="ember" 
              size="sm" 
              onClick={async () => {
                console.log('[CSV EXPORT] Starting...');
                try {
                  await downloadCsv();
                  console.log('[CSV EXPORT] Complete');
                } catch (e) {
                  console.error('[CSV EXPORT] Failed:', e);
                }
              }}
              disabled={filtered.length === 0 || exportingCsv}
            >
              {exportingCsv ? '…' : <Download className="w-3.5 h-3.5" />} 
              {exportingCsv ? 'Esportando' : 'Scarica CSV'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// -------------- KIT ROW (riga editabile composizione kit) --------------
function KitRow({
  label, defaultQty, qty, setQty, price,
}: {
  label: string;
  defaultQty: number;
  qty: number;
  setQty: (v: number) => void;
  price: number;
}) {
  const diff = qty !== defaultQty;
  return (
    <tr className="border-t border-border/40">
      <td className="px-2 py-1.5 text-left font-mono text-[11px]">{label}</td>
      <td className="px-2 py-1.5 text-center text-muted-foreground num">{defaultQty}</td>
      <td className="px-1 py-1">
        <Input
          type="number"
          min={0}
          step={1}
          className={cn('num text-center h-7 text-xs', diff && 'border-amber-500 bg-amber-50 dark:bg-amber-950/20')}
          value={qty}
          onChange={(e) => setQty(Math.max(0, Number(e.target.value) || 0))}
        />
      </td>
      <td className="px-2 py-1.5 text-right num text-muted-foreground">€ {price.toFixed(2)}</td>
    </tr>
  );
}
