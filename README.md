# Einprosit · Richieste ingredienti

Pagina riservata agli chef delle cene Einprosit all'Antica Maddalena.
Sito statico (GitHub Pages) + database Supabase (progetto **EPManager**).

- `index.html` — pagina chef. Si apre solo con il link segreto della cena (`…/#k=<codice>`).
- `admin.html` — pagina amministratore: login via email, conferma disponibilità e prezzo, modifica dettagli cena, copia/rigenera i link per gli chef.
- `assets/` — stile, configurazione Supabase (chiave pubblica), funzioni comuni.

## Come funziona la riservatezza
- Senza un link valido la pagina mostra solo "Accesso riservato".
- Ogni cena ha un proprio codice: chi ha il link di una cena vede solo le richieste di quella cena.
- Il codice sta dopo `#`, quindi non finisce nei log del server né nei referrer.
- Tutte le pagine hanno `noindex, nofollow`: i motori di ricerca non le indicizzano.
- Le tabelle non sono leggibili direttamente: gli chef passano solo da funzioni che richiedono il codice; l'admin è controllato dalla tabella `admins`.

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
