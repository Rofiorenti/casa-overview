import * as React from 'react';
import { DataProvider } from '@/hooks/useData';
import { Layout, type PageKey } from '@/components/Layout';
import { DashboardPage } from '@/pages/Dashboard';
import { CalendarioPrenotazioniPage } from '@/pages/CalendarioPrenotazioni';
import { PulizePage } from '@/pages/Pulizie';
import { BudgetPage } from '@/pages/Budget';
import { PrenotazioniPage } from '@/pages/Prenotazioni';
import { FatturaPulizieePage } from '@/pages/FatturaPulizie';
import { TasseSoggiornoPage } from '@/pages/TasseSoggiorno';
import { SettingsPage } from '@/pages/Settings';

export default function App() {
  const [page, setPage] = React.useState<PageKey>('dashboard');

  return (
    <DataProvider>
      <Layout page={page} onPageChange={setPage}>
        {page === 'dashboard' && <DashboardPage />}
        {page === 'calendario-prenotazioni' && <CalendarioPrenotazioniPage />}
        {page === 'calendario-pulizie' && <PulizePage />}
        {page === 'budget' && <BudgetPage />}
        {page === 'prenotazioni' && <PrenotazioniPage />}
        {page === 'fattura' && <FatturaPulizieePage />}
        {page === 'tasse' && <TasseSoggiornoPage />}
        {page === 'settings' && <SettingsPage />}
      </Layout>
    </DataProvider>
  );
}
