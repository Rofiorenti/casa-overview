import * as React from 'react';
import { useData } from '@/hooks/useData';
import { Card, CardContent, Empty } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { MESI_IT, type Reservation } from '@/lib/types';
import { getVisibleLocals } from '@/lib/visibility';
import { ReservationDetailDrawer } from '@/components/ReservationDetailDrawer';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const COLOR_PALETTE = [
  { bg: 'bg-amber-100',    border: 'border-amber-400',    text: 'text-amber-950' },
  { bg: 'bg-sky-100',      border: 'border-sky-400',      text: 'text-sky-950' },
  { bg: 'bg-emerald-100',  border: 'border-emerald-400',  text: 'text-emerald-950' },
  { bg: 'bg-rose-100',     border: 'border-rose-400',     text: 'text-rose-950' },
  { bg: 'bg-violet-100',   border: 'border-violet-400',   text: 'text-violet-950' },
  { bg: 'bg-orange-100',   border: 'border-orange-400',   text: 'text-orange-950' },
  { bg: 'bg-teal-100',     border: 'border-teal-400',     text: 'text-teal-950' },
  { bg: 'bg-pink-100',     border: 'border-pink-400',     text: 'text-pink-950' },
];
function colorForLocal(local: string, locals: string[]) {
  const i = locals.indexOf(local);
  return COLOR_PALETTE[(i >= 0 ? i : 0) % COLOR_PALETTE.length];
}

export function CalendarioPrenotazioniPage() {
  const { reservations, reservationsAll, visibility } = useData();
  const locals = React.useMemo(() => getVisibleLocals(reservationsAll, visibility), [reservationsAll, visibility]);
  const [cursor, setCursor] = React.useState(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });
  const [selected, setSelected] = React.useState<Reservation | null>(null);
  const [filterLocal, setFilterLocal] = React.useState<string>('ALL');

  const monthStart = new Date(cursor);
  const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
  const monthStartIso = monthStart.toISOString().slice(0, 10);
  const monthEndIso = monthEnd.toISOString().slice(0, 10);

  const monthReservations = React.useMemo(
    () => reservations.filter((r) => {
      if (filterLocal !== 'ALL' && r.local_name !== filterLocal) return false;
      return r.date_to >= monthStartIso && r.date_from <= monthEndIso;
    }),
    [reservations, filterLocal, monthStartIso, monthEndIso]
  );

  const days = getMonthGrid(cursor);

  if (reservations.length === 0) {
    return <Empty title="Calendario vuoto" description="Nessuna prenotazione caricata." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground">Calendario</div>
          <h1 className="display text-3xl lg:text-4xl mt-2">Prenotazioni</h1>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div className="display text-xl min-w-[180px] text-center capitalize num">
            {MESI_IT[cursor.getMonth()]} {cursor.getFullYear()}
          </div>
          <Button variant="outline" size="icon" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => { const d = new Date(); d.setDate(1); setCursor(d); }}>
            Oggi
          </Button>
        </div>
      </div>

      {/* Filter chips */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setFilterLocal('ALL')}
          className={cn(
            'px-3 py-1 rounded-full text-xs transition-colors',
            filterLocal === 'ALL' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'
          )}
        >
          Tutte
        </button>
        {locals.map((l) => {
          const colors = colorForLocal(l, locals);
          return (
            <button
              key={l}
              onClick={() => setFilterLocal(l)}
              className={cn(
                'px-3 py-1 rounded-full text-xs transition-colors font-mono',
                filterLocal === l ? `${colors.bg} ${colors.text} border ${colors.border}` : 'bg-muted text-muted-foreground hover:text-foreground'
              )}
            >
              {l}
            </button>
          );
        })}
      </div>

      <Card>
        <CardContent className="p-0 overflow-hidden">
          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-border/70 bg-muted/30">
            {['lun', 'mar', 'mer', 'gio', 'ven', 'sab', 'dom'].map((d) => (
              <div key={d} className="px-2 py-2 text-[10px] uppercase tracking-[0.1em] text-muted-foreground text-center font-medium">
                {d}
              </div>
            ))}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7 auto-rows-[minmax(96px,auto)]">
            {days.map((d, i) => {
              const iso = d.toISOString().slice(0, 10);
              const isOtherMonth = d.getMonth() !== cursor.getMonth();
              const isToday = iso === new Date().toISOString().slice(0, 10);
              const dayReservations = monthReservations.filter(
                (r) => r.date_from <= iso && r.date_to >= iso
              );
              return (
                <div
                  key={i}
                  className={cn(
                    'border-r border-b border-border/40 p-1.5 relative',
                    isOtherMonth && 'bg-muted/20',
                    (i + 1) % 7 === 0 && 'border-r-0'
                  )}
                >
                  <div className={cn(
                    'text-[11px] num font-medium mb-1',
                    isOtherMonth && 'text-muted-foreground',
                    isToday && 'inline-flex items-center justify-center w-5 h-5 rounded-full bg-accent text-accent-foreground'
                  )}>
                    {d.getDate()}
                  </div>
                  <div className="space-y-0.5">
                    {dayReservations.slice(0, 3).map((r) => {
                      const isStart = r.date_from === iso;
                      const isEnd = r.date_to === iso;
                      const colors = colorForLocal(r.local_name, locals);
                      return (
                        <button
                          key={r.resv_key}
                          onClick={() => setSelected(r)}
                          className={cn(
                            'w-full text-left text-[10px] px-1.5 py-0.5 border truncate transition-all hover:shadow-sm',
                            colors.bg, colors.border, colors.text,
                            isStart && 'rounded-l-md',
                            isEnd && 'rounded-r-md',
                          )}
                          title={`${r.name} — ${r.local_name}`}
                        >
                          {isStart && <span className="font-semibold mr-1">▸</span>}
                          <span className="font-medium">{r.local_name}</span>
                          {' · '}
                          <span className="truncate">{(r.name || '').split(' ')[0]}</span>
                        </button>
                      );
                    })}
                    {dayReservations.length > 3 && (
                      <div className="text-[9px] text-muted-foreground num">+{dayReservations.length - 3}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {selected && <ReservationDetailDrawer r={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

/** Griglia lunedì→domenica con 6 righe complete */
function getMonthGrid(monthDate: Date): Date[] {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const first = new Date(year, month, 1);
  const dow = (first.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - dow);
  const days: Date[] = [];
  for (let i = 0; i < 42; i++) {
    days.push(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  }
  return days;
}

