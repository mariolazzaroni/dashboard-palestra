# GymBoard

GymBoard e una Progressive Web App mobile-first per registrare e monitorare gli allenamenti in palestra. E realizzata con HTML, CSS e JavaScript vanilla, funziona offline ed e pronta per essere pubblicata su GitHub Pages.

## Funzioni

- Home con riepilogo settimanale e ultime sessioni
- Creazione di schede personalizzate, come Lista A e Lista B
- Esercizi scelti dall'utente con serie, ripetizioni e carico
- Calcolo automatico del volume per esercizio e per allenamento
- Storico filtrabile per tipo e mese
- Eliminazione delle sessioni registrate
- Grafico XY per carico e volume di ogni singolo esercizio
- Persistenza locale tramite `localStorage`
- Installazione come PWA e utilizzo offline
- Struttura dati separata, pronta per un futuro adapter Supabase

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
├── js/data-store.js     # Adapter dati basato su localStorage
├── index.html           # Shell dell'app
├── manifest.webmanifest # Metadati di installazione
├── supabase-schema.sql  # Tabelle e regole di sicurezza Supabase
└── sw.js                # Cache e funzionamento offline
```

## Collegamento a Supabase

La versione attuale usa `localStorage`. Il file `supabase-schema.sql` contiene uno schema pronto per salvare i dati online separandoli per utente.

1. Crea un progetto su [Supabase](https://supabase.com/dashboard).
2. Apri **SQL Editor**, incolla `supabase-schema.sql` ed eseguilo.
3. Abilita un metodo di accesso in **Authentication > Providers**, per esempio email e password.
4. Recupera Project URL e Publishable key dal pannello **Connect** o da **Settings > API Keys**.
5. Inizializza `@supabase/supabase-js` nel browser con URL e Publishable key.
6. Sostituisci gli adapter `workoutStore` e `planStore` con funzioni asincrone che leggono e scrivono le tabelle Supabase.

La Publishable key puo essere usata nel frontend. Non inserire mai una Secret key o la vecchia `service_role` key in questa PWA o nel repository pubblico. La sicurezza dei dati utente dipende dalle policy Row Level Security incluse nello schema.

Il modello dati e composto da:

- `plans`: Lista A, Lista B e altre schede
- `plan_exercises`: esercizi contenuti nelle schede
- `workouts`: sessioni completate
- `exercise_results`: serie, ripetizioni, carico e volume per esercizio

Per mantenere anche il funzionamento offline servira infine una sincronizzazione tra `localStorage` e Supabase quando la connessione torna disponibile.
