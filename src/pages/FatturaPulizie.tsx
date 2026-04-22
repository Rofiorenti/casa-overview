import * as React from 'react';
import { useData } from '@/hooks/useData';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, Input, Select, Label, Badge, Empty, Separator, Stat } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { eur, num, cn } from '@/lib/utils';
import { MESI_IT, type FatturaPulizieMonth, type CostComponents, type CleaningFormulas } from '@/lib/types';
import { getVisibleLocals } from '@/lib/visibility';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { computeFatturaAuto, enumerateFatturaMonths } from '@/lib/calculations';
import { Save, Sparkles, SlidersHorizontal, Info, RefreshCw, FileDown, X, Settings2 } from 'lucide-react';
import { saveBlobFile } from '@/lib/fileSave';

export function FatturaPulizieePage() {
  const [showExport, setShowExport] = React.useState(false);
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground">Fornitore pulizie</div>
          <h1 className="display text-3xl lg:text-4xl mt-2">Fattura pulizie</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Fattura calcolata automaticamente dai soggiorni. Puoi inserire il prezzo effettivo e il numero di fattura.
          </p>
        </div>
        <Button variant="ember" onClick={() => setShowExport(true)}>
          <FileDown className="w-4 h-4" /> Esporta PDF per team pulizie
        </Button>
      </div>

      <Tabs defaultValue="fatture">
        <TabsList>
          <TabsTrigger value="fatture">
            <Sparkles className="w-3.5 h-3.5" /> Fatture mensili
          </TabsTrigger>
          <TabsTrigger value="parametri">
            <SlidersHorizontal className="w-3.5 h-3.5" /> Parametri di calcolo
          </TabsTrigger>
        </TabsList>

        <TabsContent value="fatture">
          <FatturaMensiliSection />
        </TabsContent>
        <TabsContent value="parametri">
          <ParametriSection />
        </TabsContent>
      </Tabs>

      {showExport && <ExportPdfModal onClose={() => setShowExport(false)} />}
    </div>
  );
}

// ================= FATTURE MENSILI =================
function FatturaMensiliSection() {
  const { reservations, reservationsAll, costs, cleaningFormulas, cleaningOverrides, fattura, saveFatturaRow, visibility } = useData();
  const locals = React.useMemo(() => getVisibleLocals(reservationsAll, visibility), [reservationsAll, visibility]);
  const [selectedLocal, setSelectedLocal] = React.useState<string>(() => locals[0] ?? 'C3A');
  React.useEffect(() => {
    if (!locals.includes(selectedLocal) && locals.length > 0) setSelectedLocal(locals[0]);
  }, [locals, selectedLocal]);

  const months = React.useMemo(
    () => enumerateFatturaMonths(reservations).filter((m) => m.local === selectedLocal),
    [reservations, selectedLocal]
  );

  if (reservations.length === 0) {
    return <Empty title="Nessuna prenotazione" description="Le fatture si calcolano automaticamente dai soggiorni." />;
  }

  // Totali aggregati per la casa selezionata
  const rows: Array<{ m: { local: string; month_key: string }; auto: ReturnType<typeof computeFatturaAuto>; saved?: FatturaPulizieMonth }> =
    months.map((m) => {
      const auto = computeFatturaAuto(reservations, m.local, m.month_key, costs, cleaningFormulas, cleaningOverrides);
      const id = `${m.local}-${m.month_key}`;
      const saved = fattura.find((f) => f.id === id);
      return { m, auto, saved };
    });

  const totalAuto = rows.reduce((s, r) => s + r.auto.auto_sconto_10_eur, 0);
  const totalEffettivo = rows.reduce((s, r) => s + (r.saved?.prezzo_effettivo_eur ?? r.auto.auto_sconto_10_eur), 0);
  const totalSoggiorni = rows.reduce((s, r) => s + r.auto.auto_num_soggiorni, 0);

  return (
    <div className="space-y-5">
      {/* Selector casa */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground mr-2">Casa</span>
        {locals.map((l) => (
          <button
            key={l}
            onClick={() => setSelectedLocal(l)}
            className={cn(
              'px-3 py-1 rounded-full text-sm font-mono transition-colors',
              selectedLocal === l ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'
            )}
          >
            {l}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Soggiorni totali" value={num(totalSoggiorni)} />
        <Stat label="Totale auto (−10%)" value={eur(totalAuto)} />
        <Stat label="Totale effettivo" value={eur(totalEffettivo)} accent hint="Se inserito, altrimenti somma degli auto" />
      </div>

      {rows.length === 0 ? (
        <Empty title="Nessun mese" description={`Nessun soggiorno registrato per ${selectedLocal}.`} />
      ) : (
        <div className="space-y-3">
          {rows.map(({ m, auto, saved }) => (
            <FatturaMonthRow
              key={`${m.local}-${m.month_key}`}
              local={m.local}
              month_key={m.month_key}
              auto={auto}
              saved={saved}
              onSave={(row) => saveFatturaRow(row)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FatturaMonthRow({
  local, month_key, auto, saved, onSave,
}: {
  local: string; month_key: string;
  auto: ReturnType<typeof computeFatturaAuto>;
  saved?: FatturaPulizieMonth;
  onSave: (row: FatturaPulizieMonth) => Promise<void>;
}) {
  const [y, m] = month_key.split('-').map(Number);
  const label = `${MESI_IT[m - 1]} ${y}`;
  const [detailsOpen, setDetailsOpen] = React.useState(false);

  const overrideCount = auto.details.filter(d => d.hasOverride || d.skipped).length;

  const [prezzo, setPrezzo] = React.useState<string>(
    saved?.prezzo_effettivo_eur != null ? String(saved.prezzo_effettivo_eur) : ''
  );
  const [num_fatt, setNumFatt] = React.useState<string>(saved?.numero_fattura ?? '');
  const [stato, setStato] = React.useState<FatturaPulizieMonth['stato']>(saved?.stato ?? 'da_pagare');
  const [saving, setSaving] = React.useState(false);
  const [justSaved, setJustSaved] = React.useState(false);

  const prezzoNum = prezzo ? Number(prezzo) : null;
  const delta = prezzoNum != null ? prezzoNum - auto.auto_sconto_10_eur : 0;

  const isDirty = (() => {
    const sPrezzo = saved?.prezzo_effettivo_eur != null ? String(saved.prezzo_effettivo_eur) : '';
    return prezzo !== sPrezzo || num_fatt !== (saved?.numero_fattura ?? '') || stato !== (saved?.stato ?? 'da_pagare');
  })();

  const save = async () => {
    setSaving(true);
    try {
      await onSave({
        id: `${local}-${month_key}`,
        local,
        month_key,
        auto_totale_eur: auto.auto_totale_eur,
        auto_sconto_10_eur: auto.auto_sconto_10_eur,
        auto_num_soggiorni: auto.auto_num_soggiorni,
        prezzo_effettivo_eur: prezzoNum,
        numero_fattura: num_fatt.trim() || null,
        stato,
      });
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 1500);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-[160px]">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="font-mono">{local}</Badge>
              <span className="display text-lg capitalize">{label}</span>
              {overrideCount > 0 && (
                <Badge variant="warning" className="text-[10px]">
                  {overrideCount} modifica{overrideCount === 1 ? '' : 'he'}
                </Badge>
              )}
            </div>
            <div className="text-xs text-muted-foreground mt-1 num">
              {auto.auto_num_soggiorni} soggiorni · {eur(auto.auto_totale_eur)} lordo
            </div>
            {auto.details.length > 0 && (
              <button
                onClick={() => setDetailsOpen(!detailsOpen)}
                className="text-[10px] text-accent hover:underline mt-1"
              >
                {detailsOpen ? 'Nascondi dettagli' : `Mostra dettagli (${auto.details.length})`}
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 flex-1 min-w-[400px]">
            <div>
              <Label>Auto (−10%)</Label>
              <div className="num text-sm mt-2 pl-1 text-muted-foreground">{eur(auto.auto_sconto_10_eur)}</div>
            </div>
            <div>
              <Label>Prezzo effettivo</Label>
              <Input
                type="number"
                className="mt-1.5 num"
                placeholder="—"
                step="0.01"
                value={prezzo}
                onChange={(e) => setPrezzo(e.target.value)}
              />
              {prezzoNum != null && delta !== 0 && (
                <div className={cn('text-[10px] mt-0.5 num', delta > 0 ? 'text-amber-700' : 'text-emerald-700')}>
                  {delta > 0 ? '+' : ''}{eur(delta)} vs auto
                </div>
              )}
            </div>
            <div>
              <Label>N° fattura</Label>
              <Input
                className="mt-1.5"
                placeholder="—"
                value={num_fatt}
                onChange={(e) => setNumFatt(e.target.value)}
              />
            </div>
            <div>
              <Label>Stato</Label>
              <Select
                className="mt-1.5 w-full"
                value={stato}
                onChange={(e) => setStato(e.target.value as FatturaPulizieMonth['stato'])}
              >
                <option value="da_pagare">Da pagare</option>
                <option value="corretto">Corretto</option>
                <option value="pagato">Pagato</option>
              </Select>
            </div>
            <div className="flex items-end gap-1.5">
              {justSaved && <Badge variant="success" className="mb-1">OK</Badge>}
              <Button variant="ember" size="sm" onClick={save} disabled={saving || !isDirty}>
                <Save className="w-3.5 h-3.5" />
                Salva
              </Button>
            </div>
          </div>
        </div>

        {detailsOpen && auto.details.length > 0 && (
          <div className="mt-4 pt-3 border-t border-border/40">
            <div className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground mb-2">Dettaglio pulizie del mese</div>
            <div className="space-y-1">
              {auto.details.map((d) => {
                const dateLabel = d.checkout_date
                  ? new Date(d.checkout_date).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })
                  : '—';
                return (
                  <div
                    key={d.resv_key}
                    className={cn(
                      'flex items-center justify-between gap-2 text-xs px-2 py-1.5 rounded',
                      d.skipped ? 'bg-muted/40 text-muted-foreground line-through'
                        : d.hasOverride ? 'bg-amber-50 dark:bg-amber-950/20'
                        : 'hover:bg-muted/30'
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="num text-[11px] w-14 shrink-0 text-muted-foreground">{dateLabel}</span>
                      <span className="truncate">{d.checkout_guest}</span>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {d.guests_used}p
                        {d.guests_next != null && d.guests_used !== d.guests_next && (
                          <span className="text-amber-700 ml-1">(era {d.guests_next})</span>
                        )}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {d.hasOverride && !d.skipped && Math.abs(d.final_cost - d.formula_cost) > 0.01 && (
                        <span className="text-[10px] text-muted-foreground line-through num">{eur(d.formula_cost)}</span>
                      )}
                      <span className={cn('num font-medium', d.skipped && 'text-muted-foreground')}>
                        {eur(d.final_cost)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ================= PARAMETRI DI CALCOLO =================
function ParametriSection() {
  const { costs, saveCostComponents, cleaningFormulas, saveCleaningFormulasData, reservationsAll, visibility } = useData();
  const allLocals = React.useMemo(() => getVisibleLocals(reservationsAll, visibility), [reservationsAll, visibility]);

  const [kitDraft, setKitDraft] = React.useState<CostComponents>(costs);
  const [kitSaved, setKitSaved] = React.useState(false);
  const [editingHouse, setEditingHouse] = React.useState<string | null>(null);

  React.useEffect(() => setKitDraft(costs), [costs]);

  const saveKits = async () => {
    await saveCostComponents(kitDraft);
    setKitSaved(true);
    setTimeout(() => setKitSaved(false), 1500);
  };
  const resetKits = () => setKitDraft(costs);
  const kitDirty = JSON.stringify(kitDraft) !== JSON.stringify(costs);

  // Lista completa case (quelle con dati + quelle con formule custom)
  const allHouses = React.useMemo(() => {
    const set = new Set<string>(allLocals);
    Object.keys(cleaningFormulas).forEach(h => set.add(h));
    return [...set].sort();
  }, [allLocals, cleaningFormulas]);

  return (
    <div className="space-y-5">
      <Card className="bg-accent/5 border-accent/20">
        <CardContent className="pt-4 pb-4 flex gap-3 items-start">
          <Info className="w-4 h-4 text-accent mt-0.5 shrink-0" />
          <div className="text-xs text-foreground/80 leading-relaxed">
            I prezzi dei 4 kit (KM, KS, CI, KB) sono uguali per tutte le case.
            La composizione delle pulizie (quanti kit usare per ogni numero di ospiti e il costo base)
            varia da casa a casa — clicca sul pulsante della casa per configurarla.
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Prezzi kit (globali)</CardTitle>
          <CardDescription>Costi unitari validi per tutte le case.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <NumField label="KM — kit matrimoniale" value={kitDraft.KM} step={0.1} suffix="€" onChange={(v) => setKitDraft({ ...kitDraft, KM: v })} />
            <NumField label="KS — kit sporco" value={kitDraft.KS} step={0.1} suffix="€" onChange={(v) => setKitDraft({ ...kitDraft, KS: v })} />
            <NumField label="CI — carta igienica" value={kitDraft.CI} step={0.1} suffix="€" onChange={(v) => setKitDraft({ ...kitDraft, CI: v })} />
            <NumField label="KB — kit bagno" value={kitDraft.KB} step={0.1} suffix="€" onChange={(v) => setKitDraft({ ...kitDraft, KB: v })} />
          </div>
          <Separator className="my-5" />
          <div className="flex items-center justify-end gap-2">
            {kitSaved && <Badge variant="success">Salvato</Badge>}
            <Button variant="outline" size="sm" onClick={resetKits} disabled={!kitDirty}>
              <RefreshCw className="w-3.5 h-3.5" /> Ripristina
            </Button>
            <Button variant="ember" size="sm" onClick={saveKits} disabled={!kitDirty}>
              <Save className="w-3.5 h-3.5" /> Salva kit
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Formule pulizie per casa</CardTitle>
          <CardDescription>
            Per ogni casa definisci il costo base e quanti kit servono in base al numero di ospiti.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {allHouses.map((h) => {
              const f = cleaningFormulas[h];
              const configured = !!f;
              return (
                <button
                  key={h}
                  onClick={() => setEditingHouse(h)}
                  className="text-left rounded-md border border-border/60 hover:border-accent/50 hover:bg-accent/5 transition-all p-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="font-mono text-sm font-medium">{h}</div>
                    <Settings2 className="w-3.5 h-3.5 text-muted-foreground" />
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-1">
                    {configured
                      ? `max ${f.max_guests} ospiti · base ${eur(f.base_eur)}`
                      : 'Non configurata'}
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {editingHouse && (
        <CleaningFormulaModal
          house={editingHouse}
          formulas={cleaningFormulas}
          kits={costs}
          onClose={() => setEditingHouse(null)}
          onSave={async (next) => {
            await saveCleaningFormulasData(next);
            setEditingHouse(null);
          }}
        />
      )}
    </div>
  );
}

// ================= MODALE EDITOR FORMULA CASA =================
function CleaningFormulaModal({
  house, formulas, kits, onClose, onSave,
}: {
  house: string;
  formulas: CleaningFormulas;
  kits: CostComponents;
  onClose: () => void;
  onSave: (f: CleaningFormulas) => Promise<void>;
}) {
  const initial = formulas[house] ?? { max_guests: 4, base_eur: 0, rows: [] };
  const [draft, setDraft] = React.useState(() => {
    if (initial.rows.length === 0) {
      // Popola righe vuote se non ci sono
      const rows = [];
      for (let n = 1; n <= initial.max_guests; n++) {
        rows.push({ guests: n, KM_qty: 0, KS_qty: 0, CI_qty: 0, KB_qty: 0 });
      }
      return { ...initial, rows };
    }
    return initial;
  });

  const updateMax = (newMax: number) => {
    const safe = Math.max(1, Math.min(20, Math.floor(newMax)));
    const rows = [];
    for (let n = 1; n <= safe; n++) {
      const existing = draft.rows.find(r => r.guests === n);
      rows.push(existing ?? { guests: n, KM_qty: 0, KS_qty: 0, CI_qty: 0, KB_qty: 0 });
    }
    setDraft({ ...draft, max_guests: safe, rows });
  };

  const updateCell = (guests: number, field: 'KM_qty' | 'KS_qty' | 'CI_qty' | 'KB_qty', value: number) => {
    setDraft({
      ...draft,
      rows: draft.rows.map(r => r.guests === guests ? { ...r, [field]: Math.max(0, value) } : r),
    });
  };

  const computeTotal = (r: typeof draft.rows[0]) =>
    draft.base_eur + r.KM_qty * kits.KM + r.KS_qty * kits.KS + r.CI_qty * kits.CI + r.KB_qty * kits.KB;

  const save = async () => {
    await onSave({ ...formulas, [house]: draft });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end md:items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-card border border-border/70 rounded-t-lg md:rounded-lg w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-card border-b border-border/70 px-5 py-3 flex items-center justify-between">
          <div>
            <div className="font-mono text-sm font-medium">{house}</div>
            <div className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Formula pulizie</div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <NumField
              label="Costo base (€)"
              value={draft.base_eur}
              step={1}
              suffix="€"
              onChange={(v) => setDraft({ ...draft, base_eur: v })}
            />
            <NumField
              label="Max ospiti"
              value={draft.max_guests}
              step={1}
              onChange={updateMax}
            />
          </div>

          <div className="rounded-md border border-border/60 overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-muted/40">
                <tr>
                  <th className="px-2 py-2 text-left">Ospiti</th>
                  <th className="px-2 py-2 text-center">KM</th>
                  <th className="px-2 py-2 text-center">KS</th>
                  <th className="px-2 py-2 text-center">CI</th>
                  <th className="px-2 py-2 text-center">KB</th>
                  <th className="px-2 py-2 text-right">Totale</th>
                </tr>
              </thead>
              <tbody>
                {draft.rows.map((r) => (
                  <tr key={r.guests} className="border-t border-border/40">
                    <td className="px-2 py-2 num">{r.guests}</td>
                    <td className="px-1 py-1">
                      <Input
                        type="number"
                        min={0}
                        step={1}
                        className="num text-center h-8 text-xs"
                        value={r.KM_qty}
                        onChange={(e) => updateCell(r.guests, 'KM_qty', Number(e.target.value) || 0)}
                      />
                    </td>
                    <td className="px-1 py-1">
                      <Input
                        type="number"
                        min={0}
                        step={1}
                        className="num text-center h-8 text-xs"
                        value={r.KS_qty}
                        onChange={(e) => updateCell(r.guests, 'KS_qty', Number(e.target.value) || 0)}
                      />
                    </td>
                    <td className="px-1 py-1">
                      <Input
                        type="number"
                        min={0}
                        step={1}
                        className="num text-center h-8 text-xs"
                        value={r.CI_qty}
                        onChange={(e) => updateCell(r.guests, 'CI_qty', Number(e.target.value) || 0)}
                      />
                    </td>
                    <td className="px-1 py-1">
                      <Input
                        type="number"
                        min={0}
                        step={1}
                        className="num text-center h-8 text-xs"
                        value={r.KB_qty}
                        onChange={(e) => updateCell(r.guests, 'KB_qty', Number(e.target.value) || 0)}
                      />
                    </td>
                    <td className="px-2 py-2 text-right num font-medium">{eur(computeTotal(r))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="text-[10px] text-muted-foreground">
            Totale = base + KM·{kits.KM.toFixed(2)}€ + KS·{kits.KS.toFixed(2)}€ + CI·{kits.CI.toFixed(2)}€ + KB·{kits.KB.toFixed(2)}€
          </div>
        </div>

        <div className="sticky bottom-0 bg-card border-t border-border/70 px-5 py-3 flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>Annulla</Button>
          <Button variant="ember" size="sm" onClick={save}>
            <Save className="w-3.5 h-3.5" /> Salva
          </Button>
        </div>
      </div>
    </div>
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

// ================= PDF EXPORT MODAL =================
function ExportPdfModal({ onClose }: { onClose: () => void }) {
  const { reservations, reservationsAll, costs, cleaningFormulas, cleaningOverrides, fattura, visibility } = useData();
  const locals = React.useMemo(() => getVisibleLocals(reservationsAll, visibility), [reservationsAll, visibility]);
  const allMonths = React.useMemo(() => enumerateFatturaMonths(reservations, locals), [reservations, locals]);

  // Stato selezione
  const [selectedLocals, setSelectedLocals] = React.useState<Set<string>>(new Set(locals));
  const [selectedMonths, setSelectedMonths] = React.useState<Set<string>>(() => {
    const now = new Date();
    const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    // Default: mese corrente se presente, altrimenti nessuno
    return new Set(allMonths.some((m) => m.month_key === currentKey) ? [currentKey] : []);
  });
  const [generating, setGenerating] = React.useState(false);
  const [useEffectivePrice, setUseEffectivePrice] = React.useState(true);
  const [notes, setNotes] = React.useState('');

  const monthKeys = React.useMemo(() => {
    const set = new Set<string>();
    for (const m of allMonths) set.add(m.month_key);
    return [...set].sort((a, b) => b.localeCompare(a));
  }, [allMonths]);

  const toggleLocal = (l: string) => {
    const next = new Set(selectedLocals);
    if (next.has(l)) next.delete(l); else next.add(l);
    setSelectedLocals(next);
  };
  const toggleMonth = (mk: string) => {
    const next = new Set(selectedMonths);
    if (next.has(mk)) next.delete(mk); else next.add(mk);
    setSelectedMonths(next);
  };

  const generatePdf = async () => {
    setGenerating(true);
    try {
      const { jsPDF } = await import('jspdf');
      const autoTable = (await import('jspdf-autotable')).default;
      const doc = new jsPDF({ unit: 'pt', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();

      // Header
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(20);
      doc.text('Fattura pulizie', 40, 50);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(100);
      const today = new Date().toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' });
      doc.text(`Documento generato il ${today}`, 40, 68);

      let yOffset = 95;

      // Raggruppa per casa, poi per mese
      const sortedLocals = [...selectedLocals].filter((l) => locals.includes(l));
      const sortedMonths = [...selectedMonths].sort();
      let grandTotal = 0;

      for (const local of sortedLocals) {
        // Titolo casa
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.setTextColor(30);
        if (yOffset > 720) { doc.addPage(); yOffset = 50; }
        doc.text(local, 40, yOffset);
        yOffset += 8;

        // Righe per ogni mese selezionato
        const rows: Array<[string, string, string, string, string]> = [];
        let localTot = 0;
        let hasAnyOverrideInLocal = false;
        for (const mk of sortedMonths) {
          const auto = computeFatturaAuto(reservations, local, mk, costs, cleaningFormulas, cleaningOverrides);
          if (auto.auto_num_soggiorni === 0) continue;
          const id = `${local}-${mk}`;
          const saved = fattura.find((f) => f.id === id);
          const prezzo = useEffectivePrice && saved?.prezzo_effettivo_eur != null
            ? saved.prezzo_effettivo_eur
            : auto.auto_sconto_10_eur;
          const [y, m] = mk.split('-').map(Number);
          const mLabel = `${MESI_IT[m - 1]} ${y}`;

          const monthHasOverride = auto.details.some(d => d.hasOverride || d.skipped);
          if (monthHasOverride) hasAnyOverrideInLocal = true;

          rows.push([
            mLabel.charAt(0).toUpperCase() + mLabel.slice(1) + (monthHasOverride ? ' *' : ''),
            String(auto.auto_num_soggiorni),
            `€ ${auto.auto_totale_eur.toFixed(2)}`,
            saved?.numero_fattura ?? '—',
            `€ ${prezzo.toFixed(2)}`,
          ]);
          localTot += prezzo;
        }

        if (rows.length === 0) {
          doc.setFont('helvetica', 'italic');
          doc.setFontSize(9);
          doc.setTextColor(150);
          doc.text('Nessun soggiorno nei mesi selezionati.', 40, yOffset + 15);
          yOffset += 35;
          continue;
        }

        autoTable(doc, {
          startY: yOffset + 5,
          head: [['Mese', 'Soggiorni', 'Totale lordo', 'N° fattura', 'Importo dovuto']],
          body: rows,
          foot: [[
            'Totale casa', '', '', '',
            `€ ${localTot.toFixed(2)}`,
          ]],
          theme: 'striped',
          headStyles: { fillColor: [40, 40, 40], textColor: 255, fontSize: 9 },
          footStyles: { fillColor: [230, 230, 230], textColor: 30, fontStyle: 'bold', fontSize: 10 },
          bodyStyles: { fontSize: 9 },
          columnStyles: {
            0: { cellWidth: 110 },
            1: { halign: 'right', cellWidth: 70 },
            2: { halign: 'right', cellWidth: 100 },
            3: { halign: 'left', cellWidth: 90 },
            4: { halign: 'right', fontStyle: 'bold' },
          },
          margin: { left: 40, right: 40 },
        });

        yOffset = (doc as any).lastAutoTable.finalY + 20;
        grandTotal += localTot;
      }

      // Totale finale
      if (yOffset > 700) { doc.addPage(); yOffset = 50; }
      doc.setDrawColor(30);
      doc.setLineWidth(1);
      doc.line(40, yOffset, pageWidth - 40, yOffset);
      yOffset += 25;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(30);
      doc.text('Totale complessivo', 40, yOffset);
      doc.text(`€ ${grandTotal.toFixed(2)}`, pageWidth - 40, yOffset, { align: 'right' });
      yOffset += 30;

      // Dettaglio modifiche manuali (override)
      const overrideRows: Array<[string, string, string, string, string]> = [];
      for (const local of sortedLocals) {
        for (const mk of sortedMonths) {
          const auto = computeFatturaAuto(reservations, local, mk, costs, cleaningFormulas, cleaningOverrides);
          for (const d of auto.details) {
            if (!d.hasOverride && !d.skipped) continue;
            const [y, m] = mk.split('-').map(Number);
            const mLabel = `${MESI_IT[m - 1]} ${y}`;
            const checkoutShort = d.checkout_date
              ? new Date(d.checkout_date).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })
              : '—';
            let modifica = '';
            if (d.skipped) modifica = 'Pulizia saltata';
            else {
              const parts: string[] = [];
              if (d.guests_used !== (d.guests_next ?? d.guests_current)) {
                parts.push(`pax ${d.guests_next ?? d.guests_current} → ${d.guests_used}`);
              }
              if (Math.abs(d.final_cost - d.formula_cost) > 0.01) {
                parts.push(`€ ${d.formula_cost.toFixed(2)} → € ${d.final_cost.toFixed(2)}`);
              }
              modifica = parts.join(' · ') || 'modificata';
            }
            overrideRows.push([
              local,
              mLabel.charAt(0).toUpperCase() + mLabel.slice(1),
              `${checkoutShort} — ${d.checkout_guest}`,
              modifica,
              d.reason ?? '—',
            ]);
          }
        }
      }

      if (overrideRows.length > 0) {
        if (yOffset > 650) { doc.addPage(); yOffset = 50; }
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(60);
        doc.text('Dettaglio modifiche manuali (*)', 40, yOffset);
        yOffset += 5;
        autoTable(doc, {
          startY: yOffset + 5,
          head: [['Casa', 'Mese', 'Pulizia', 'Modifica', 'Motivo']],
          body: overrideRows,
          theme: 'plain',
          headStyles: { fillColor: [245, 245, 245], textColor: 40, fontSize: 8 },
          bodyStyles: { fontSize: 8, textColor: 60 },
          columnStyles: {
            0: { cellWidth: 45 },
            1: { cellWidth: 70 },
            2: { cellWidth: 130 },
            3: { cellWidth: 110 },
            4: { cellWidth: 'auto' },
          },
          margin: { left: 40, right: 40 },
        });
        yOffset = (doc as any).lastAutoTable.finalY + 15;
      }

      // Note opzionali
      if (notes.trim()) {
        if (yOffset > 720) { doc.addPage(); yOffset = 50; }
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(80);
        const splitted = doc.splitTextToSize(notes, pageWidth - 80);
        doc.text(splitted, 40, yOffset);
      }

      // Filename
      const fromKey = sortedMonths[0] ?? 'x';
      const toKey = sortedMonths[sortedMonths.length - 1] ?? 'x';
      const fname = sortedLocals.length === 1
        ? `fattura_pulizie_${sortedLocals[0]}_${fromKey}_${toKey}.pdf`
        : `fattura_pulizie_${fromKey}_${toKey}.pdf`;

      // jsPDF: usa output('blob') e delega al helper nativo
      const blob = doc.output('blob') as Blob;
      await saveBlobFile(fname, blob);
      onClose();
    } catch (e) {
      console.error('PDF generation failed', e);
      alert('Errore durante la generazione del PDF');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 bg-ink/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-background rounded-lg border border-border shadow-2xl max-w-xl w-full p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="display text-xl">Esporta PDF fattura pulizie</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Seleziona quali case e mesi includere nel PDF da inviare al team pulizie.
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <Label>Case</Label>
            <div className="flex gap-2 mt-1.5 flex-wrap">
              {locals.map((l) => (
                <button
                  key={l}
                  onClick={() => toggleLocal(l)}
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

          <div>
            <Label>Mesi</Label>
            {monthKeys.length === 0 ? (
              <p className="text-xs text-muted-foreground mt-1.5">Nessun mese con soggiorni disponibile.</p>
            ) : (
              <div className="flex gap-1.5 mt-1.5 flex-wrap max-h-48 overflow-y-auto border border-border/60 rounded-md p-2">
                {monthKeys.map((mk) => {
                  const [y, m] = mk.split('-').map(Number);
                  return (
                    <button
                      key={mk}
                      onClick={() => toggleMonth(mk)}
                      className={cn(
                        'px-2.5 py-1 rounded text-xs transition-all num',
                        selectedMonths.has(mk) ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                      )}
                    >
                      {MESI_IT[m - 1].slice(0, 3)} {y}
                    </button>
                  );
                })}
              </div>
            )}
            <div className="flex gap-2 mt-2 text-[10px]">
              <button className="text-accent hover:underline" onClick={() => setSelectedMonths(new Set(monthKeys))}>Seleziona tutti</button>
              <button className="text-muted-foreground hover:underline" onClick={() => setSelectedMonths(new Set())}>Deseleziona tutti</button>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={useEffectivePrice} onChange={(e) => setUseEffectivePrice(e.target.checked)} />
            <span>
              Usa prezzo effettivo quando presente
              <span className="block text-[10px] text-muted-foreground">
                Se disattivato, nel PDF viene usato solo il totale auto-calcolato.
              </span>
            </span>
          </label>

          <div>
            <Label>Note (opzionali)</Label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Es: pagamento previsto entro fine mese…"
              className="w-full mt-1.5 rounded-md border border-input bg-background/60 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 resize-y"
            />
          </div>

          <div className="rounded-md bg-muted/50 px-4 py-3 text-sm">
            <b className="num">{selectedLocals.size}</b> case ·{' '}
            <b className="num">{selectedMonths.size}</b> mesi selezionati
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={onClose}>Annulla</Button>
            <Button
              variant="ember"
              size="sm"
              onClick={generatePdf}
              disabled={generating || selectedLocals.size === 0 || selectedMonths.size === 0}
            >
              <FileDown className="w-3.5 h-3.5" />
              {generating ? 'Genero…' : 'Genera PDF'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
