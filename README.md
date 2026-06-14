# GymBoard

**Current Version: v1.3**

GymBoard e una Progressive Web App mobile-first per creare schede personalizzate, registrare gli allenamenti e monitorare i progressi in palestra. E realizzata con HTML, CSS e JavaScript vanilla, pubblicabile su GitHub Pages e collegata a Supabase per autenticazione e sincronizzazione cloud.

## Funzioni

- Home con riepilogo settimanale e ultime sessioni
- Creazione di schede personalizzate, come Lista A e Lista B
- Catalogo esercizi condiviso con identità stabile
- Suggerimenti automatici durante creazione e modifica delle schede
- Riconoscimento di nomi equivalenti per evitare esercizi duplicati
- Esercizi scelti dall'utente con serie, ripetizioni e carico
- Modifica e archiviazione non distruttiva delle schede
- Calcolo automatico del volume per esercizio e per allenamento
- Storico filtrabile per tipo e mese
- Eliminazione delle sessioni registrate
- Grafico XY aggregato per esercizio, indipendentemente dalla scheda utilizzata
- Registrazione giornaliera e grafico del peso corporeo
- Promemoria in Home quando manca la misurazione di oggi
- Login separato con email e password
- Registrazione separata con nome, email e conferma password
- Nome utente salvato nei metadata Supabase
- Persistenza online tramite Supabase
- Fallback `localStorage` soltanto quando Supabase non è configurato
- Installazione come PWA e utilizzo offline
- Struttura dati separata, pronta per un futuro adapter Supabase

## Roadmap

- Migliorare la gestione di serie ed esercizi durante l'allenamento
- Aggiungere il riordinamento drag-and-drop degli esercizi
- Introdurre obiettivi personali e statistiche avanzate
- Migliorare la sincronizzazione e l'esperienza offline
- Aggiungere recupero password e gestione del profilo
- Aggiungere esportazione e importazione dei dati

## Changelog

### v1.3 - Restyling e statistiche Home

- Nuovo tema scuro antracite con accento blu-violetto
- Blocchi, campi e menu con angoli maggiormente arrotondati
- Barra di navigazione inferiore ridisegnata in stile pillola
- Rimossa la statistica dei minuti dalla Home
- Riepilogo con numero di sessioni e volume totale
- Selezione del periodo tra settimana corrente, mese e anno
- Selezione di anno e mese tramite menu toggle personalizzati
- Volume settimanale visualizzato in kg
- Volume mensile e annuale visualizzato in tonnellate

### v1.2 - Login e registrazione separati

- Create due modalita di autenticazione distinte
- Login semplificato con email e password
- Registrazione con nome e conferma password
- Nome salvato in `user_metadata.full_name`
- Messaggio di conferma dopo la creazione dell'account

### v1.1 - Peso corporeo giornaliero

- Rimossa la selezione manuale della data dal form peso
- Registrazione automatica con la data odierna
- Un solo valore di peso per giorno
- Aggiornamento del valore esistente quando il peso di oggi è già presente

### v1.0 - Storico esercizi unificato

- Catalogo esercizi con identificativi stabili
- Storico aggregato indipendentemente dalla scheda
- Suggerimenti automatici e riconoscimento dei duplicati
- Creazione automatica dei nuovi esercizi
- Modifica delle schede esistenti
- Archiviazione non distruttiva delle schede
- Migrazione Supabase dei dati v0.1

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
├── supabase-schema.sql  # Schema completo per nuove installazioni
├── supabase-migration-v1.0.sql # Migrazione dei progetti v0.1
└── sw.js                # Cache e funzionamento offline
```

## Supabase

Supabase è configurato e attivo. `js/config.js` contiene esclusivamente Project URL e Publishable key, entrambe utilizzabili nel browser quando le tabelle sono protette da Row Level Security. Non sono presenti Secret key, `service_role` o connection string.

Per una nuova installazione:

1. Apri il progetto Supabase e vai in **SQL Editor**.
2. Esegui l'intero file `supabase-schema.sql` per creare tabelle, indici e policy RLS.
3. Verifica in **Authentication > Providers** che Email sia abilitato.
4. In **Authentication > URL Configuration**, aggiungi l'URL GitHub Pages tra i Redirect URLs.
5. Apri GymBoard, passa alla modalita **Registrazione** e crea l'account.

### Aggiornamento da v0.1 a v1.0

Prima di pubblicare il codice v1.0 su GitHub Pages:

1. Esegui un backup del database Supabase.
2. Apri **SQL Editor** nel progetto già utilizzato dalla v0.1.
3. Esegui una sola volta `supabase-migration-v1.0.sql`.
4. Verifica che la tabella `exercises` sia stata popolata.
5. Pubblica i file della dashboard v1.0.

La migrazione crea un esercizio unico per utente e nome normalizzato, collega le vecchie righe di `plan_exercises` e `exercise_results`, aggiunge `archived_at` alle schede e conserva tutti gli allenamenti precedenti.

Se la conferma email è abilitata, il primo accesso richiede il link ricevuto via email. Il nome viene salvato durante la registrazione in `user_metadata.full_name` e mostrato nella Home dopo l'accesso.

Supabase conserva la sessione in `localStorage`, mentre il pulsante **Esci** la invalida e rimuove i token dagli storage del browser.

`supabase-js` viene importato direttamente da jsDelivr come modulo ESM, senza npm e senza build. La compatibilità con GitHub Pages rimane invariata.

Il modello dati e composto da:

- `exercises`: catalogo personale con nome normalizzato e ID stabile
- `plans`: Lista A, Lista B e altre schede
- `plan_exercises`: riferimenti tra schede ed esercizi
- `workouts`: sessioni completate
- `exercise_results`: serie, ripetizioni, carico e volume collegati all'ID esercizio
- `body_weights`: misurazioni giornaliere del peso corporeo

Quando Supabase è configurato, i dati vengono letti e scritti solo online. Il fallback locale viene selezionato esclusivamente lasciando vuoti URL o publishable key in `js/config.js`.
