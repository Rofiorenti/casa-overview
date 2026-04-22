import * as React from 'react';
import { useData } from '@/hooks/useData';
import { Card, CardContent, CardHeader, CardTitle, Stat, Badge, Empty, Select } from '@/components/ui/primitives';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { buildDashboardPivot, buildBudgetMonthly, buildCountryAnalysis, buildUpcomingBuckets, sumBudget } from '@/lib/calculations';
import { eur, num, formatDate, cn } from '@/lib/utils';
import { MESI_IT, COUNTRY_CENTROIDS, type Reservation } from '@/lib/types';
import { getVisibleLocals, getVisibleYears } from '@/lib/visibility';
import { TrendingUp, Users, Calendar, Globe2 } from 'lucide-react';
import { ReservationDetailDrawer } from '@/components/ReservationDetailDrawer';
import { WorldMap } from '@/components/WorldMap';

export function DashboardPage() {
  const { reservations, reservationsAll, budget, activeYear, setYear, visibility } = useData();
  const locals = React.useMemo(() => getVisibleLocals(reservationsAll, visibility), [reservationsAll, visibility]);
  const years = React.useMemo(() => {
    const v = getVisibleYears(reservationsAll, visibility);
    return v.length > 0 ? v : [new Date().getFullYear()];
  }, [reservationsAll, visibility]);

  const pivot = React.useMemo(() => buildDashboardPivot(reservations), [reservations]);
  const budgetAnalysis = React.useMemo(
    () => buildBudgetMonthly(reservations, activeYear, budget, locals),
    [reservations, activeYear, budget, locals]
  );
  const buckets = React.useMemo(() => buildUpcomingBuckets(reservations), [reservations]);
  const totals = React.useMemo(() => sumBudget(budgetAnalysis.totals), [budgetAnalysis]);

  const [selected, setSelected] = React.useState<Reservation | null>(null);

  if (reservations.length === 0) {
    return (
      <div className="space-y-8">
        <Header />
        <Empty
          title="Nessun dato"
          description="Vai in Impostazioni per scaricare i CSV da Vikey o importarli manualmente."
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <Header />

      {/* Year selector */}
      <div className="flex flex-wrap items-center gap-2">
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

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Stat label="Profitto netto" value={eur(totals.profitto_netto)} hint={`Come da Budget ${activeYear}`} accent />
        <Stat label="Lordo" value={eur(totals.lordo)} />
        <Stat label="Soggiorni" value={num(totals.numero_soggiorni)} />
        <Stat label="Pernotti" value={num(totals.pernotti)} />
        <Stat label="Costi totali" value={eur(totals.commissioni + totals.tassa_soggiorno + totals.cedolare_secca + totals.pulizie + totals.costi_fissi)} />
      </div>

      {/* Upcoming + in progress */}
      <UpcomingSection buckets={buckets} onClick={setSelected} />

      {/* Pivot */}
      <Tabs defaultValue="guests">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <TabsList>
            <TabsTrigger value="guests">Ospiti / Pernotti</TabsTrigger>
            <TabsTrigger value="profit">Profitto mensile</TabsTrigger>
          </TabsList>
          <div className="text-xs text-muted-foreground">
            <TrendingUp className="inline w-3.5 h-3.5 mr-1" /> anno {activeYear}
          </div>
        </div>

        <TabsContent value="guests">
          <PivotGuestsTable pivot={pivot} year={activeYear} locals={locals} />
        </TabsContent>
        <TabsContent value="profit">
          <ProfitTable rows={budgetAnalysis.totals} />
        </TabsContent>
      </Tabs>

      {/* Per-casa */}
      <div className={cn('grid gap-4', locals.length <= 3 ? 'md:grid-cols-3' : 'md:grid-cols-2 lg:grid-cols-4')}>
        {locals.map((l) => {
          const rows = budgetAnalysis.byLocal[l] ?? [];
          const t = sumBudget(rows);
          return (
            <Card key={l}>
              <CardHeader className="flex-row items-start justify-between">
                <div>
                  <CardTitle className="display text-xl">{l}</CardTitle>
                  <div className="text-xs text-muted-foreground mt-1">Anno {activeYear}</div>
                </div>
                <Badge variant={t.profitto_netto >= 0 ? 'ember' : 'warning'}>
                  {t.profitto_netto >= 0 ? 'in utile' : 'in perdita'}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-1.5">
                <Row label="Profitto netto" value={eur(t.profitto_netto)} strong />
                <Row label="Lordo" value={eur(t.lordo)} />
                <Row label="Soggiorni" value={num(t.numero_soggiorni)} />
                <Row label="Pernotti" value={num(t.pernotti)} />
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Map */}
      <CountriesMapSection reservations={reservations} locals={locals} />

      {selected && <ReservationDetailDrawer r={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function Header() {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground">Overview</div>
      <h1 className="display text-4xl lg:text-5xl leading-tight mt-2">
        Le tue proprietà,<br />
        <span className="text-accent">in una vista.</span>
      </h1>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: React.ReactNode; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1 hairline">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn('num text-sm', strong && 'display text-lg')}>{value}</span>
    </div>
  );
}

// ------------- UPCOMING -------------
function UpcomingSection({
  buckets, onClick,
}: {
  buckets: ReturnType<typeof buildUpcomingBuckets>;
  onClick: (r: Reservation) => void;
}) {
  if (buckets.inProgress.length === 0 && buckets.upcoming.length === 0) return null;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-accent" />
            <CardTitle>In corso</CardTitle>
            <Badge variant="ember">{buckets.inProgress.length}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-2 pb-4">
          {buckets.inProgress.length === 0 ? (
            <div className="text-sm text-muted-foreground">Nessun ospite al momento.</div>
          ) : buckets.inProgress.map((r) => (
            <ReservationRow key={r.resv_key} r={r} mode="current" onClick={() => onClick(r)} />
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-accent" />
            <CardTitle>Prossime (30 gg)</CardTitle>
            <Badge variant="muted">{buckets.upcoming.length}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-2 pb-4">
          {buckets.upcoming.length === 0 ? (
            <div className="text-sm text-muted-foreground">Niente in arrivo nei prossimi 30 giorni.</div>
          ) : buckets.upcoming.slice(0, 10).map((r) => (
            <ReservationRow key={r.resv_key} r={r} mode="upcoming" onClick={() => onClick(r)} />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function ReservationRow({ r, mode, onClick }: { r: Reservation; mode: 'current' | 'upcoming'; onClick: () => void }) {
  const daysUntil = mode === 'upcoming'
    ? Math.ceil((new Date(r.date_from).getTime() - Date.now()) / 86400000)
    : Math.ceil((new Date(r.date_to).getTime() - Date.now()) / 86400000);
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 py-1.5 hairline text-left hover:bg-muted/40 rounded-md px-2 -mx-2 transition-colors"
    >
      <Badge variant="outline" className="font-mono shrink-0">{r.local_name}</Badge>
      <div className="flex-1 min-w-0">
        <div className="text-sm truncate">{r.name || '—'}</div>
        <div className="text-[11px] text-muted-foreground num">
          {formatDate(r.date_from, { day: '2-digit', month: 'short' })}
          {' → '}
          {formatDate(r.date_to, { day: '2-digit', month: 'short' })}
          {' · '}
          {r.guests_num}p · {r.nightnum}n
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className={cn('text-xs num font-medium', mode === 'current' && 'text-accent')}>
          {mode === 'current' ? `check-out in ${daysUntil}g` : `tra ${daysUntil}g`}
        </div>
        <div className="text-[10px] text-muted-foreground">{r.channel}</div>
      </div>
    </button>
  );
}

// ------------- PIVOT GUESTS (dinamico per case) -------------
function PivotGuestsTable({
  pivot, year, locals,
}: {
  pivot: ReturnType<typeof buildDashboardPivot>;
  year: number;
  locals: string[];
}) {
  const keys = pivot.monthKeys.filter((k) => k.startsWith(`${year}-`));
  const visibleLocals = locals.filter((l) => keys.some((k) => pivot.byMonthLocal[k]?.[l]));

  const visibleTotals: Record<string, { g: number; n: number }> = {};
  let grandG = 0;
  let grandN = 0;
  for (const l of visibleLocals) {
    let g = 0, n = 0;
    for (const k of keys) {
      const cell = pivot.byMonthLocal[k]?.[l];
      if (cell) { g += cell.guests; n += cell.pernotti; }
    }
    visibleTotals[l] = { g, n };
    grandG += g;
    grandN += n;
  }

  return (
    <Card>
      <CardContent className="p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left">
              <th className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground px-4 py-3 font-medium">Mese</th>
              {visibleLocals.map((l) => (
                <th key={l} colSpan={2} className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground px-4 py-3 font-medium text-right border-l border-border/60">
                  {l}
                </th>
              ))}
              <th colSpan={2} className="text-[10px] uppercase tracking-[0.1em] text-accent px-4 py-3 font-medium text-right border-l border-border/60">
                Totale
              </th>
            </tr>
            <tr className="text-[10px] text-muted-foreground">
              <th />
              {visibleLocals.flatMap((l) => [
                <th key={`${l}-g`} className="px-2 py-1.5 text-right font-normal border-l border-border/40">ospiti</th>,
                <th key={`${l}-n`} className="px-2 py-1.5 text-right font-normal">pernotti</th>,
              ])}
              <th className="px-2 py-1.5 text-right font-normal border-l border-border/40 text-accent">ospiti</th>
              <th className="px-2 py-1.5 text-right font-normal text-accent">pernotti</th>
            </tr>
          </thead>
          <tbody>
            {keys.map((k) => {
              const [, m] = k.split('-').map(Number);
              let rowG = 0, rowN = 0;
              return (
                <tr key={k} className="row-hover border-t border-border/50">
                  <td className="px-4 py-2.5 text-sm capitalize">{MESI_IT[m - 1]}</td>
                  {visibleLocals.flatMap((l) => {
                    const cell = pivot.byMonthLocal[k]?.[l];
                    rowG += cell?.guests ?? 0;
                    rowN += cell?.pernotti ?? 0;
                    return [
                      <td key={`${l}-g-${k}`} className="px-2 py-2 text-right num border-l border-border/40 text-foreground/80">
                        {cell?.guests ? num(cell.guests) : '—'}
                      </td>,
                      <td key={`${l}-n-${k}`} className="px-2 py-2 text-right num text-foreground/80">
                        {cell?.pernotti ? num(cell.pernotti) : '—'}
                      </td>,
                    ];
                  })}
                  <td className="px-2 py-2 text-right num border-l border-border/40 font-medium">{rowG || '—'}</td>
                  <td className="px-2 py-2 text-right num font-medium">{rowN || '—'}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border bg-muted/40">
              <td className="px-4 py-3 text-sm font-semibold">Totale {year}</td>
              {visibleLocals.flatMap((l) => [
                <td key={`t-${l}-g`} className="px-2 py-3 text-right num border-l border-border/40 font-semibold">
                  {num(visibleTotals[l].g)}
                </td>,
                <td key={`t-${l}-n`} className="px-2 py-3 text-right num font-semibold">
                  {num(visibleTotals[l].n)}
                </td>,
              ])}
              <td className="px-2 py-3 text-right num border-l border-border/40 font-bold text-accent">{num(grandG)}</td>
              <td className="px-2 py-3 text-right num font-bold text-accent">{num(grandN)}</td>
            </tr>
          </tfoot>
        </table>
      </CardContent>
    </Card>
  );
}

// ------------- PROFIT TABLE -------------
function ProfitTable({ rows }: { rows: ReturnType<typeof buildBudgetMonthly>['totals'] }) {
  const tot = sumBudget(rows);
  return (
    <Card>
      <CardContent className="p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
              <th className="px-4 py-3 font-medium">Mese</th>
              <th className="px-4 py-3 text-right font-medium">Soggiorni</th>
              <th className="px-4 py-3 text-right font-medium">Pernotti</th>
              <th className="px-4 py-3 text-right font-medium">Lordo</th>
              <th className="px-4 py-3 text-right font-medium">Costi</th>
              <th className="px-4 py-3 text-right font-medium text-accent">Profitto</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const costi = r.commissioni + r.tassa_soggiorno + r.cedolare_secca + r.pulizie + r.costi_fissi;
              return (
                <tr key={r.month_key} className="row-hover border-t border-border/50">
                  <td className="px-4 py-2.5 text-sm capitalize">{r.mese}</td>
                  <td className="px-4 py-2.5 text-right num text-foreground/80">{num(r.numero_soggiorni)}</td>
                  <td className="px-4 py-2.5 text-right num text-foreground/80">{num(r.pernotti)}</td>
                  <td className="px-4 py-2.5 text-right num">{eur(r.lordo)}</td>
                  <td className="px-4 py-2.5 text-right num text-muted-foreground">{eur(costi)}</td>
                  <td className={cn('px-4 py-2.5 text-right num font-medium', r.profitto_netto < 0 && 'text-destructive')}>
                    {eur(r.profitto_netto)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border bg-muted/40">
              <td className="px-4 py-3 text-sm font-semibold">Totale</td>
              <td className="px-4 py-3 text-right num font-semibold">{num(tot.numero_soggiorni)}</td>
              <td className="px-4 py-3 text-right num font-semibold">{num(tot.pernotti)}</td>
              <td className="px-4 py-3 text-right num font-semibold">{eur(tot.lordo)}</td>
              <td className="px-4 py-3 text-right num font-semibold text-muted-foreground">
                {eur(tot.commissioni + tot.tassa_soggiorno + tot.cedolare_secca + tot.pulizie + tot.costi_fissi)}
              </td>
              <td className={cn('px-4 py-3 text-right font-bold num text-lg', tot.profitto_netto < 0 ? 'text-destructive' : 'text-accent')}>
                {eur(tot.profitto_netto)}
              </td>
            </tr>
          </tfoot>
        </table>
      </CardContent>
    </Card>
  );
}

// ------------- COUNTRIES MAP SECTION -------------
function CountriesMapSection({ reservations, locals }: { reservations: Reservation[]; locals: string[] }) {
  const [filter, setFilter] = React.useState<string>('ALL');
  const filtered = filter === 'ALL' ? reservations : reservations.filter((r) => r.local_name === filter);
  const data = React.useMemo(() => buildCountryAnalysis(filtered), [filtered]);
  const withCoords = data.filter((d) => COUNTRY_CENTROIDS[d.country]);
  const totalLordo = data.reduce((s, r) => s + r.lordo, 0);

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Globe2 className="w-4 h-4 text-accent" />
            <CardTitle className="display text-xl">Paesi di provenienza</CardTitle>
          </div>
          <div className="text-xs text-muted-foreground mt-1 num">
            {data.length} paesi · {eur(totalLordo)} lordo complessivo
          </div>
        </div>
        <Select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="ALL">Tutte le case</option>
          {locals.map((l) => <option key={l} value={l}>{l}</option>)}
        </Select>
      </CardHeader>
      <CardContent className="space-y-5">
        <WorldMap countries={withCoords} />

        <div className="grid gap-1.5 md:grid-cols-2">
          {data.map((d) => {
            const pct = totalLordo > 0 ? (d.lordo / totalLordo) * 100 : 0;
            return (
              <div key={d.country} className="flex items-center gap-3 py-1.5">
                <span className="text-sm flex-1 truncate">{d.country}</span>
                <span className="text-xs text-muted-foreground num">{num(d.count)} pren.</span>
                <span className="text-sm num font-medium w-20 text-right">{eur(d.lordo, { compact: true })}</span>
                <div className="w-20 h-1 bg-muted rounded-full overflow-hidden shrink-0">
                  <div className="h-full bg-accent" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
