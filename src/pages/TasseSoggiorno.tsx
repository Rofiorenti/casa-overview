import * as React from 'react';
import { useData } from '@/hooks/useData';
import { Card, CardContent, CardHeader, CardTitle, Stat, Empty } from '@/components/ui/primitives';
import { buildTaxMonthly, quarterMonths, type TaxMonthCell } from '@/lib/taxCalc';
import { eur, num, cn } from '@/lib/utils';
import { MESI_IT, type TaxCategory } from '@/lib/types';
import { getVisibleLocals } from '@/lib/visibility';
import { Info, AlertCircle } from 'lucide-react';

const CAT_LABELS: Record<TaxCategory, { short: string; full: string; color: string }> = {
  paganti_ota:       { short: 'Paganti OTA',     full: 'Paganti (Booking, Expedia, diretti)',   color: 'text-emerald-700' },
  airbnb:            { short: 'Airbnb',          full: 'Paganti via Airbnb (Airbnb versa al comune)', color: 'text-rose-700' },
  minori:            { short: 'Minori',          full: 'Minori < 18 anni (esenti)',              color: 'text-sky-700' },
  residenti_milano:  { short: 'Res. Milano',     full: 'Residenti a Milano (esenti)',            color: 'text-purple-700' },
};

export function TasseSoggiornoPage() {
  const { reservations, reservationsAll, guestRecords, budget, activeYear, setYear, visibility } = useData();

  const years = React.useMemo(() => {
    const s = new Set<number>();
    reservationsAll.forEach((r) => r.year && s.add(r.year));
    if (s.size === 0) s.add(new Date().getFullYear());
    return [...s].sort();
  }, [reservationsAll]);

  const locals = React.useMemo(
    () => getVisibleLocals(reservationsAll, visibility),
    [reservationsAll, visibility]
  );

  const [quarter, setQuarter] = React.useState<number>(() => Math.ceil((new Date().getMonth() + 1) / 3));
  const [localTab, setLocalTab] = React.useState<string>('ALL');

  const analysis = React.useMemo(
    () => buildTaxMonthly({ year: activeYear, budget, guests: guestRecords, reservations, locals }),
    [activeYear, budget, guestRecords, reservations, locals]
  );

  const months = quarterMonths(quarter);

  if (reservationsAll.length === 0) {
    return (
      <div className="space-y-6">
        <Header />
        <Empty title="Nessun dato" description="Serve almeno il CSV prenotazioni per calcolare la tassa." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Header />

      {/* Year + Quarter selectors */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground mr-2">Anno</span>
          {years.map((y) => (
            <button
              key={y}
              onClick={() => setYear(y)}
              className={cn(
                'px-3 py-1 rounded-full text-sm transition-colors num',
                y === activeYear ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'
              )}
            >
              {y}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground mr-2">Trimestre</span>
          {[1, 2, 3, 4].map((q) => {
            const mLabels = quarterMonths(q).map((m) => MESI_IT[m - 1].slice(0, 3)).join('–');
            return (
              <button
                key={q}
                onClick={() => setQuarter(q)}
                className={cn(
                  'px-3 py-1 rounded-full text-xs transition-colors num',
                  q === quarter ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'
                )}
                title={mLabels}
              >
                Q{q}
              </button>
            );
          })}
        </div>
      </div>

      {!analysis.hasBuroData && (
        <Card className="bg-amber-50 border-amber-300 dark:bg-amber-950/20 dark:border-amber-700/60">
          <CardContent className="pt-4 pb-4 flex gap-3 items-start">
            <AlertCircle className="w-4 h-4 text-amber-700 mt-0.5 shrink-0" />
            <div className="text-xs text-foreground/80 leading-relaxed">
              <b>Dati ospiti mancanti</b> — senza <code className="mx-1 px-1 bg-background rounded">buro.csv</code>
              non posso distinguere minorenni e residenti Milano. Gli ospiti vengono tutti classificati come
              "Paganti OTA" o "Airbnb" in base al canale. Per avere il dettaglio completo, scarica il CSV burocrazia dalla pagina Impostazioni.
            </div>
          </CardContent>
        </Card>
      )}

      {/* Local tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground mr-2">Casa</span>
        <button
          onClick={() => setLocalTab('ALL')}
          className={cn(
            'px-3 py-1 rounded-full text-sm transition-colors',
            localTab === 'ALL' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'
          )}
        >
          Tutte
        </button>
        {locals.map((l) => (
          <button
            key={l}
            onClick={() => setLocalTab(l)}
            className={cn(
              'px-3 py-1 rounded-full text-sm font-mono transition-colors',
              localTab === l ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'
            )}
          >
            {l}
          </button>
        ))}
      </div>

      {localTab === 'ALL'
        ? <AllLocalsView analysis={analysis} locals={locals} months={months} year={activeYear} quarter={quarter} />
        : <SingleLocalView cells={analysis.byLocal[localTab] ?? []} months={months} local={localTab} year={activeYear} quarter={quarter} />
      }

      {/* Legenda */}
      <Card>
        <CardContent className="pt-4 pb-4 text-xs text-muted-foreground leading-relaxed space-y-1.5">
          <div className="flex items-start gap-2">
            <Info className="w-3.5 h-3.5 mt-0.5 text-accent shrink-0" />
            <div>
              <b className="text-foreground">Split mensile automatico:</b> una prenotazione a cavallo
              di due mesi ha le notti contate separatamente (es. 29 gen → 3 feb = 3 notti gennaio + 2 febbraio).
            </div>
          </div>
          <div className="pl-5">
            <b className="text-emerald-700">Paganti OTA</b>: adulti non residenti Milano, prenotazioni tramite Booking, Expedia o dirette.
          </div>
          <div className="pl-5">
            <b className="text-rose-700">Airbnb</b>: adulti non residenti Milano via Airbnb. La tassa la versa Airbnb al comune.
          </div>
          <div className="pl-5">
            <b className="text-sky-700">Minori</b>: età &lt; 18 al check-in. Esenti.
          </div>
          <div className="pl-5">
            <b className="text-purple-700">Residenti Milano</b>: città di residenza = Milano. Esenti.
          </div>
          <div className="pl-5">
            <b className="text-foreground">Importo dovuto</b> = pernotti "Paganti OTA" × {eur(budget.tassa_soggiorno_pp)}/notte.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Header() {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground">Fiscale</div>
      <h1 className="display text-3xl lg:text-4xl mt-2">Tasse di soggiorno</h1>
      <p className="text-sm text-muted-foreground mt-1">
        Conteggio per trimestre e per categoria fiscale.
      </p>
    </div>
  );
}

// ========== VISTA TUTTE LE CASE (aggregato) ==========
function AllLocalsView({
  analysis, locals, months, year, quarter,
}: {
  analysis: ReturnType<typeof buildTaxMonthly>;
  locals: string[];
  months: number[];
  year: number;
  quarter: number;
}) {
  // Aggrega per mese su tutte le case
  const aggregated = months.map((m) => {
    const agg: TaxMonthCell = {
      year, month: m, month_key: `${year}-${String(m).padStart(2, '0')}`,
      local: 'TOTALE',
      byCategory: {
        paganti_ota: { guests: 0, pernotti: 0 },
        airbnb: { guests: 0, pernotti: 0 },
        minori: { guests: 0, pernotti: 0 },
        residenti_milano: { guests: 0, pernotti: 0 },
      },
      importo_dovuto: 0,
    };
    for (const l of locals) {
      const cell = analysis.byLocal[l]?.[m - 1];
      if (!cell) continue;
      (['paganti_ota', 'airbnb', 'minori', 'residenti_milano'] as TaxCategory[]).forEach((cat) => {
        agg.byCategory[cat].guests += cell.byCategory[cat].guests;
        agg.byCategory[cat].pernotti += cell.byCategory[cat].pernotti;
      });
      agg.importo_dovuto += cell.importo_dovuto;
    }
    return agg;
  });

  // Totale trimestre (solo mesi del Q)
  const quarterTot = sumCells(aggregated, year);

  return (
    <div className="space-y-4">
      <KPIStrip cell={quarterTot} label={`Totale Q${quarter} ${year}`} />
      <QuarterTable cells={aggregated} months={months} />
    </div>
  );
}

// ========== VISTA SINGOLA CASA ==========
function SingleLocalView({
  cells, months, local, year, quarter,
}: {
  cells: TaxMonthCell[];
  months: number[];
  local: string;
  year: number;
  quarter: number;
}) {
  const filtered = months.map((m) => cells[m - 1]).filter(Boolean);
  const quarterTot = sumCells(filtered, year);

  return (
    <div className="space-y-4">
      <KPIStrip cell={quarterTot} label={`${local} · Q${quarter} ${year}`} />
      <QuarterTable cells={filtered} months={months} />
    </div>
  );
}

// ========== COMPONENTI SHARED ==========
function KPIStrip({ cell, label }: { cell: TaxMonthCell; label: string }) {
  return (
    <div className="space-y-2">
      <div className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground">{label}</div>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Stat label="Importo dovuto" value={eur(cell.importo_dovuto)} accent hint="Da versare al comune" />
        <CategoryStat cat="paganti_ota" cell={cell.byCategory.paganti_ota} />
        <CategoryStat cat="airbnb" cell={cell.byCategory.airbnb} />
        <CategoryStat cat="minori" cell={cell.byCategory.minori} />
        <CategoryStat cat="residenti_milano" cell={cell.byCategory.residenti_milano} />
      </div>
    </div>
  );
}

function CategoryStat({ cat, cell }: { cat: TaxCategory; cell: { guests: number; pernotti: number } }) {
  const info = CAT_LABELS[cat];
  return (
    <div className="rounded-lg border border-border/70 px-4 py-3 bg-card">
      <div className={cn("text-[10px] uppercase tracking-[0.1em] font-medium", info.color)}>
        {info.short}
      </div>
      <div className="display text-2xl mt-1 tabular leading-none">
        {num(cell.guests)} <span className="text-sm text-muted-foreground font-normal">ospiti</span>
      </div>
      <div className="text-xs text-muted-foreground mt-1.5 num">
        {num(cell.pernotti)} pernotti
      </div>
    </div>
  );
}

function QuarterTable({ cells, months }: { cells: TaxMonthCell[]; months: number[] }) {
  const tot = sumCells(cells, cells[0]?.year ?? 0);

  return (
    <Card>
      <CardContent className="p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left">
              <th rowSpan={2} className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground px-4 py-3 font-medium align-bottom">Mese</th>
              {(['paganti_ota', 'airbnb', 'minori', 'residenti_milano'] as TaxCategory[]).map((cat) => (
                <th key={cat} colSpan={2} className={cn(
                  "text-[10px] uppercase tracking-[0.1em] px-3 py-2 font-medium text-center border-l border-border/60",
                  CAT_LABELS[cat].color
                )}>
                  {CAT_LABELS[cat].short}
                </th>
              ))}
              <th rowSpan={2} className="text-[10px] uppercase tracking-[0.1em] text-accent px-4 py-3 font-medium text-right align-bottom border-l border-border/60">
                Importo dovuto
              </th>
            </tr>
            <tr className="text-[9px] text-muted-foreground">
              {(['paganti_ota', 'airbnb', 'minori', 'residenti_milano'] as TaxCategory[]).map((cat) => (
                <React.Fragment key={cat}>
                  <th className="px-2 py-1.5 text-right font-normal border-l border-border/40 border-t-0">ospiti</th>
                  <th className="px-2 py-1.5 text-right font-normal">pernotti</th>
                </React.Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {months.map((m, idx) => {
              const c = cells[idx];
              if (!c) return null;
              const isEmpty = Object.values(c.byCategory).every((x) => x.pernotti === 0);
              return (
                <tr key={m} className={cn('row-hover border-t border-border/50', isEmpty && 'opacity-50')}>
                  <td className="px-4 py-2.5 text-sm capitalize font-medium">{MESI_IT[m - 1]}</td>
                  {(['paganti_ota', 'airbnb', 'minori', 'residenti_milano'] as TaxCategory[]).map((cat) => (
                    <React.Fragment key={cat}>
                      <td className="px-2 py-2.5 text-right num border-l border-border/40 text-foreground/80">
                        {c.byCategory[cat].guests || '—'}
                      </td>
                      <td className="px-2 py-2.5 text-right num text-foreground/80">
                        {c.byCategory[cat].pernotti || '—'}
                      </td>
                    </React.Fragment>
                  ))}
                  <td className="px-4 py-2.5 text-right num font-medium border-l border-border/60">{eur(c.importo_dovuto)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border bg-muted/40">
              <td className="px-4 py-3 text-sm font-semibold">Totale Q</td>
              {(['paganti_ota', 'airbnb', 'minori', 'residenti_milano'] as TaxCategory[]).map((cat) => (
                <React.Fragment key={cat}>
                  <td className="px-2 py-3 text-right num font-semibold border-l border-border/40">
                    {num(tot.byCategory[cat].guests)}
                  </td>
                  <td className="px-2 py-3 text-right num font-semibold">
                    {num(tot.byCategory[cat].pernotti)}
                  </td>
                </React.Fragment>
              ))}
              <td className="px-4 py-3 text-right num font-bold text-accent text-lg border-l border-border/60">
                {eur(tot.importo_dovuto)}
              </td>
            </tr>
          </tfoot>
        </table>
      </CardContent>
    </Card>
  );
}

function sumCells(cells: TaxMonthCell[], year: number): TaxMonthCell {
  const tot: TaxMonthCell = {
    year, month: 0, month_key: '',
    local: 'TOT',
    byCategory: {
      paganti_ota: { guests: 0, pernotti: 0 },
      airbnb: { guests: 0, pernotti: 0 },
      minori: { guests: 0, pernotti: 0 },
      residenti_milano: { guests: 0, pernotti: 0 },
    },
    importo_dovuto: 0,
  };
  for (const c of cells) {
    (['paganti_ota', 'airbnb', 'minori', 'residenti_milano'] as TaxCategory[]).forEach((cat) => {
      tot.byCategory[cat].guests += c.byCategory[cat].guests;
      tot.byCategory[cat].pernotti += c.byCategory[cat].pernotti;
    });
    tot.importo_dovuto += c.importo_dovuto;
  }
  return tot;
}
