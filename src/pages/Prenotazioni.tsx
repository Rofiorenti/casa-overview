import * as React from 'react';
import { useData } from '@/hooks/useData';
import { Card, CardContent, Input, Select, Badge, Empty } from '@/components/ui/primitives';
import { eur, num, formatDate, cn } from '@/lib/utils';
import type { Reservation } from '@/lib/types';
import { getVisibleLocals, getVisibleYears } from '@/lib/visibility';
import { Search, StickyNote } from 'lucide-react';
import { ReservationDetailDrawer } from '@/components/ReservationDetailDrawer';

export function PrenotazioniPage() {
  const { reservations, reservationsAll, activeYear, getNote, visibility } = useData();
  const locals = React.useMemo(() => getVisibleLocals(reservationsAll, visibility), [reservationsAll, visibility]);
  const [selected, setSelected] = React.useState<Reservation | null>(null);
  const [q, setQ] = React.useState('');
  const [local, setLocal] = React.useState<string>('ALL');
  const [channel, setChannel] = React.useState<string>('ALL');
  const [year, setYear] = React.useState<string>(String(activeYear));
  const [onlyWithNotes, setOnlyWithNotes] = React.useState(false);

  const years = React.useMemo(() => {
    const v = getVisibleYears(reservationsAll, visibility);
    return ['ALL', ...v.map(String)];
  }, [reservationsAll, visibility]);

  const channels = React.useMemo(() => {
    const s = new Set<string>();
    reservations.forEach((r) => s.add(r.channel));
    return ['ALL', ...[...s].sort()];
  }, [reservations]);

  const rows = React.useMemo(() => {
    return reservations
      .filter((r) => {
        if (year !== 'ALL' && String(r.year) !== year) return false;
        if (local !== 'ALL' && r.local_name !== local) return false;
        if (channel !== 'ALL' && r.channel !== channel) return false;
        if (onlyWithNotes && !getNote(r.resv_key)) return false;
        if (q) {
          const s = q.toLowerCase();
          const hit =
            r.name?.toLowerCase().includes(s) ||
            r.resv_key.toLowerCase().includes(s) ||
            r.nationality?.toLowerCase().includes(s);
          if (!hit) return false;
        }
        return true;
      })
      .sort((a, b) => b.date_from.localeCompare(a.date_from));
  }, [reservations, q, local, channel, year, onlyWithNotes, getNote]);

  const tot = {
    count: rows.length,
    lordo: rows.reduce((s, r) => s + (r.lordo ?? 0), 0),
    profit: rows.reduce((s, r) => s + (r.profit ?? 0), 0),
    nights: rows.reduce((s, r) => s + (r.pernotti ?? 0), 0),
  };

  if (reservations.length === 0) {
    return <Empty title="Nessuna prenotazione" description="Importa prima il CSV dalla dashboard." />;
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground">Prenotazioni</div>
        <h1 className="display text-3xl lg:text-4xl mt-2">Archivio completo</h1>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Cerca nome, codice, paese…"
            className="pl-10"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <Select value={year} onChange={(e) => setYear(e.target.value)}>
          {years.map((y) => (
            <option key={y} value={y}>
              {y === 'ALL' ? 'Tutti gli anni' : y}
            </option>
          ))}
        </Select>
        <Select value={local} onChange={(e) => setLocal(e.target.value)}>
          <option value="ALL">Tutte le case</option>
          {locals.map((l) => (
            <option key={l} value={l}>{l}</option>
          ))}
        </Select>
        <Select value={channel} onChange={(e) => setChannel(e.target.value)}>
          {channels.map((c) => (
            <option key={c} value={c}>{c === 'ALL' ? 'Tutti i canali' : c}</option>
          ))}
        </Select>
        <button
          onClick={() => setOnlyWithNotes((v) => !v)}
          className={cn(
            'px-3 py-2 rounded-md text-xs flex items-center gap-1.5 transition-colors shrink-0',
            onlyWithNotes ? 'bg-accent/15 text-accent border border-accent/30' : 'bg-muted text-muted-foreground hover:text-foreground'
          )}
        >
          <StickyNote className="w-3.5 h-3.5" /> Solo con note
        </button>
      </div>

      {/* Summary */}
      <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
        <span><b className="text-foreground num">{num(tot.count)}</b> prenotazioni</span>
        <span>·</span>
        <span><b className="text-foreground num">{num(tot.nights)}</b> pernotti</span>
        <span>·</span>
        <span>lordo <b className="text-foreground num">{eur(tot.lordo)}</b></span>
        <span>·</span>
        <span className="text-accent">profitto <b className="num">{eur(tot.profit)}</b></span>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                <th className="px-4 py-3 font-medium">Casa</th>
                <th className="px-4 py-3 font-medium">Check-in</th>
                <th className="px-4 py-3 font-medium">Notti</th>
                <th className="px-4 py-3 font-medium">Ospite</th>
                <th className="px-4 py-3 font-medium">Paese</th>
                <th className="px-4 py-3 font-medium">Canale</th>
                <th className="px-4 py-3 text-right font-medium">Lordo</th>
                <th className="px-4 py-3 text-right font-medium">Netto</th>
                <th className="px-4 py-3 text-right font-medium text-accent">Profitto</th>
                <th className="px-4 py-3 font-medium w-6"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const note = getNote(r.resv_key);
                return (
                <tr key={r.resv_key} className="row-hover border-t border-border/50 cursor-pointer" onClick={() => setSelected(r)}>
                  <td className="px-4 py-2.5">
                    <Badge variant="outline" className="font-mono">{r.local_name}</Badge>
                  </td>
                  <td className="px-4 py-2.5 num text-foreground/90">{formatDate(r.date_from)}</td>
                  <td className="px-4 py-2.5 num text-foreground/80">{r.nightnum}× {r.guests_num}p</td>
                  <td className="px-4 py-2.5 text-foreground/90 truncate max-w-[180px]">{r.name || '—'}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{r.nationality}</td>
                  <td className="px-4 py-2.5">
                    <Badge variant="muted">{r.channel}</Badge>
                  </td>
                  <td className="px-4 py-2.5 text-right num">{eur(r.lordo)}</td>
                  <td className="px-4 py-2.5 text-right num text-foreground/80">{eur(r.netto)}</td>
                  <td className={cn('px-4 py-2.5 text-right num font-medium', (r.profit ?? 0) < 0 && 'text-destructive')}>
                    {eur(r.profit)}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    {note && <StickyNote className="w-3.5 h-3.5 text-accent inline" />}
                  </td>
                </tr>
              );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground text-center">
        Clicca una riga per vedere i dettagli e aggiungere note.
      </p>
      {selected && <ReservationDetailDrawer r={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
