# Einprosit · Richieste ingredienti

Pagina riservata agli chef delle cene Einprosit all'Antica Maddalena.
Sito statico (GitHub Pages) + database Supabase (progetto **EPManager**).

- `index.html` — homepage per gli chef: le 4 cene a sinistra, cliccando si vedono e si aggiungono le richieste.
- `admin.html` — pagina amministratore: login via email, conferma disponibilità e prezzo, modifica dettagli cena.
- `assets/` — stile, configurazione Supabase (chiave pubblica), funzioni comuni.

## Riservatezza
- Un solo link: `https://einprosit.anticamaddalena.it`, da dare solo agli chef.
- Tutte le pagine hanno `noindex, nofollow`: i motori di ricerca non le indicizzano.
- Le tabelle non sono leggibili né modificabili direttamente: gli chef passano da funzioni che possono solo leggere e aggiungere richieste; conferme, prezzi e modifiche sono riservati agli admin (tabella `admins`).

## Pubblicazione su GitHub Pages
1. Carica questi file in un repository GitHub (pubblico, per GitHub Pages gratuito).
2. Repository → **Settings → Pages** → Source: *Deploy from a branch*, branch `main`, cartella `/ (root)`.
3. Il file `CNAME` imposta già il dominio `einprosit.anticamaddalena.it`.
4. Dal pannello DNS di `anticamaddalena.it` aggiungi un record:
   `CNAME  einprosit  →  <tuo-utente-github>.github.io`
5. Quando GitHub conferma il dominio, spunta **Enforce HTTPS**.

## Configurazione Supabase (una volta sola)
Dashboard Supabase → progetto EPManager → **Authentication → URL Configuration**:
- Site URL: `https://einprosit.anticamaddalena.it`
- Redirect URLs: `https://einprosit.anticamaddalena.it/admin.html`

Per aggiungere un altro amministratore: SQL editor →
`insert into public.admins(email) values ('nome@esempio.it');`
