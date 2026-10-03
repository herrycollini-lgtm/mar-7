# Bagno Marè · sito e prenotazioni

Proposta di sito per il Bagno Marè di Cesenatico: pagina pubblica editoriale, prenotazione del ristorante in un pannello laterale e area gestione con credenziali.

La versione precedente del sito è conservata in `archivio/v1-2026-10-02/`.

## Avvio in locale

Serve Python 3.9 o superiore, senza pacchetti aggiuntivi.

```powershell
$env:MARE_ADMIN_USER = "gestore"
$env:MARE_ADMIN_PASSWORD = "una-password-di-almeno-12-caratteri"
py -3 server.py
```

Sito: `http://127.0.0.1:8000` · Area gestione: `http://127.0.0.1:8000/admin.html`

Per la demo c'è anche la configurazione `mare-dev` in `.claude/launch.json` (porta 8010, database separato `data/dev.sqlite3`, credenziali di prova nello stesso file). Contiene due prenotazioni di esempio per il 10 ottobre 2026.

## File

| File | Contenuto |
| --- | --- |
| `index.html` | Pagina pubblica: hero, il posto, la giornata, spiaggia, cucina con anteprima dei piatti, la sera, prenota, domande, contatti |
| `styles.css` | Token di colore (chiaro e scuro), tipografia, layout, pannello di prenotazione, stampa |
| `app.js` | Tema, barra di avanzamento, ricerca, anteprima piatti, meteo, UTM, calendario e invio della prenotazione |
| `boot.js` | Applica il tema prima del primo disegno e decide se mostrare il sipario iniziale |
| `admin.html`, `admin.css`, `admin.js` | Area gestione |
| `server.py` | Server HTTP, API, database SQLite, proxy meteo |
| `assets/` | Foto e menu 2026 in PDF |

## Direzione visiva

- Palette del cliente: `#2b2d42` ardesia scura, `#8d99ae` ardesia chiara, `#edf2f4` nebbia, con due toni sabbia derivati per gli sfondi delle sezioni.
- Titoli in **Bodoni Moda** (mai in corsivo, dimensione ottica fissata a 24 per non perdere i filetti a grandi dimensioni), testi in **Jost**.
- Layout a 12 colonne sfalsato, foto verticali e orizzontali sovrapposte, molto spazio vuoto.
- Pulsanti con riempimento che scorre dal basso, nessuna dissolvenza. Nessuna animazione di comparsa allo scorrimento.
- Con "riduci movimento" attivo nel sistema operativo, sipario e animazioni vengono disattivati.

## Funzioni

Pagina pubblica: tema chiaro/scuro con memoria della scelta, ricerca nel sito (`/` oppure `Ctrl K`, tollera accenti e piccoli errori), menu mobile a schermo intero, intestazione fissa con barra di avanzamento, salta al contenuto, pulsante torna su, contatto flottante (chiama, scrivi, indicazioni, prenota), domande espandibili, pulsanti copia per indirizzo, email, telefono e codice prenotazione, badge meteo live di Cesenatico con temperatura del mare, data di ultimo aggiornamento nel piè di pagina, foglio di stile per la stampa.

Prenotazione: pranzo o cena, giorno dal calendario (navigabile da tastiera), numero di persone, orari disponibili letti dal database, note, nome e telefono. Errori accanto al campo, messaggi del server in evidenza, conferma con codice, copia, aggiunta al calendario (.ics) e stampa del riepilogo. I parametri `utm_*` della visita vengono salvati con la prenotazione. Il link `/#prenota` apre direttamente il pannello.

Area gestione: accesso con mostra/nascondi password, prossimi 14 giorni con coperti e richieste da verificare, numeri del giorno, elenco filtrabile per stato e cercabile, cambio stato con finestra di conferma per l'annullamento, esportazione CSV, stampa, coperti per orario, capienza totale del giorno e per singolo orario, orari prenotabili con capienza standard, aggiornamento automatico ogni minuto.

## Configurazione del server

| Variabile | Predefinito | A cosa serve |
| --- | --- | --- |
| `MARE_ADMIN_USER` / `MARE_ADMIN_PASSWORD` | nessuno | Credenziali dell'area gestione (password di almeno 12 caratteri) |
| `MARE_DB_PATH` | `data/mare.sqlite3` | Percorso del database |
| `MARE_PORT` / `MARE_HOST` | `8000` / `127.0.0.1` | Porta e indirizzo |
| `MARE_MAX_GUESTS` | `12` | Persone massime per prenotazione online |
| `MARE_BOOKING_DAYS_AHEAD` | `180` | Giorni prenotabili in anticipo |
| `MARE_DEMO_SLOTS` | `1` | Al primo avvio inserisce orari di esempio (pranzo 12:30 · 14:00, cena 19:30 · 21:30). Con `0` parte senza orari |
| `MARE_COOKIE_SECURE` | `0` | In produzione `1`: cookie Secure e HSTS |
| `MARE_CLIENT_IP_HEADER` | vuoto | Intestazioni con l'IP reale dietro un proxy |

Su Windows, se manca il pacchetto `tzdata`, il server usa un fuso Europa/Roma interno con le regole dell'ora legale UE.

## Da completare prima di mostrarlo al cliente

1. **Telefono**: le fonti online riportano numeri diversi. Quello usato (333 105 9588) va verificato. Si trova in `index.html` e nella costante `CONTACT_PHONE` di `app.js`.
2. **Scheda informativa**: il PDF citato non era nelle cartelle; orari della giornata (12:30, 18:30, 19:30) e servizi vanno confrontati con la scheda.
3. **Menu**: la sezione cucina mostra una selezione dalla carta 2026. Va aggiornata con le indicazioni del cliente (voci in `index.html`, ogni voce indica la sua foto con `data-preview`).
4. **Foto in alta risoluzione**: le immagini attuali sono miniature (374 o 674 px di larghezza). Con gli originali il sito migliora molto su schermi grandi.
5. **Font**: per la proposta sono caricati da Google Fonts. Prima della pubblicazione vanno ospitati in `assets/fonts/` (privacy GDPR) e la CSP in `server.py` va ristretta a `'self'`.
6. **Lingue**: la versione precedente aveva cinque lingue. Questa è solo in italiano; le traduzioni vanno rifatte sui nuovi testi definitivi.
7. Informativa privacy, dominio, hosting con disco persistente, HTTPS e backup automatici (vedi `backup_db.py`).

## Backup

```powershell
py -3 backup_db.py
```

Crea una copia coerente del database in `backups/` (o in `MARE_BACKUP_DIR`). La cartella `data/` contiene prenotazioni e dati personali: va esclusa da controllo versione e condivisioni.
