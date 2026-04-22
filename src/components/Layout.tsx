import * as React from 'react';
import {
  BarChart3, CalendarRange, CalendarCheck, Receipt, BedDouble, Sparkles, Settings,
  RefreshCw, Home as HomeIcon, CheckCircle2, AlertTriangle, Loader2, Landmark, Menu,
} from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import { useData } from '@/hooks/useData';
import { Button } from '@/components/ui/button';
import { isGmailConnected } from '@/lib/gmailAuth';

export type PageKey =
  | 'dashboard'
  | 'calendario-prenotazioni'
  | 'calendario-pulizie'
  | 'budget'
  | 'prenotazioni'
  | 'fattura'
  | 'tasse'
  | 'settings';

const NAV: { key: PageKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'dashboard', label: 'Overview', icon: BarChart3 },
  { key: 'calendario-prenotazioni', label: 'Cal. Prenotazioni', icon: CalendarRange },
  { key: 'calendario-pulizie', label: 'Cal. Pulizie', icon: CalendarCheck },
  { key: 'budget', label: 'Budget', icon: Receipt },
  { key: 'prenotazioni', label: 'Prenotazioni', icon: BedDouble },
  { key: 'fattura', label: 'Fattura pulizie', icon: Sparkles },
  { key: 'tasse', label: 'Tasse soggiorno', icon: Landmark },
  { key: 'settings', label: 'Impostazioni', icon: Settings },
];

export function Layout({
  page, onPageChange, children,
}: {
  page: PageKey;
  onPageChange: (p: PageKey) => void;
  children: React.ReactNode;
}) {
  const { lastSync, loading, refresh, syncStatus, syncMessage, triggerSync, fullSync } = useData();
  const [gmailReady, setGmailReady] = React.useState(false);
  React.useEffect(() => { isGmailConnected().then(setGmailReady); }, [syncStatus]);
  const smartSync = React.useCallback(() => {
    if (gmailReady) fullSync();
    else triggerSync();
  }, [gmailReady, fullSync, triggerSync]);

  return (
    <div className="h-full w-full flex flex-col lg:flex-row bg-background">
      {/* Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 border-r border-border/70 bg-card/40 safe-top">
        <div className="px-5 py-6">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md bg-accent/15 text-accent grid place-items-center">
              <HomeIcon className="w-4 h-4" />
            </div>
            <div>
              <div className="display text-lg leading-none">Casa Overview</div>
              <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground mt-1">
                Gestione proprietà
              </div>
            </div>
          </div>
        </div>
        <nav className="flex-1 px-3 pb-3 overflow-y-auto">
          {NAV.map((n) => {
            const active = page === n.key;
            const Icon = n.icon;
            return (
              <button
                key={n.key}
                onClick={() => onPageChange(n.key)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-all text-left',
                  active
                    ? 'bg-accent/10 text-accent font-medium'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                )}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {n.label}
              </button>
            );
          })}
        </nav>
        {/* Sync status */}
        <div className="p-3 border-t border-border/70 space-y-2">
          <div className="flex items-center gap-2">
            <SyncIcon status={syncStatus} loading={loading} />
            <div className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
              {syncStatus === 'syncing' ? 'Sincronizzo…' : 'Ultimo aggiornamento'}
            </div>
          </div>
          <div className="text-xs num px-1 text-foreground/80">
            {lastSync ? formatDate(lastSync, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
          </div>
          {syncMessage && (
            <div className={cn(
              'text-[10px] leading-snug px-1',
              syncStatus === 'error' ? 'text-destructive' : 'text-muted-foreground'
            )}>
              {syncMessage}
            </div>
          )}
          <div className="flex gap-1">
            <Button variant="outline" size="sm" className="flex-1" onClick={refresh} disabled={loading}>
              <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
              Ricarica
            </Button>
            <Button variant="ghost" size="sm" className="flex-1" onClick={smartSync} disabled={syncStatus === 'syncing'}>
              Sync Vikey
            </Button>
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="lg:hidden flex items-center justify-between px-4 pb-3 safe-top border-b border-border/70 bg-card/40">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-accent/15 text-accent grid place-items-center">
            <HomeIcon className="w-4 h-4" />
          </div>
          <span className="display text-lg">{NAV.find((n) => n.key === page)?.label}</span>
        </div>
        <div className="flex items-center gap-1">
          <SyncIcon status={syncStatus} loading={loading} />
          <Button variant="ghost" size="icon" onClick={refresh} disabled={loading}>
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          </Button>
        </div>
      </header>

      {/* Main */}
      <main
        className="flex-1 overflow-y-auto lg:pb-0"
        style={{ paddingBottom: 'calc(40px + env(safe-area-inset-bottom))' }}
      >
        <div className="max-w-[1400px] mx-auto w-full px-4 lg:px-8 py-6 lg:py-10">
          {children}
        </div>
      </main>

      {/* Mobile menu button + dropdown */}
      <MobileMenuDropdown page={page} onPageChange={onPageChange} />
    </div>
  );
}

function MobileMenuDropdown({ page, onPageChange }: { page: PageKey; onPageChange: (p: PageKey) => void }) {
  const [menuOpen, setMenuOpen] = React.useState(false);

  return (
    <div className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-card/95 backdrop-blur border-t border-border/70">
      {/* Collapse handle */}
      <button
        type="button"
        onClick={() => setMenuOpen(!menuOpen)}
        className="w-full h-10 flex items-center justify-center transition-colors hover:bg-card active:bg-muted"
        aria-label="Apri menu"
      >
        <Menu className="w-6 h-6 text-foreground pointer-events-none" />
      </button>
      {/* Safe area spacer */}
      <div style={{ height: 'env(safe-area-inset-bottom)' }}></div>

      {/* Dropdown menu */}
      {menuOpen && (
        <div
          className="absolute inset-x-0 bg-card/95 backdrop-blur border-t border-border/70 max-h-96 overflow-y-auto"
          style={{ bottom: 'calc(40px + env(safe-area-inset-bottom))' }}
        >
          <div className="grid grid-cols-2 gap-1 p-3">
            {NAV.map((n) => {
              const Icon = n.icon;
              const active = page === n.key;
              return (
                <button
                  key={n.key}
                  onClick={() => {
                    onPageChange(n.key);
                    setMenuOpen(false);
                  }}
                  className={cn(
                    'flex flex-col items-center justify-center gap-1.5 px-3 py-3 rounded-lg text-[11px] transition-colors',
                    active
                      ? 'bg-accent/15 text-accent font-medium'
                      : 'text-muted-foreground hover:bg-muted'
                  )}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-center line-clamp-2">{n.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function SyncIcon({ status, loading }: { status: string; loading: boolean }) {
  if (loading || status === 'syncing') return <Loader2 className="w-3.5 h-3.5 animate-spin text-accent" />;
  if (status === 'ok') return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />;
  if (status === 'error') return <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />;
  return <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40" />;
}
