import * as React from 'react';
import { useData } from '@/hooks/useData';
import { Card, CardContent, CardHeader, CardTitle, Stat, Empty } from '@/components/ui/primitives';
import { eur, num, cn } from '@/lib/utils';
import { buildBudgetMonthly, sumBudget } from '@/lib/calculations';
import { getVisibleLocals, getVisibleYears } from '@/lib/visibility';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

export function BudgetPage() {
  const { reservations, reservationsAll, budget, activeYear, setYear, visibility } = useData();
  const locals = React.useMemo(() => getVisibleLocals(reservationsAll, visibility), [reservationsAll, visibility]);
  const analysis = React.useMemo(
    () => buildBudgetMonthly(reservations, activeYear, budget, locals),
    [reservations, activeYear, budget, locals]
  );

  const years = React.useMemo(() => {
    const v = getVisibleYears(reservationsAll, visibility);
    return v.length > 0 ? v : [activeYear];
  }, [reservationsAll, visibility, activeYear]);

  if (reservations.length === 0) {
    return <Empty title="Budget non disponibile" description="Serve almeno un CSV Vikey caricato." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground">Budget</div>
          <h1 className="display text-3xl lg:text-4xl mt-2">Analisi mensile {activeYear}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Calcolato su commissioni {Math.round(budget.commissioni * 100)}%,
            tassa di soggiorno €{budget.tassa_soggiorno_pp}/pp/notte.
          </p>
        </div>
        <div className="flex gap-1">
          {years.map((y) => (
            <button
              key={y}
              onClick={() => setYear(y)}
              className={cn(
                'px-3 py-1.5 rounded-md text-sm num',
                y === activeYear ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'
              )}
            >
              {y}
            </button>
          ))}
        </div>
      </div>

      {/* Totale overview */}
      {(() => {
        const tot = sumBudget(analysis.totals);
        return (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Profitto netto" value={eur(tot.profitto_netto)} accent />
            <Stat label="Lordo" value={eur(tot.lordo)} />
            <Stat label="Costi totali" value={eur(tot.commissioni + tot.tassa_soggiorno + tot.cedolare_secca + tot.pulizie + tot.costi_fissi)} />
            <Stat label="Pernotti" value={num(tot.pernotti)} hint={`${num(tot.numero_soggiorni)} soggiorni`} />
          </div>
        );
      })()}

      <Tabs defaultValue="totale">
        <TabsList className="flex-wrap">
          <TabsTrigger value="totale">Totale</TabsTrigger>
          {locals.map((l) => (
            <TabsTrigger key={l} value={l}>{l}</TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="totale">
          <MonthlyTable rows={analysis.totals} title="Tutti gli appartamenti" />
        </TabsContent>

        {locals.map((l) => (
          <TabsContent key={l} value={l}>
            <MonthlyTable rows={analysis.byLocal[l] ?? []} title={l} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function MonthlyTable({ rows, title }: { rows: any[]; title: string }) {
  const tot = sumBudget(rows);
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="display text-xl">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
              <th className="px-4 py-3 font-medium">Mese</th>
              <th className="px-3 py-3 text-right font-medium">N° Sogg.</th>
              <th className="px-3 py-3 text-right font-medium">Pernotti</th>
              <th className="px-3 py-3 text-right font-medium">Lordo</th>
              <th className="px-3 py-3 text-right font-medium">Commiss.</th>
              <th className="px-3 py-3 text-right font-medium">Tassa sogg.</th>
              <th className="px-3 py-3 text-right font-medium">Cedolare</th>
              <th className="px-3 py-3 text-right font-medium">Pulizie</th>
              <th className="px-3 py-3 text-right font-medium">Costi fissi</th>
              <th className="px-3 py-3 text-right font-medium text-accent">Profitto netto</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r: any) => (
              <tr key={r.month_key} className="row-hover border-t border-border/50">
                <td className="px-4 py-2.5 capitalize">{r.mese}</td>
                <td className="px-3 py-2.5 text-right num text-foreground/80">{num(r.numero_soggiorni)}</td>
                <td className="px-3 py-2.5 text-right num text-foreground/80">{num(r.pernotti)}</td>
                <td className="px-3 py-2.5 text-right num">{eur(r.lordo)}</td>
                <td className="px-3 py-2.5 text-right num text-muted-foreground">{eur(r.commissioni)}</td>
                <td className="px-3 py-2.5 text-right num text-muted-foreground">{eur(r.tassa_soggiorno)}</td>
                <td className="px-3 py-2.5 text-right num text-muted-foreground">{eur(r.cedolare_secca)}</td>
                <td className="px-3 py-2.5 text-right num text-muted-foreground">{eur(r.pulizie)}</td>
                <td className="px-3 py-2.5 text-right num text-muted-foreground">{eur(r.costi_fissi)}</td>
                <td className={cn('px-3 py-2.5 text-right num font-medium', r.profitto_netto < 0 && 'text-destructive')}>
                  {eur(r.profitto_netto)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border bg-muted/40 font-semibold">
              <td className="px-4 py-3">Totale</td>
              <td className="px-3 py-3 text-right num">{num(tot.numero_soggiorni)}</td>
              <td className="px-3 py-3 text-right num">{num(tot.pernotti)}</td>
              <td className="px-3 py-3 text-right num">{eur(tot.lordo)}</td>
              <td className="px-3 py-3 text-right num">{eur(tot.commissioni)}</td>
              <td className="px-3 py-3 text-right num">{eur(tot.tassa_soggiorno)}</td>
              <td className="px-3 py-3 text-right num">{eur(tot.cedolare_secca)}</td>
              <td className="px-3 py-3 text-right num">{eur(tot.pulizie)}</td>
              <td className="px-3 py-3 text-right num">{eur(tot.costi_fissi)}</td>
              <td className={cn('px-3 py-3 text-right num font-bold text-lg', tot.profitto_netto < 0 ? 'text-destructive' : 'text-accent')}>
                {eur(tot.profitto_netto)}
              </td>
            </tr>
          </tfoot>
        </table>
      </CardContent>
    </Card>
  );
}
