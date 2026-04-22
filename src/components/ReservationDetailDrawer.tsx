import * as React from 'react';
import { useData } from '@/hooks/useData';
import { Badge } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { eur, formatDate } from '@/lib/utils';
import type { Reservation } from '@/lib/types';
import { X, Save } from 'lucide-react';

export function ReservationDetailDrawer({ r, onClose }: { r: Reservation; onClose: () => void }) {
  const { getNote, saveResvNote } = useData();
  const [note, setNote] = React.useState<string>(() => getNote(r.resv_key));
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await saveResvNote(r.resv_key, note);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
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
            <Badge variant="outline" className="font-mono">{r.local_name}</Badge>
            <h3 className="display text-2xl mt-2">{r.name || '—'}</h3>
            <div className="text-xs text-muted-foreground mt-1 font-mono">{r.resv_key}</div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-2.5 text-sm border-t border-b border-border/60 py-4">
          <DetailRow label="Check-in" value={formatDate(r.date_from, { day: '2-digit', month: 'long', year: 'numeric' })} />
          <DetailRow label="Check-out" value={formatDate(r.date_to, { day: '2-digit', month: 'long', year: 'numeric' })} />
          <DetailRow label="Notti" value={`${r.nightnum}`} />
          <DetailRow label="Ospiti" value={`${r.guests_num}`} />
          <DetailRow label="Canale" value={r.channel} />
          <DetailRow label="Paese" value={r.nationality ?? '—'} />
          {r.guest_phone && <DetailRow label="Telefono" value={r.guest_phone} />}
          {r.guest_email && <DetailRow label="Email" value={r.guest_email} />}
          <DetailRow label="Stato" value={<Badge variant="muted">{r.checkin_status ?? '—'}</Badge>} />
        </div>

        <div className="py-4 space-y-2.5 text-sm border-b border-border/60">
          <DetailRow label="Prezzo lordo" value={<span className="num">{eur(r.lordo)}</span>} />
          <DetailRow label="Prezzo netto" value={<span className="num">{eur(r.netto)}</span>} />
          <DetailRow label="Pulizie" value={<span className="num">{eur(r.pulizie_costo)}</span>} />
          <DetailRow label="Profitto" value={<span className="num text-accent font-medium">{eur(r.profit)}</span>} />
          <DetailRow label="Tassa di soggiorno" value={<span className="num">{eur(r.tassa_soggiorno)}</span>} />
        </div>

        <div className="pt-4 space-y-2">
          <label className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground font-medium">Note</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={5}
            placeholder="Appunti, preferenze ospite, istruzioni speciali… (persistenti)"
            className="w-full rounded-md border border-input bg-background/60 px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 resize-y min-h-[120px]"
          />
          <div className="flex justify-end gap-2">
            {saved && <Badge variant="success">Salvato</Badge>}
            <Button variant="ember" size="sm" onClick={save} disabled={saving}>
              <Save className="w-3.5 h-3.5" />
              {saving ? 'Salvo…' : 'Salva nota'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-xs text-muted-foreground shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-right">{value}</span>
    </div>
  );
}
