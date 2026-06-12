# GymBoard

**Current Version: v0.1**

GymBoard e una Progressive Web App mobile-first per creare schede personalizzate, registrare gli allenamenti e monitorare i progressi in palestra. E realizzata con HTML, CSS e JavaScript vanilla, pubblicabile su GitHub Pages e collegata a Supabase per autenticazione e sincronizzazione cloud.

## Funzioni

- Home con riepilogo settimanale e ultime sessioni
- Creazione di schede personalizzate, come Lista A e Lista B
- Esercizi scelti dall'utente con serie, ripetizioni e carico
- Calcolo automatico del volume per esercizio e per allenamento
- Storico filtrabile per tipo e mese
- Eliminazione delle sessioni registrate
- Grafico XY per carico e volume di ogni singolo esercizio
- Registrazione giornaliera e grafico del peso corporeo
- Promemoria in Home quando manca la misurazione di oggi
- Login e registrazione con nome, email e password
- Opzione **Ricordami** per scegliere la durata della sessione
- Persistenza online tramite Supabase
- Fallback `localStorage` soltanto quando Supabase non è configurato
- Installazione come PWA e utilizzo offline
- Struttura dati separata, pronta per un futuro adapter Supabase

## Roadmap

- Migliorare la gestione di serie ed esercizi durante l'allenamento
- Aggiungere modifica e riordinamento delle schede
- Introdurre obiettivi personali e statistiche avanzate
- Migliorare la sincronizzazione e l'esperienza offline
- Aggiungere recupero password e gestione del profilo
- Preparare la versione v1.0

## Changelog

### v0.1 - Prima versione funzionante

- Dashboard pubblicata su GitHub Pages
- Integrazione Supabase
- Login utente
- Funzione "ricordami"
- Tracking base allenamenti
- Tracking peso corporeo
- Sincronizzazione dati cloud

## Avvio locale

Il progetto non richiede dipendenze o build. Per avviarlo serve un piccolo server HTTP, necessario anche per il service worker.

Con Python:

```bash
python3 -m http.server 8080
```

Poi apri [http://localhost:8080](http://localhost:8080).

In alternativa, con Node.js:

```bash
npx serve .
```

Aprire direttamente `index.html` dal filesystem mostra l'interfaccia, ma alcune funzioni PWA potrebbero non essere disponibili.

## Pubblicazione su GitHub Pages

1. Carica il progetto in un repository GitHub.
2. Apri **Settings > Pages** nel repository.
3. In **Build and deployment**, seleziona **Deploy from a branch**.
4. Scegli il branch `main` e la cartella `/ (root)`.
5. Salva e attendi la pubblicazione.

Tutti i percorsi sono relativi, quindi l'app funziona anche all'indirizzo `https://nomeutente.github.io/nome-repository/`.

## Struttura

```text
.
├── assets/              # Icone PWA
├── css/styles.css       # Stili mobile-first
├── js/app.js            # UI, routing e interazioni
├── js/auth-storage.js   # Persistenza sessione Ricordami
├── js/config.js         # URL e publishable key Supabase
├── js/data-store.js     # Adapter Supabase e fallback localStorage
├── js/supabase-client.js # Client Supabase caricato via CDN
├── index.html           # Shell dell'app
├── manifest.webmanifest # Metadati di installazione
├── supabase-schema.sql  # Tabelle e regole di sicurezza Supabase
└── sw.js                # Cache e funzionamento offline
```

## Supabase

Supabase è configurato e attivo. `js/config.js` contiene esclusivamente Project URL e Publishable key, entrambe utilizzabili nel browser quando le tabelle sono protette da Row Level Security. Non sono presenti Secret key, `service_role` o connection string.

Prima di usare la dashboard:

1. Apri il progetto Supabase e vai in **SQL Editor**.
2. Esegui l'intero file `supabase-schema.sql` per creare tabelle, indici e policy RLS.
3. Verifica in **Authentication > Providers** che Email sia abilitato.
4. In **Authentication > URL Configuration**, aggiungi l'URL GitHub Pages tra i Redirect URLs.
5. Apri GymBoard, inserisci nome, email e password, quindi scegli **Crea account**.

Se la conferma email è abilitata, il primo accesso richiede il link ricevuto via email. Nei login successivi il nome inserito aggiorna i metadata del profilo e viene mostrato nella Home.

Con **Ricordami** selezionato, Supabase conserva la sessione in `localStorage` e l'accesso rimane disponibile dopo la chiusura del browser. Senza selezione, la sessione usa `sessionStorage`: rimane durante i refresh della scheda, ma viene eliminata alla chiusura della scheda o del browser. Il pulsante **Esci** invalida la sessione e rimuove i token da entrambi gli storage.

`supabase-js` viene importato direttamente da jsDelivr come modulo ESM, senza npm e senza build. La compatibilità con GitHub Pages rimane invariata.

Il modello dati e composto da:

- `plans`: Lista A, Lista B e altre schede
- `plan_exercises`: esercizi contenuti nelle schede
- `workouts`: sessioni completate
- `exercise_results`: serie, ripetizioni, carico e volume per esercizio
- `body_weights`: misurazioni giornaliere del peso corporeo

Quando Supabase è configurato, i dati vengono letti e scritti solo online. Il fallback locale viene selezionato esclusivamente lasciando vuoti URL o publishable key in `js/config.js`.
