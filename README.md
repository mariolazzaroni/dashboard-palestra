# GymBoard

**Current Version: v2.2**

GymBoard è una Progressive Web App per creare schede palestra, registrare allenamenti, monitorare peso corporeo e leggere i propri progressi nel tempo.

Non è più solo un tracker: il progetto sta evolvendo verso una piattaforma personale per analytics, motivazione e coaching, costruita con dati semplici e comprensibili.

Il progetto usa solo:

- HTML
- CSS
- JavaScript vanilla
- Supabase via CDN
- GitHub Pages

Non richiede framework, build o npm.

## Prova Demo

Dalla schermata Login puoi cliccare **Prova demo**.

La demo:

- non richiede account;
- non usa Supabase;
- non crea utenti;
- usa dati finti già inclusi nell'app;
- mostra schede, allenamenti, peso, storico, statistiche e grafici;
- salva eventuali modifiche solo localmente;
- può essere ripristinata allo stato iniziale ricaricando l'app.

In modalità demo viene mostrato il badge **Modalità demo**. Il logout riporta alla schermata Login.

## Funzionalità Principali

- Login, registrazione e funzione **Ricordami**
- Versione demo senza login
- Account con modifica profilo, verifica email, recupero e cambio password
- Schede personalizzate con esercizi, serie e ripetizioni previste
- Catalogo esercizi con categorie muscolari
- Ricerca, filtro, modifica ed eliminazione esercizi
- Allenamento in corso persistente durante la navigazione
- Possibilità di saltare un esercizio solo nell'allenamento corrente
- Storico allenamenti filtrabile
- Tracking peso giornaliero con un solo valore per giorno
- Dashboard statistiche con trend peso rolling 52 settimane
- Analisi volume totale e volume per categoria
- Progressione carico per singolo esercizio
- Record personali e storico esercizio espandibile
- PWA installabile e funzionamento offline
- Integrazione Supabase con fallback locale quando Supabase non è configurato

## Come Avviare il Progetto

Il progetto è statico. Serve solo un piccolo server HTTP per usare bene service worker e PWA.

Con Python:

```bash
python3 -m http.server 8080
```

Poi apri:

```text
http://localhost:8080
```

In alternativa:

```bash
npx serve .
```

Aprire direttamente `index.html` può mostrare l'interfaccia, ma alcune funzioni PWA potrebbero non essere disponibili.

## Pubblicazione su GitHub Pages

1. Carica il progetto su GitHub.
2. Vai in **Settings > Pages**.
3. Seleziona **Deploy from a branch**.
4. Scegli branch `main` e cartella `/ (root)`.
5. Salva.

L'app usa percorsi relativi, quindi funziona anche su:

```text
https://nomeutente.github.io/nome-repository/
```

## Supabase

Supabase è usato per:

- autenticazione;
- sessione utente;
- sincronizzazione cloud di schede, esercizi, allenamenti e peso.

Nel frontend sono presenti solo:

- Project URL;
- publishable/anon key.

Non sono presenti `service_role`, secret key o connection string.

Per una nuova installazione:

1. Crea un progetto Supabase.
2. Apri **SQL Editor**.
3. Esegui `supabase-schema.sql`.
4. Abilita il provider Email in **Authentication > Providers**.
5. Aggiungi l'URL GitHub Pages in **Authentication > URL Configuration > Redirect URLs**.
6. Apri GymBoard e crea un account.

Migrazioni disponibili:

- `supabase-migration-v1.0.sql`: storico esercizi unificato
- `supabase-migration-v1.4.sql`: categorie esercizi
- `supabase-migration-v1.5.sql`: serie e ripetizioni previste nelle schede
- `supabase-migration-v1.6.sql`: eliminazione sicura degli esercizi collegati

Le migrazioni vanno eseguite manualmente su Supabase solo se stai aggiornando un database già esistente.

## Struttura

```text
.
├── assets/                    # Icone PWA
├── css/styles.css             # Stile dell'app
├── js/app.js                  # UI, routing e interazioni
├── js/auth-storage.js         # Gestione Ricordami
├── js/config.js               # Configurazione Supabase pubblica
├── js/data-store.js           # Store Supabase, fallback locale e demo
├── js/exercise-progress-utils.js
├── js/report-utils.js
├── js/supabase-client.js
├── index.html
├── manifest.webmanifest
├── sw.js                      # Service worker offline
└── supabase-*.sql             # Schema e migrazioni database
```

## Roadmap

### v1.x - Tracking

Fondamenta dell'app:

- login Supabase;
- gestione schede;
- gestione esercizi;
- storico allenamenti;
- tracking peso;
- progressione carichi;
- categorie esercizi;
- PWA installabile;
- supporto offline.

### v2.x - Analytics e Account

Versione attualmente in sviluppo.

Obiettivo: trasformare GymBoard da tracker a strumento di analisi personale.

- dashboard statistiche;
- report settimanali e mensili;
- trend peso rolling 52 settimane;
- volume totale e per categoria;
- progressione carico per esercizio;
- record personali;
- grafici più leggibili;
- gestione account e sicurezza;
- demo locale senza login;
- base dati pronta per PDF e AI.

### v3.x - Gamification

Obiettivo: rendere GymBoard più motivante, premiando costanza e miglioramento reale.

- livelli;
- XP;
- achievement;
- streak;
- obiettivi settimanali;
- statistiche lifetime;
- dashboard personale.

La gamification non deve incentivare allenamenti inutili o rischiosi.

### v4.x - AI Coach

Obiettivo: usare i dati elaborati dal modulo analytics per offrire consigli intelligenti.

- analisi progressi;
- individuazione punti deboli;
- suggerimenti sui carichi;
- analisi dei trend;
- report intelligenti;
- coaching personalizzato.

L'AI dovrà lavorare su dati già normalizzati, non direttamente sul database.

## Changelog Compatto

### v2.2

- Migliorata la UI dei grafici
- Form schede chiuso di default
- Aggiunta card **+ Nuova scheda**
- Possibilità di saltare esercizi solo nell'allenamento corrente
- Aggiunta modalità demo locale senza login

### v2.1

- Pagina Account
- Verifica email
- Recupero password
- Cambio password
- Logout pulito
- Eliminazione account preparata per backend sicuro

### v2.0

- Avvio infrastruttura analytics
- Report settimanale in app
- Trend peso rolling 52 settimane
- Volume totale e per categoria
- Progressione carico esercizi
- Storico esercizio espandibile

### v1.x

- Prima PWA funzionante
- Integrazione Supabase
- Login e registrazione
- Schede personalizzate
- Storico esercizi unificato
- Categorie esercizi
- Tracking allenamenti e peso
- Grafici progressi
- Supporto offline

