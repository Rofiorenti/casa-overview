# Configurazione iOS per OAuth Gmail

Quando aggiungi la piattaforma iOS con Capacitor, devi registrare un URL scheme
custom per ricevere il redirect OAuth da Google.

## File da modificare

`ios/App/App/Info.plist` (creato da `npx cap add ios`)

## Snippet da aggiungere

Aggiungi questo blocco dentro il `<dict>` principale dell'Info.plist, accanto agli altri
`<key>` (per esempio subito dopo `<key>UIViewControllerBasedStatusBarAppearance</key>`):

```xml
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleURLName</key>
    <string>com.fiorentini.casaoverview.oauth</string>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>com.googleusercontent.apps.136409216810-b1gen1d2aggl6ur67jsdchdd1siqs9fo</string>
    </array>
  </dict>
</array>
```

Nota: lo schema `com.googleusercontent.apps.<REVERSO_CLIENT_ID>` è esattamente il
reverso del Client ID iOS (senza `.apps.googleusercontent.com`). Google richiede
questo formato preciso.

## Come applicare

Opzione A — da Xcode:
1. Apri `ios/App/App.xcworkspace`
2. Clicca sul target "App" → tab "Info"
3. Espandi "URL Types"
4. Aggiungi un nuovo item:
   - Identifier: `com.fiorentini.casaoverview.oauth`
   - URL Schemes: `com.googleusercontent.apps.136409216810-b1gen1d2aggl6ur67jsdchdd1siqs9fo`

Opzione B — modificando direttamente `ios/App/App/Info.plist` con un editor testo.

## Verifica

Dopo aver applicato:

```bash
npx cap sync ios
npx cap open ios
```

In Xcode, ⌘R per buildare. Prova il login Gmail dalla pagina Impostazioni:
si dovrebbe aprire Safari, fare login Google, e al redirect l'app riprende il
controllo automaticamente.
