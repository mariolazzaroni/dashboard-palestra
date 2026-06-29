# GymBoard

**Current Version: v2.2**

GymBoard e una Progressive Web App mobile-first nata per creare schede personalizzate, registrare gli allenamenti e monitorare i progressi in palestra. Il progetto non e piu solo un tracker: la visione attuale e farlo evolvere in una piattaforma orientata ad analytics, motivazione e coaching personale, capace di trasformare i dati raccolti in insight utili e azioni concrete.

E realizzata con HTML, CSS e JavaScript vanilla, pubblicabile su GitHub Pages e collegata a Supabase per autenticazione e sincronizzazione cloud.

## Funzioni

- Home con riepilogo settimanale e ultime sessioni
- Creazione di schede personalizzate, come Lista A e Lista B
- Catalogo esercizi condiviso con identità stabile
- Categorie semplici per organizzare gli esercizi e preparare analisi future
- Serie e ripetizioni previste salvate nelle schede
- Sezione Esercizi per consultare e gestire il catalogo personale
- Sezione Report con infrastruttura iniziale per analisi settimanali
- Schermata Progressi unificata con statistiche generali e progressione esercizi
- Suggerimenti automatici durante creazione e modifica delle schede
- Riconoscimento di nomi equivalenti per evitare esercizi duplicati
- Esercizi scelti dall'utente con serie, ripetizioni e carico
- Modifica e archiviazione non distruttiva delle schede
- Calcolo automatico del volume per esercizio e per allenamento
- Storico filtrabile per tipo e mese
- Eliminazione delle sessioni registrate
- Persistenza temporanea dell'allenamento in corso durante la navigazione
- Grafico XY aggregato per esercizio, indipendentemente dalla scheda utilizzata
- Registrazione giornaliera e grafico del peso corporeo
- Promemoria in Home quando manca la misurazione di oggi
- Login separato con email e password
- Registrazione separata con nome, cognome, email e conferma password
- Nome utente salvato nei metadata Supabase
- Opzione **Ricordami** disponibile nel Login
- Pagina Account con stato verifica email e sicurezza
- Modifica nome e cognome dalla pagina Account
- Recupero password e cambio password tramite Supabase
- Persistenza online tramite Supabase
- Fallback `localStorage` soltanto quando Supabase non è configurato
- Installazione come PWA e utilizzo offline
- Set completo di icone viola per browser, Safari e installazione PWA
- Struttura dati separata, pronta per un futuro adapter Supabase

## Roadmap

### v1.x - Tracking

Obiettivo: costruire una PWA stabile per registrare allenamenti, peso corporeo e progressione dei carichi.

- Login Supabase
- Schede personalizzate
- Catalogo esercizi
- Storico allenamenti
- Tracking peso giornaliero
- Progressione carichi
- Categorie esercizi
- PWA installabile e supporto offline

### v2.x - Analytics + Account/Sicurezza

Attualmente in sviluppo.

Obiettivo: trasformare GymBoard da semplice tracker ad applicazione di analisi dell'allenamento, con una gestione account piu completa e sicura.

- Dashboard Statistiche
- Report settimanali
- Report mensili
- Trend peso rolling 52 settimane
- Analisi volume totale
- Analisi volume per categoria
- Progressione carico dei singoli esercizi
- Record personali
- Storico esercizio espandibile
- PDF mensile
- Infrastruttura dati pronta per AI
- Grafici piu leggibili e integrati nella UI
- Form schede chiuso di default
- Rimozione temporanea esercizi dall'allenamento corrente
- Pagina Account
- Verifica email
- Recupero password
- Cambio password
- Logout pulito
- Eliminazione account preparata per backend sicuro

### v3.x - Gamification

Obiettivo: rendere GymBoard piu coinvolgente premiando la costanza e i progressi reali.

- Livelli utente
- Sistema XP
- Achievement
- Streak settimanali
- Statistiche lifetime:
  - kg sollevati
  - numero allenamenti
  - ore allenate
  - serie completate
  - ripetizioni totali
- Dashboard personale
- Obiettivi settimanali
- Record personali evidenziati
- Progressione del profilo

La gamification deve premiare la costanza e il miglioramento personale. Non dovra mai incentivare allenamenti inutili o rischiosi.

### v4.x - AI Coach

Obiettivo: utilizzare tutti i dati raccolti per fornire analisi intelligenti e consigli personalizzati.

- Analisi automatica dei progressi
- Individuazione dei punti deboli
- Analisi dei trend
- Suggerimenti personalizzati
- Report intelligenti
- Coach AI

L'AI dovra lavorare esclusivamente su dati gia elaborati dal modulo Analytics, senza interrogare direttamente il database.

## Changelog

### v2.2 - Rifiniture UI allenamenti e grafici

- Grafici Peso e Progressione carico con area visuale piu ampia
- Ridotto padding verticale nelle card dei grafici
- Schermata Allenamenti piu pulita con form scheda chiuso di default
- Aggiunta card **+ Nuova scheda** per aprire il form di creazione
- Chiusura e reset del form dopo salvataggio o annullamento
- Modifica scheda con apertura del form gia compilato
- Possibilita di saltare un esercizio solo nell'allenamento corrente
- Allenamento temporaneo coerente anche dopo navigazione o ripresa

### v2.1 - Account & Sicurezza

- Pagina Account
- Stato verifica email
- Reinvia email di verifica
- Recupero password
- Cambio password
- Logout pulito
- Eliminazione account preparata per backend sicuro

### v2.0-dev - Infrastruttura report

- Avviato lo sviluppo della v2.0
- Aggiunta sezione Report
- Separata la logica di calcolo report dalla UI
- Calcolo media peso settimanale
- Calcolo volume allenamento settimanale
- Calcolo volume per categoria
- Confronto con settimana precedente
- Numero settimana di riferimento nel report
- Confronto percentuale vs settimana precedente
- Trend peso rolling 52 settimane
- Preparata struttura `buildMonthlyReport` per futuro PDF mensile
- Unificate le sezioni Report e Progressi in una sola schermata
- Aggiunta card Evoluzione esercizi nella schermata Progressi
- Grafico evoluzione carico per singolo esercizio
- Analisi generale e singoli esercizi convivono senza nuove pagine di navigazione
- PDF e cardio non ancora implementati

### v1.6.2 - Reset form schede

- Migliorato il reset del form di creazione schede.
- Rimossi valori predefiniti indesiderati da Serie e Ripetizioni.
- Migliorata la gestione dei dati precompilati tra creazione, modifica e allenamento.

### v1.6 - Gestione catalogo esercizi

- Aggiunta sezione Esercizi
- Visualizzazione di nome, categoria, data di creazione e statistiche d'uso
- Modifica di nome e categoria mantenendo lo stesso `exercise_id`
- Eliminazione esercizi con conferma
- Rimozione dei riferimenti collegati da schede e storico
- Migrazione Supabase per mantenere l'integrità dei riferimenti

### v1.5 - Schede più utilizzabili

- Migliorata performance generale
- Aggiunte serie e ripetizioni previste nelle schede
- Precompilazione allenamento da scheda
- Scelta esplicita tra esercizio suggerito e nuovo esercizio
- Ridotti collegamenti automatici errati tra esercizi

### v1.4.3 - Continuita dei carichi

- Campi kg vuoti quando non esiste storico precedente
- Suggerimento del carico usato nell'ultimo allenamento
- Migliore continuità tra allenamenti successivi

### v1.4.2 - Affidabilita allenamento

- Persistenza allenamento in corso durante la navigazione
- Possibilità di riprendere o scartare un allenamento non completato
- Conferma prima dell'eliminazione di un allenamento dallo storico
- Rimozione della durata allenamento dall'interfaccia e dai riepiloghi

### v1.4 - Categorie esercizi

- Aggiunte categorie esercizi
- Preparazione analisi dati per report futuri
- Migliore organizzazione dello storico esercizi

### v1.3.6 - Restyling header

- Restyling header
- Migliore integrazione visiva con il tema
- Miglioramenti UX

### v1.3.5 - Identita visiva PWA

- Nuovo logo viola con una G geometrica centrale
- Sfondo viola esteso fino al bordo dell'icona
- Formato quadrato pieno senza maschera incorporata, compatibile con la sagoma applicata da iOS
- Proporzioni della G ottimizzate per la schermata Home di iPhone
- Nuovi nomi fisici degli asset per evitare il riuso delle vecchie icone da parte di Safari
- `apple-touch-icon.png` e `favicon.ico` disponibili anche nella radice del sito
- Icone PWA da 192 e 512 pixel aggiornate
- Aggiunta icona Apple Touch dedicata per Safari e iOS
- Aggiunte favicon nei formati PNG e ICO
- Manifest e meta tag delle icone uniformati
- Versionamento degli URL delle icone per evitare vecchie copie in cache

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
- Ripristinata l'opzione **Ricordami** nel Login
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
├── supabase-migration-v1.4.sql # Aggiunta categorie agli esercizi
├── supabase-migration-v1.5.sql # Serie e ripetizioni previste nelle schede
├── supabase-migration-v1.6.sql # Eliminazione sicura degli esercizi
└── sw.js                # Cache e funzionamento offline
```

Le icone presenti in `assets` condividono lo stesso logo e la stessa palette:

- `icon.svg`: sorgente vettoriale e favicon moderna
- `favicon.png` e `favicon.ico`: icone per browser
- `apple-touch-icon.png`: icona dedicata a Safari e iOS
- `icon-192.png` e `icon-512.png`: icone dichiarate nel manifest PWA

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

### Aggiornamento da v1.3.6 a v1.4

Prima di pubblicare il codice v1.4 su GitHub Pages:

1. Esegui un backup del database Supabase.
2. Apri **SQL Editor** nel progetto esistente.
3. Esegui una sola volta `supabase-migration-v1.4.sql`.
4. Verifica che la colonna `category` sia presente nella tabella `exercises`.
5. Pubblica i file della dashboard v1.4.

La migrazione aggiunge `category` a `exercises`, assegna `Altro` agli esercizi esistenti, limita i valori alle categorie supportate e crea un indice per future aggregazioni per utente e categoria. Non crea tabelle cardio e non modifica allenamenti o storico.

### Aggiornamento a v1.5

Prima di pubblicare il codice v1.5 su GitHub Pages:

1. Esegui un backup del database Supabase.
2. Apri **SQL Editor** nel progetto esistente.
3. Esegui una sola volta `supabase-migration-v1.5.sql`.
4. Verifica che `planned_sets` e `planned_reps` siano presenti nella tabella `plan_exercises`.
5. Pubblica i file della dashboard v1.5.

La migrazione aggiunge serie e ripetizioni previste al collegamento tra scheda ed esercizio. Gli esercizi esistenti ricevono il default `3 x 8`. Non modifica lo storico allenamenti.

### Aggiornamento a v1.6

Prima di pubblicare il codice v1.6 su GitHub Pages:

1. Esegui un backup del database Supabase.
2. Apri **SQL Editor** nel progetto esistente.
3. Esegui una sola volta `supabase-migration-v1.6.sql`.
4. Verifica che le foreign key di `plan_exercises.exercise_id` e `exercise_results.exercise_id` usino `ON DELETE CASCADE`.
5. Pubblica i file della dashboard v1.6.

La migrazione permette di eliminare un esercizio rimuovendo automaticamente i riferimenti collegati nelle schede e nei risultati allenamento, evitando record orfani.

Se la conferma email è abilitata, il primo accesso richiede il link ricevuto via email. Il nome viene salvato durante la registrazione in `user_metadata.full_name` e mostrato nella Home dopo l'accesso.

Supabase conserva la sessione in `localStorage`, mentre il pulsante **Esci** la invalida e rimuove i token dagli storage del browser.

`supabase-js` viene importato direttamente da jsDelivr come modulo ESM, senza npm e senza build. La compatibilità con GitHub Pages rimane invariata.

Il modello dati e composto da:

- `exercises`: catalogo personale con nome normalizzato, ID stabile e categoria muscolare
- `plans`: Lista A, Lista B e altre schede
- `plan_exercises`: riferimenti tra schede ed esercizi, con serie e ripetizioni previste
- `workouts`: sessioni completate
- `exercise_results`: serie, ripetizioni, carico e volume collegati all'ID esercizio
- `body_weights`: misurazioni giornaliere del peso corporeo

Quando Supabase è configurato, i dati vengono letti e scritti solo online. Il fallback locale viene selezionato esclusivamente lasciando vuoti URL o publishable key in `js/config.js`.
