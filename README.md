# Casa Overview

App nativa iPhone + Mac per gestire appartamenti in short rental via Vikey. Self-contained: niente script Python, niente filesystem esterno, niente OneDrive.



## Setup

```bash
npm install
npm run build
npx cap add ios          # solo prima volta
npx cap sync
npx cap open ios
```

In Xcode: Team signing → Supported Destinations: aggiungi Mac (Mac Catalyst) → ⌘R.

### Test in browser
```bash
npm run dev
```

Al primo avvio non ci sono dati. Vai in Impostazioni per configurare Vikey e scaricare i CSV.

## Flusso utente

### 1. Configura Vikey (una volta)
- Impostazioni → **Credenziali Vikey**: email + password del tuo account Vikey
- Salva

### 2. Richiedi export Vikey
- Impostazioni → **Sync dati Vikey** → pulsante **Richiedi export**
- L'app fa login e chiede a Vikey di inviare 2 email con i CSV

### 3. Scarica i CSV
- Controlla la tua casella mail (il mittente è `alert@mg.vikey.it`)
- Arrivano 2 mail con link a `storage.googleapis.com`
- Copia il link del CSV prenotazioni → incollalo nel primo campo → **Scarica**
- Stessa cosa per il CSV ospiti/burocrazia → secondo campo

### 4. Configura case e anni visibili
- Impostazioni → **Case e anni visibili**: scegli cosa mostrare nell'app
- Di default vengono mostrate tutte le case e tutti gli anni trovati nei CSV

## Pagine

1. **Overview** — KPI da budget, pivot ospiti/pernotti, upcoming/in-progress cliccabili per dettagli, mappa mondo interattiva con cerchi dimensionati sul volume per paese
2. **Cal. Prenotazioni** — vista mensile con colori dinamici per casa, click su prenotazione → dettaglio + note persistenti
3. **Cal. Pulizie** — sessioni auto-generate dai check-out, preferenze per casa, override persistenti legati al `resv_key`, export CSV + stampa
4. **Budget** — proiezioni mensili come da Excel (lordo − commissioni − cedolare − tassa − pulizie − costi fissi)
5. **Prenotazioni** — lista filtrabile con indicatori note, click → dettaglio
6. **Fattura pulizie** — auto-calc mensile + prezzo effettivo + n° fattura + **export PDF multi-casa/multi-mese** per il team pulizie
7. **Tasse soggiorno** — conteggio per trimestre e categoria fiscale (Paganti OTA / Airbnb / Minori / Residenti Milano) con ospiti+pernotti
8. **Impostazioni** — Sync Vikey, credenziali, case e anni visibili, parametri budget

## Architettura tecnica

- **React 18 + Vite + TypeScript + Tailwind + shadcn-style primitives**
- **Capacitor 6**: iOS + Mac Catalyst, `@capacitor/preferences` per Keychain
- **Papaparse** per CSV
- **d3-geo + topojson-client + world-atlas** per la mappa mondo reale
- **jspdf + jspdf-autotable** per l'export PDF (lazy-loaded, chunk separato)
- Tutto offline-first: dati in cache locale Preferences, ricalcolo automatico in memoria

### Case e anni dinamici

L'app scopre le case (`local_name`) e gli anni dai CSV automaticamente. Non c'è più l'elenco hardcoded C3A/VV14/DA23 — qualunque codice casa viene riconosciuto. I filtri si popolano dal data, e da Impostazioni si sceglie cosa mostrare.

### Persistenza

Tutto in `@capacitor/preferences` (iOS Keychain / macOS secure storage):

| Chiave | Contenuto |
|---|---|
| `co.credentials.v1` | Email + password Vikey |
| `co.visibility.v1` | Case e anni visibili/nascosti |
| `co.budget.{year}.v1` | Parametri annuali |
| `co.cost_components.v1` | KM/KS/CI/KB/CP/VVP/DAP |
| `co.clean.prefs.v1` | Orari pulizia per casa |
| `co.clean.overrides.v1` | Modifiche sessioni per `resv_key` |
| `co.resv.notes.v1` | Note prenotazione per `resv_key` |
| `co.fattura.v1` | Prezzi effettivi + n° fattura |
| `co.csv.cache.v1` | CSV prenotazioni in cache |
| `co.buro.cache.v1` | CSV ospiti in cache |

Tutte le modifiche utente sono legate a `resv_key` (univoco Vikey): sopravvivono ai refresh del CSV. Le prenotazioni cancellate restano nei dati locali ma non vengono più visualizzate.

### Formule preservate

```
lordo               = price / (1 − commissioni)
netto_piattaforma   = lordo − commissioni·lordo
cedolare_secca      = netto_piattaforma · cedolare[local]
profitto_netto      = netto_piattaforma − cedolare − tassa_soggiorno
                      − pulizie[local]·N_soggiorni − costi_fissi[local]

Costo stay (per fattura pulizie):
  C3A  = 4·KM + 6·CI + n·KB + CP
  VV14 = VVP + 4·CI + n·KB + KM  (+ KS secondo n)
  DA23 = DAP + 4·CI + n·KB + KM·{1,2,3}
```

Per case custom diverse da C3A/VV14/DA23, il costo stay restituisce 0: se hai altre proprietà e vuoi un calcolo automatico, aggiungi le formule in `src/lib/storage.ts::computeStayCost()`.

## Tasse di soggiorno

4 categorie, calcolate dal CSV ospiti (`buro.csv`):

- **Paganti OTA** (emerald): adulti non residenti Milano, via Booking/Expedia/dirette → **pagano a te**
- **Airbnb** (rose): adulti via Airbnb → Airbnb versa direttamente al comune, non a te
- **Minori** (sky): età < 18 al check-in → esenti
- **Residenti Milano** (purple): residenza = Milano → esenti

**Split mensile automatico**: una prenotazione 29 gen → 3 feb conta 3 notti a gennaio e 2 a febbraio. La selezione del trimestre mostra solo i mesi relativi (Q1 = gen/feb/mar, ecc.).

**Senza buro.csv** l'app non può distinguere minori/residenti Milano — gli ospiti vengono classificati solo in Paganti OTA o Airbnb in base al canale. Scarica il CSV burocrazia da Impostazioni per il dettaglio completo.

## Troubleshooting

**Il login Vikey fallisce**: verifica email/password in Impostazioni. L'API usa `https://api.vikey.it/api/v3/auth/login`.

**Le mail non arrivano**: Vikey a volte impiega qualche minuto. Controlla anche lo spam. Mittente: `alert@mg.vikey.it`.

**Il link dalla mail non scarica**: i link GCS scadono dopo 7 giorni. Richiedi un nuovo export.

**La mappa mondiale non si carica**: il topojson viene caricato da `cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json`. Richiede internet al primo avvio; poi la mappa è cached dal browser/webview.

**Una casa non appare**: verifica in Impostazioni → Case e anni visibili che sia abilitata. Di default tutte le case trovate nei dati sono visibili.
