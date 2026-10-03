# Bagno Marè — sito e prenotazioni

Sito in italiano, responsive, basato sulle foto e sulla palette fornite. Include la pagina pubblica, il modulo prenotazioni e un’area riservata per la gestione.

## Avvio in locale

Serve Python 3.9 o superiore. Nel terminale PowerShell, dalla cartella del progetto, imposta le credenziali e avvia il server:

```powershell
$env:MARE_ADMIN_USER = "gestore"
$env:MARE_ADMIN_PASSWORD = "inserisci-una-password-di-almeno-12-caratteri"
py -3 server.py
```

Apri `http://127.0.0.1:8000` per il sito e `http://127.0.0.1:8000/admin.html` per l’area gestione. Le credenziali sono configurate con variabili d’ambiente e non sono salvate nei file del sito.

## Configurazione del server

| Variabile | Predefinito | A cosa serve |
| --- | --- | --- |
| `MARE_ADMIN_USER` / `MARE_ADMIN_PASSWORD` | — | Credenziali dell’area gestione (password di almeno 12 caratteri). Scegli un nome utente diverso da `admin`. |
| `MARE_COOKIE_SECURE` | `0` (`1` nel Dockerfile) | Con `1` il cookie di sessione è `Secure` e il server invia l’intestazione HSTS. Va lasciato a `1` in produzione (HTTPS). |
| `MARE_CLIENT_IP_HEADER` | vuoto (nel Dockerfile `CF-Connecting-IP,True-Client-IP,X-Forwarded-For`) | Intestazioni da cui leggere l’IP reale del visitatore dietro un proxy, usato dai limiti di tentativi. Non impostarla se il server è esposto direttamente. |
| `MARE_MAX_GUESTS` | `12` | Numero massimo di persone per una prenotazione online. |
| `MARE_BOOKING_DAYS_AHEAD` | `180` | Quanti giorni in anticipo si può prenotare online. |
| `MARE_DB_PATH` | `data/mare.sqlite3` | Percorso del database. Su Render deve stare su un Persistent Disk (es. `/var/lib/mare`), altrimenti viene cancellato a ogni deploy. |

Protezioni attive: massimo 8 tentativi di accesso admin ogni 15 minuti e 5 richieste di prenotazione all’ora per IP, campo nascosto anti-bot nel modulo, nessuna modifica dell’orario di una fascia con prenotazioni attive (va disattivata e sostituita con una nuova).

## Carattere tipografico

Il sito usa **Anthropic Sans** per titoli e testo. È un carattere proprietario e i file non sono inclusi: senza licenza il sito usa automaticamente il carattere di sistema più simile (Segoe UI su Windows, SF Pro su Apple). Con la licenza, copia i file `.woff2` in `assets/fonts/` e aggiungi il relativo `url(...)` nelle regole `@font-face` all’inizio di `styles.css`.

## Prenotazioni e disponibilità

- Le prenotazioni vengono salvate nel database SQLite `data/mare.sqlite3`.
- Il cliente indica nome e telefono (obbligatori): compaiono nell’area gestione, con il numero cliccabile, e nell’esportazione CSV.
- L’admin può configurare gli orari generali di pranzo e cena, la capienza per ciascun orario e il limite totale per una data.
- Per una singola data può impostare capienze diverse per ogni orario; lasciando il campo vuoto si usa la capienza standard.
- Le prenotazioni includono data, servizio, orario, persone e note, come richiesto. Gli eventuali parametri UTM vengono conservati e mostrati nell’area gestione.
- Le fasce orarie non sono precompilate: vanno inserite dalla gestione quando sono disponibili gli orari ufficiali del Bagno Marè.

## Menu online

La pagina pubblica presenta colazione, pranzo e cena, aperitivo e carta dei vini con una gerarchia editoriale per momenti e categorie. I piatti sono leggibili direttamente sul sito; la carta dei vini di 31 pagine si consulta nel lettore espandibile. Il PDF allergeni resta disponibile tramite download. Il selettore nell’intestazione traduce i contenuti pubblici in italiano, inglese, francese, tedesco e spagnolo e ricorda la lingua scelta nel browser.

## Uso dell'area gestione

1. Apri `/admin.html` e accedi con le credenziali configurate sul server.
2. Seleziona la data da controllare. Il riepilogo mostra prenotazioni non annullate, coperti e capienze.
3. Usa il filtro per consultare richieste ricevute, confermate o annullate. L'esportazione CSV segue il filtro selezionato; la stampa produce il prospetto della data.
4. Per modificare una richiesta, cambia il suo stato. L'annullamento richiede una conferma e libera i coperti.
5. Nella capienza per data, un totale giornaliero vuoto significa nessun limite; lascia vuota una capienza per orario per usare il valore standard. Per cambiare una fascia in modo generale, usa la sezione Fasce di servizio.

Le prenotazioni inviate dal sito partono nello stato `ricevuta`: il gestore deve controllarle e aggiornarne lo stato. Il modulo raccoglie nome e telefono ma non invia email o SMS: per confermare o modificare, il gestore richiama il cliente al numero indicato.

## Backup

Il database è `data/mare.sqlite3`. Crea un backup coerente anche mentre il server è in esecuzione con:

```powershell
py -3 backup_db.py
```

Per impostare una cartella privata diversa, configura `MARE_BACKUP_DIR` prima di avviare il comando. Il percorso predefinito è `backups/`, escluso dal controllo versione. Conserva le copie con accesso ristretto e definisci una regola di conservazione; su hosting va predisposto anche un backup automatico.

Per ripristinare, arresta il server, conserva una copia del database corrente, sostituisci il file nel percorso `MARE_DB_PATH` con la copia scelta e riavvia il servizio. Verifica poi nell'area gestione che prenotazioni e disponibilità siano presenti.

## Prima della pubblicazione

Questa è una base funzionante per la revisione locale, non ancora una pubblicazione pronta per Internet. Il modulo raccoglie ora nome e telefono: l'informativa privacy va completata con il titolare prima della pubblicazione. Vanno inoltre aggiunti i dati ufficiali ancora mancanti (contatti, indirizzo e orari), verificati con il gestore i menu 2026 e i diritti delle immagini, completata l'informativa privacy con il titolare e controllato il sito su dispositivi reali.

Per la pubblicazione vanno scelti dominio e hosting con Python e database persistente, attivato HTTPS, predisposti backup automatici e ripristino e configurata l'immagine Open Graph con un URL assoluto del dominio definitivo. Il server incluso è pensato per sviluppo locale; non va esposto direttamente a Internet.

La cartella `data` contiene prenotazioni e va esclusa dal controllo versione e dai backup pubblici. Le credenziali admin vanno impostate nell’ambiente del server e non condivise nel codice.
