import base64
import hashlib
import hmac
import json
import os
import re
import secrets
import smtplib
import sqlite3
import ssl
import threading
import time
from contextlib import contextmanager
from datetime import date, datetime, timedelta, tzinfo
from email.message import EmailMessage
from email.utils import formatdate, make_msgid
from http.cookies import SimpleCookie
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, urlencode, urlparse
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError


class RomeFallback(tzinfo):
    """Europa/Roma senza il pacchetto tzdata (assente su Windows): ora legale UE dall'ultima domenica di marzo all'ultima di ottobre, alle 01:00 UTC."""

    @staticmethod
    def _last_sunday(year, month):
        day = datetime(year, month + 1, 1) - timedelta(days=1) if month < 12 else datetime(year, 12, 31)
        return day - timedelta(days=(day.weekday() + 1) % 7)

    def _dst_bounds_utc(self, year):
        start = self._last_sunday(year, 3).replace(hour=1)
        end = self._last_sunday(year, 10).replace(hour=1)
        return start, end

    def utcoffset(self, dt):
        return timedelta(hours=1) + self.dst(dt)

    def dst(self, dt):
        if dt is None:
            return timedelta(0)
        start, end = self._dst_bounds_utc(dt.year)
        # dt è un orario locale: lo riporta a UTC con l'offset invernale per confrontarlo con i limiti.
        as_utc = dt.replace(tzinfo=None) - timedelta(hours=1)
        return timedelta(hours=1) if start <= as_utc < end else timedelta(0)

    def tzname(self, dt):
        return "CEST" if self.dst(dt) else "CET"

    def fromutc(self, dt):
        naive = dt.replace(tzinfo=None)
        start, end = self._dst_bounds_utc(naive.year)
        offset = timedelta(hours=2) if start <= naive < end else timedelta(hours=1)
        return (naive + offset).replace(tzinfo=self)


def rome_zone():
    try:
        return ZoneInfo("Europe/Rome")
    except ZoneInfoNotFoundError:
        return RomeFallback()


def env_int(name, default, minimum, maximum):
    try:
        value = int(os.environ.get(name, str(default)))
    except ValueError:
        return default
    return min(maximum, max(minimum, value))


SITE_DIR = Path(__file__).resolve().parent
DB_PATH = Path(os.environ.get("MARE_DB_PATH", str(SITE_DIR / "data" / "mare.sqlite3")))
DB_PATH.parent.mkdir(parents=True, exist_ok=True)
HOST = os.environ.get("MARE_HOST", "127.0.0.1")
PORT = int(os.environ.get("MARE_PORT", "8000"))
ADMIN_USER_CONFIGURED = bool(os.environ.get("MARE_ADMIN_USER"))
ADMIN_USER = os.environ.get("MARE_ADMIN_USER", "admin")
ADMIN_PASSWORD = os.environ.get("MARE_ADMIN_PASSWORD", "")
# In produzione il sito è servito solo in HTTPS: cookie Secure e HSTS.
HTTPS_MODE = os.environ.get("MARE_COOKIE_SECURE", "0") == "1"
# Intestazioni da cui leggere l'IP reale del visitatore dietro un proxy (es. Render/Cloudflare).
CLIENT_IP_HEADERS = [header.strip() for header in os.environ.get("MARE_CLIENT_IP_HEADER", "").split(",") if header.strip()]
# Indirizzo pubblico del sito, usato per hreflang, canonical e dati strutturati. Senza, si usa l'host della richiesta.
SITE_URL = os.environ.get("MARE_SITE_URL", "").strip().rstrip("/")
MAX_GUESTS = env_int("MARE_MAX_GUESTS", 12, 1, 500)
BOOKING_DAYS_AHEAD = env_int("MARE_BOOKING_DAYS_AHEAD", 180, 1, 730)
SESSION_SECONDS = 8 * 60 * 60
LOGIN_WINDOW = 15 * 60
LOGIN_MAX_ATTEMPTS = 8
BOOKING_WINDOW = 60 * 60
BOOKING_MAX_ATTEMPTS = 5
PASSWORD_SALT = secrets.token_bytes(16)
PASSWORD_HASH = hashlib.pbkdf2_hmac("sha256", ADMIN_PASSWORD.encode("utf-8"), PASSWORD_SALT, 310000) if len(ADMIN_PASSWORD) >= 12 else b""
STATE_LOCK = threading.Lock()
SESSIONS = {}
LOGIN_ATTEMPTS = {}
BOOKING_ATTEMPTS = {}
DATE_PATTERN = re.compile(r"^\d{4}-\d{2}-\d{2}$")
TIME_PATTERN = re.compile(r"^(?:[01]\d|2[0-3]):[0-5]\d$")
NAME_PATTERN = re.compile(r"^[^\W\d_](?:[^\W\d_]|[ '’.\-])*$")
PHONE_PATTERN = re.compile(r"^\+?\d{6,15}$")
EMAIL_PATTERN = re.compile(r"^[^@\s<>()\[\]\\,;:\"']{1,64}@[A-Za-z0-9](?:[A-Za-z0-9\-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9\-]{0,61}[A-Za-z0-9])?)*\.[A-Za-z]{2,24}$")
SERVICES = {"pranzo", "cena"}
STATUSES = {"ricevuta", "confermata", "annullata"}
LANGS = ("it", "en", "de")
ROME = rome_zone()
REFERENCE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
CONTACT_PHONE = os.environ.get("MARE_CONTACT_PHONE", "333 105 9588")
CONTACT_ADDRESS = os.environ.get("MARE_CONTACT_ADDRESS", "Molo di Levante 74, 47042 Cesenatico (FC)")
# Orari di esempio inseriti solo al primo avvio, quando non esiste ancora nessuna fascia: si modificano dall'area gestione.
DEMO_SLOTS = os.environ.get("MARE_DEMO_SLOTS", "1") == "1"
DEFAULT_SLOTS = [
    ("pranzo", "12:30", 24), ("pranzo", "13:00", 24), ("pranzo", "13:30", 24), ("pranzo", "14:00", 16),
    ("cena", "19:30", 24), ("cena", "20:00", 24), ("cena", "20:30", 24), ("cena", "21:00", 24), ("cena", "21:30", 16),
]
# Stagione e orari di esempio: valgono finché il gestore non salva i dati veri dal pannello "Apertura".
HOUR_KEYS = ("spiaggia", "colazione", "pranzo", "aperitivo", "cena")
DEFAULT_OPENING = {
    "restaurant": {"start": "2026-04-01", "end": "2026-10-31"},
    "beach": {"start": "2026-05-16", "end": "2026-09-20"},
    "weeklyClosed": [],
    "hours": {
        "spiaggia": {"open": "08:00", "close": "18:00"},
        "colazione": {"open": "08:30", "close": "12:00"},
        "pranzo": {"open": "12:30", "close": "14:30"},
        "aperitivo": {"open": "18:30", "close": "20:00"},
        "cena": {"open": "19:30", "close": "23:00"},
    },
    "offSeason": {"enabled": True, "days": [5, 6, 7], "services": ["pranzo", "cena"]},
    "confirmed": False,
}
# Meteo del badge in homepage: Open-Meteo, senza chiave. Il server fa da proxy e tiene i dati in cache,
# così il browser del visitatore non contatta servizi esterni.
WEATHER_URL = (
    "https://api.open-meteo.com/v1/forecast?latitude=44.2003&longitude=12.4030"
    "&current=temperature_2m,weather_code,is_day&timezone=Europe%2FRome"
)
SEA_URL = "https://marine-api.open-meteo.com/v1/marine?latitude=44.2003&longitude=12.4030&current=sea_surface_temperature"
WEATHER_TTL = 20 * 60
WEATHER_RETRY = 5 * 60
WEATHER_LOCK = threading.Lock()
WEATHER_CACHE = {"expires": 0.0, "payload": {"available": False}}

# Messaggi al cliente. Email con smtplib; SMS con Brevo o Twilio. "log" scrive i messaggi in data/outbox.log senza inviarli.
SMTP_HOST = os.environ.get("MARE_SMTP_HOST", "")
SMTP_PORT = env_int("MARE_SMTP_PORT", 587, 1, 65535)
SMTP_USER = os.environ.get("MARE_SMTP_USER", "")
SMTP_PASSWORD = os.environ.get("MARE_SMTP_PASSWORD", "")
SMTP_SECURITY = os.environ.get("MARE_SMTP_SECURITY", "starttls").lower()
SMTP_FROM = os.environ.get("MARE_SMTP_FROM", SMTP_USER)
SMTP_REPLY_TO = os.environ.get("MARE_SMTP_REPLY_TO", "")
EMAIL_TRANSPORT = os.environ.get("MARE_EMAIL_TRANSPORT", "smtp" if SMTP_HOST else "").lower()
SMS_PROVIDER = os.environ.get("MARE_SMS_PROVIDER", "").lower()
SMS_SENDER = os.environ.get("MARE_SMS_SENDER", "BagnoMare")[:11]
BREVO_API_KEY = os.environ.get("MARE_BREVO_API_KEY", "")
TWILIO_SID = os.environ.get("MARE_TWILIO_SID", "")
TWILIO_TOKEN = os.environ.get("MARE_TWILIO_TOKEN", "")
TWILIO_FROM = os.environ.get("MARE_TWILIO_FROM", "")
OUTBOX_PATH = DB_PATH.parent / "outbox.log"
OUTBOX_LOCK = threading.Lock()
MESSAGES_DIR = SITE_DIR / "messages"
MESSAGES_CACHE = {}

# Pagine HTML servite con i dati strutturati e l'indirizzo del sito inseriti al momento della richiesta.
HTML_ROUTES = {
    "/": ("index.html", "it"), "/index.html": ("index.html", "it"),
    "/en/": ("en/index.html", "en"), "/en/index.html": ("en/index.html", "en"),
    "/de/": ("de/index.html", "de"), "/de/index.html": ("de/index.html", "de"),
    "/privacy.html": ("privacy.html", "it"), "/en/privacy.html": ("en/privacy.html", "en"), "/de/privacy.html": ("de/privacy.html", "de"),
    "/admin.html": ("admin.html", "it"),
}
REDIRECTS = {"/admin": "/admin.html", "/en": "/en/", "/de": "/de/"}
LANG_PREFIX = {"it": "/", "en": "/en/", "de": "/de/"}
SCHEMA_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


@contextmanager
def open_db():
    """Apre il database, esegue commit o rollback e chiude sempre la connessione."""
    connection = sqlite3.connect(DB_PATH, timeout=15)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    try:
        with connection:
            yield connection
    finally:
        connection.close()


RESERVATION_COLUMNS = [
    # Colonne aggiunte nel tempo: i database esistenti vengono aggiornati all'avvio.
    ("customer_name", "TEXT NOT NULL DEFAULT ''"),
    ("phone", "TEXT NOT NULL DEFAULT ''"),
    ("email", "TEXT NOT NULL DEFAULT ''"),
    ("lang", "TEXT NOT NULL DEFAULT 'it'"),
    ("consent", "INTEGER NOT NULL DEFAULT 0"),
    ("status_reason", "TEXT NOT NULL DEFAULT ''"),
    ("notified_status", "TEXT NOT NULL DEFAULT ''"),
    ("notify_state", "TEXT NOT NULL DEFAULT ''"),
    ("notify_kind", "TEXT NOT NULL DEFAULT ''"),
    ("notify_channel", "TEXT NOT NULL DEFAULT ''"),
    ("notify_to", "TEXT NOT NULL DEFAULT ''"),
    ("notify_at", "TEXT NOT NULL DEFAULT ''"),
    ("notify_error", "TEXT NOT NULL DEFAULT ''"),
]


def initialize_db():
    with open_db() as connection:
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS service_slots (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                service TEXT NOT NULL,
                time TEXT NOT NULL,
                capacity INTEGER NOT NULL,
                active INTEGER NOT NULL DEFAULT 1
            );
            CREATE TABLE IF NOT EXISTS daily_limits (
                day TEXT PRIMARY KEY,
                capacity INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS slot_limits (
                day TEXT NOT NULL,
                slot_id INTEGER NOT NULL,
                capacity INTEGER NOT NULL,
                PRIMARY KEY(day, slot_id)
            );
            CREATE TABLE IF NOT EXISTS reservations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                reference TEXT NOT NULL UNIQUE,
                day TEXT NOT NULL,
                service TEXT NOT NULL,
                time TEXT NOT NULL,
                guests INTEGER NOT NULL,
                notes TEXT NOT NULL DEFAULT '',
                status TEXT NOT NULL DEFAULT 'ricevuta',
                utm_source TEXT NOT NULL DEFAULT '',
                utm_medium TEXT NOT NULL DEFAULT '',
                utm_campaign TEXT NOT NULL DEFAULT '',
                utm_term TEXT NOT NULL DEFAULT '',
                utm_content TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS reservations_day_service_time
                ON reservations(day, service, time, status);
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS closures (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                day TEXT NOT NULL,
                service TEXT NOT NULL,
                note TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL,
                UNIQUE(day, service)
            );
            """
        )
        columns = {row["name"] for row in connection.execute("PRAGMA table_info(reservations)")}
        for name, definition in RESERVATION_COLUMNS:
            if name not in columns:
                connection.execute("ALTER TABLE reservations ADD COLUMN {} {}".format(name, definition))
        if DEMO_SLOTS and not connection.execute("SELECT COUNT(*) FROM service_slots").fetchone()[0]:
            connection.executemany("INSERT INTO service_slots (service, time, capacity, active) VALUES (?, ?, ?, 1)", DEFAULT_SLOTS)


# ---------------------------------------------------------------------------
# Meteo
# ---------------------------------------------------------------------------

def fetch_json(url):
    request = Request(url, headers={"User-Agent": "BagnoMare/1.0", "Accept": "application/json"})
    with urlopen(request, timeout=4) as response:
        return json.loads(response.read(65536).decode("utf-8"))


def current_weather():
    """Restituisce il meteo in cache; in caso di errore il sito mostra un testo statico."""
    now = time.time()
    with WEATHER_LOCK:
        if WEATHER_CACHE["expires"] > now:
            return WEATHER_CACHE["payload"]
    payload = {"available": False}
    ttl = WEATHER_RETRY
    try:
        current = fetch_json(WEATHER_URL).get("current", {})
        temperature = current.get("temperature_2m")
        code = current.get("weather_code")
        if isinstance(temperature, (int, float)) and isinstance(code, int):
            payload = {"available": True, "temperature": round(temperature), "code": code, "isDay": bool(current.get("is_day", 1))}
            ttl = WEATHER_TTL
            try:
                sea = fetch_json(SEA_URL).get("current", {}).get("sea_surface_temperature")
                if isinstance(sea, (int, float)):
                    payload["sea"] = round(sea)
            except (URLError, OSError, ValueError):
                pass
    except (URLError, OSError, ValueError):
        pass
    with WEATHER_LOCK:
        WEATHER_CACHE["expires"] = now + ttl
        WEATHER_CACHE["payload"] = payload
    return payload


# ---------------------------------------------------------------------------
# Date, testo, validazione
# ---------------------------------------------------------------------------

def valid_date(value):
    if not isinstance(value, str) or not DATE_PATTERN.fullmatch(value):
        return False
    try:
        return datetime.strptime(value, "%Y-%m-%d").strftime("%Y-%m-%d") == value
    except ValueError:
        return False


def local_now():
    return datetime.now(ROME)


def today_iso():
    return local_now().date().isoformat()


def add_days(iso, days):
    return (date.fromisoformat(iso) + timedelta(days=days)).isoformat()


def last_bookable_day():
    return add_days(today_iso(), BOOKING_DAYS_AHEAD)


def slot_is_future(day, slot_time):
    today = today_iso()
    if day < today:
        return False
    if day > today:
        return True
    slot_datetime = datetime.strptime(day + " " + slot_time, "%Y-%m-%d %H:%M").replace(tzinfo=ROME)
    return slot_datetime > local_now()


def safe_text(value, max_length):
    if not isinstance(value, str):
        return ""
    return value.strip()[:max_length]


def clean_name(value):
    if not isinstance(value, str):
        return ""
    name = " ".join(value.split())
    if len(name) < 2 or len(name) > 80 or not NAME_PATTERN.fullmatch(name):
        return ""
    return name


def normalize_phone(value):
    if not isinstance(value, str):
        return ""
    phone = re.sub(r"[\s().\-/]", "", value)
    return phone if PHONE_PATTERN.fullmatch(phone) else ""


def clean_email(value):
    """Restituisce l'email normalizzata, "" se assente, None se non valida."""
    if value is None:
        return ""
    if not isinstance(value, str):
        return None
    email = value.strip()
    if not email:
        return ""
    if len(email) > 254 or not EMAIL_PATTERN.fullmatch(email):
        return None
    local, domain = email.rsplit("@", 1)
    return local + "@" + domain.lower()


def new_reference():
    return "MARE-" + "".join(secrets.choice(REFERENCE_ALPHABET) for _ in range(6))


def rate_limited(store, key, window, limit):
    now = time.time()
    with STATE_LOCK:
        attempts = [stamp for stamp in store.get(key, ()) if now - stamp < window]
        if attempts:
            store[key] = attempts
        else:
            store.pop(key, None)
        return len(attempts) >= limit


def record_attempt(store, key):
    with STATE_LOCK:
        store.setdefault(key, []).append(time.time())


def prune_state():
    """Elimina sessioni scadute e tentativi vecchi, così la memoria non cresce senza limite."""
    now = time.time()
    with STATE_LOCK:
        for token in [token for token, expiry in SESSIONS.items() if expiry <= now]:
            del SESSIONS[token]
        for store, window in ((LOGIN_ATTEMPTS, LOGIN_WINDOW), (BOOKING_ATTEMPTS, BOOKING_WINDOW)):
            for key in list(store):
                recent = [stamp for stamp in store[key] if now - stamp < window]
                if recent:
                    store[key] = recent
                else:
                    del store[key]


class ApiError(Exception):
    """Errore da restituire al browser: stato HTTP, messaggio in italiano e codice per la traduzione lato pagina."""

    def __init__(self, status, message, code=""):
        super().__init__(message)
        self.status = status
        self.message = message
        self.code = code


# ---------------------------------------------------------------------------
# Capienza
# ---------------------------------------------------------------------------

def booked_seats(connection, day, service=None, slot_time=None):
    query = "SELECT COALESCE(SUM(guests), 0) FROM reservations WHERE day = ? AND status != 'annullata'"
    values = [day]
    if service is not None:
        query += " AND service = ?"
        values.append(service)
    if slot_time is not None:
        query += " AND time = ?"
        values.append(slot_time)
    return int(connection.execute(query, values).fetchone()[0])


def slot_booked(connection, day, service, slot_time):
    return booked_seats(connection, day, service, slot_time)


def day_limit(connection, day):
    row = connection.execute("SELECT capacity FROM daily_limits WHERE day = ?", (day,)).fetchone()
    return int(row[0]) if row else None


def effective_slot_capacity(connection, day, slot):
    row = connection.execute("SELECT capacity FROM slot_limits WHERE day = ? AND slot_id = ?", (day, slot["id"])).fetchone()
    return int(row[0]) if row else int(slot["capacity"])


def capacity_error(connection, day, service, slot_time, guests, require_active=True):
    """Restituisce (stato HTTP, messaggio, codice) se i coperti non bastano, altrimenti None."""
    query = "SELECT * FROM service_slots WHERE service = ? AND time = ?"
    query += " AND active = 1" if require_active else " ORDER BY active DESC"
    slot = connection.execute(query + " LIMIT 1", (service, slot_time)).fetchone()
    if not slot:
        return 409, "Questo orario non è più disponibile.", "slot_unavailable"
    if slot_booked(connection, day, service, slot_time) + guests > effective_slot_capacity(connection, day, slot):
        return 409, "I posti per questo orario sono terminati. Scegli un altro orario.", "slot_full"
    limit = day_limit(connection, day)
    if limit is not None and booked_seats(connection, day) + guests > limit:
        return 409, "La capienza giornaliera è stata raggiunta.", "day_full"
    return None


# ---------------------------------------------------------------------------
# Stagione, orari e chiusure
# ---------------------------------------------------------------------------

def validate_opening(raw):
    """Controlla le impostazioni di apertura inviate dall'area gestione e le restituisce normalizzate."""
    if not isinstance(raw, dict):
        raise ValueError("Impostazioni di apertura non valide.")
    result = {}
    for key, label in (("restaurant", "del ristorante"), ("beach", "della spiaggia")):
        period = raw.get(key)
        if not isinstance(period, dict) or not valid_date(period.get("start")) or not valid_date(period.get("end")):
            raise ValueError("Inserisci le date di apertura e chiusura {}.".format(label))
        if period["start"] > period["end"]:
            raise ValueError("La stagione {} deve iniziare prima di finire.".format(label))
        result[key] = {"start": period["start"], "end": period["end"]}
    weekly = raw.get("weeklyClosed", [])
    if not isinstance(weekly, list) or any(isinstance(day, bool) or not isinstance(day, int) or day < 1 or day > 7 for day in weekly):
        raise ValueError("Giorno di riposo non valido.")
    if len(set(weekly)) == 7:
        raise ValueError("Con sette giorni di riposo il ristorante risulterebbe sempre chiuso.")
    result["weeklyClosed"] = sorted(set(weekly))
    hours = raw.get("hours")
    if not isinstance(hours, dict):
        raise ValueError("Orari non validi.")
    result["hours"] = {}
    for key in HOUR_KEYS:
        value = hours.get(key)
        if value is None and key not in SERVICES:
            result["hours"][key] = None
            continue
        if not isinstance(value, dict) or not TIME_PATTERN.fullmatch(str(value.get("open", ""))) or not TIME_PATTERN.fullmatch(str(value.get("close", ""))):
            raise ValueError("Controlla gli orari di {}: servono apertura e chiusura nel formato 12:30.".format(key))
        if value["open"] >= value["close"]:
            raise ValueError("Per {} l'orario di chiusura deve essere dopo quello di apertura (al massimo 23:59).".format(key))
        result["hours"][key] = {"open": value["open"], "close": value["close"]}
    off = raw.get("offSeason")
    if not isinstance(off, dict):
        raise ValueError("Impostazioni fuori stagione non valide.")
    days = off.get("days", [])
    services = off.get("services", [])
    if not isinstance(days, list) or any(isinstance(day, bool) or not isinstance(day, int) or day < 1 or day > 7 for day in days):
        raise ValueError("Giorni di apertura fuori stagione non validi.")
    if not isinstance(services, list) or any(service not in SERVICES for service in services):
        raise ValueError("Servizi fuori stagione non validi.")
    enabled = off.get("enabled") is True and bool(days) and bool(services)
    result["offSeason"] = {"enabled": enabled, "days": sorted(set(days)), "services": [s for s in ("pranzo", "cena") if s in services]}
    result["confirmed"] = True
    return result


def load_opening(connection):
    row = connection.execute("SELECT value FROM settings WHERE key = 'opening'").fetchone()
    if not row:
        return json.loads(json.dumps(DEFAULT_OPENING))
    try:
        return validate_opening(json.loads(row["value"]))
    except (ValueError, TypeError, json.JSONDecodeError):
        return json.loads(json.dumps(DEFAULT_OPENING))


class Opening:
    """Stagione, riposo settimanale e chiusure: decide se un servizio è aperto in un giorno."""

    def __init__(self, connection):
        self.settings = load_opening(connection)
        self.closures = {}
        for row in connection.execute("SELECT id, day, service, note FROM closures ORDER BY day"):
            self.closures.setdefault(row["day"], []).append(dict(row))

    def closure(self, day, service):
        for item in self.closures.get(day, ()):
            if item["service"] in (service, "tutto"):
                return item
        return None

    def in_season(self, day):
        season = self.settings["restaurant"]
        return season["start"] <= day <= season["end"]

    def service_open(self, day, service):
        """Restituisce (aperto, motivo) con motivo tra closure, weekly e season."""
        if self.closure(day, service):
            return False, "closure"
        weekday = date.fromisoformat(day).isoweekday()
        if self.in_season(day):
            if weekday in self.settings["weeklyClosed"]:
                return False, "weekly"
            return True, None
        off = self.settings["offSeason"]
        if off["enabled"] and weekday in off["days"] and service in off["services"]:
            return True, None
        return False, "season"

    def closed_services(self, day):
        return [service for service in ("pranzo", "cena") if not self.service_open(day, service)[0]]

    def beach_open(self, day):
        season = self.settings["beach"]
        return bool(self.settings["hours"].get("spiaggia")) and season["start"] <= day <= season["end"]

    def any_open(self, day):
        return len(self.closed_services(day)) < 2 or self.beach_open(day)

    def next_open(self, start_day, last_day, service=None):
        current = date.fromisoformat(start_day)
        end = date.fromisoformat(last_day)
        while current <= end:
            iso = current.isoformat()
            if (self.service_open(iso, service)[0] if service else self.any_open(iso)):
                return iso
            current += timedelta(days=1)
        return None

    def upcoming_closures(self, start_day, days, with_notes=False):
        end = add_days(start_day, days)
        result = []
        for day in sorted(self.closures):
            if start_day <= day <= end:
                for item in self.closures[day]:
                    entry = {"day": day, "service": item["service"]}
                    if with_notes:
                        entry.update({"id": item["id"], "note": item["note"]})
                    result.append(entry)
        return result


def hours_payload(connection):
    """Orari, stagione e stato di oggi per la pagina pubblica (senza le note interne delle chiusure)."""
    opening = Opening(connection)
    settings = opening.settings
    now = local_now()
    today = now.date().isoformat()
    clock = now.strftime("%H:%M")
    open_services = [service for service in ("pranzo", "cena") if opening.service_open(today, service)[0]]
    beach = opening.beach_open(today)
    until, kind = None, None
    if open_services:
        until, kind = max(settings["hours"][service]["close"] for service in open_services), "kitchen"
    elif beach:
        until, kind = settings["hours"]["spiaggia"]["close"], "beach"
    status = {"openToday": bool(until), "open": bool(until) and clock < until, "kind": kind, "until": until, "nextOpen": None}
    if not status["open"]:
        status["nextOpen"] = opening.next_open(add_days(today, 1), add_days(today, 400))
    return {
        "today": today,
        "now": clock,
        "restaurant": settings["restaurant"],
        "beach": settings["beach"],
        "weeklyClosed": settings["weeklyClosed"],
        "offSeason": settings["offSeason"],
        "hours": settings["hours"],
        "status": status,
        "closures": opening.upcoming_closures(today, 90),
    }


def structured_data(connection, lang, origin):
    """Dati strutturati schema.org Restaurant con orari stagionali e chiusure già note."""
    opening = Opening(connection)
    settings = opening.settings
    hours = settings["hours"]
    season = settings["restaurant"]
    open_days = [SCHEMA_DAYS[day - 1] for day in range(1, 8) if day not in settings["weeklyClosed"]]
    specs = []
    for service in ("pranzo", "cena"):
        specs.append({
            "@type": "OpeningHoursSpecification", "dayOfWeek": open_days,
            "opens": hours[service]["open"], "closes": hours[service]["close"],
            "validFrom": season["start"], "validThrough": season["end"],
        })
    off = settings["offSeason"]
    if off["enabled"]:
        # Fuori stagione fino al giorno prima della stessa data di apertura dell'anno dopo.
        next_start = add_days(season["start"], 364)
        for service in off["services"]:
            specs.append({
                "@type": "OpeningHoursSpecification", "dayOfWeek": [SCHEMA_DAYS[day - 1] for day in off["days"]],
                "opens": hours[service]["open"], "closes": hours[service]["close"],
                "validFrom": add_days(season["end"], 1), "validThrough": next_start,
            })
    special = [
        {"@type": "OpeningHoursSpecification", "opens": "00:00", "closes": "00:00", "validFrom": item["day"], "validThrough": item["day"]}
        for item in opening.upcoming_closures(today_iso(), 120) if item["service"] == "tutto"
    ]
    data = {
        "@context": "https://schema.org",
        "@type": "Restaurant",
        "name": "Bagno Marè",
        "url": origin + LANG_PREFIX.get(lang, "/"),
        "inLanguage": lang,
        "image": origin + "/assets/MARE_180619_044-scaled-374x561.jpg",
        "servesCuisine": ["Seafood", "Italian"],
        "acceptsReservations": True,
        "telephone": "+39 " + CONTACT_PHONE,
        "email": "info@mareconlaccento.it",
        "address": {
            "@type": "PostalAddress", "streetAddress": "Molo di Levante 74", "postalCode": "47042",
            "addressLocality": "Cesenatico", "addressRegion": "FC", "addressCountry": "IT",
        },
        "geo": {"@type": "GeoCoordinates", "latitude": 44.2003, "longitude": 12.4030},
        "openingHoursSpecification": specs,
    }
    if special:
        data["specialOpeningHoursSpecification"] = special
    text = json.dumps(data, ensure_ascii=False).replace("</", "<\\/")
    return '<script type="application/ld+json">' + text + "</script>"


# ---------------------------------------------------------------------------
# Messaggi al cliente
# ---------------------------------------------------------------------------

def email_ready():
    return EMAIL_TRANSPORT == "log" or (EMAIL_TRANSPORT == "smtp" and bool(SMTP_HOST) and bool(SMTP_FROM))


def sms_ready():
    if SMS_PROVIDER == "log":
        return True
    if SMS_PROVIDER == "brevo":
        return bool(BREVO_API_KEY)
    if SMS_PROVIDER == "twilio":
        return bool(TWILIO_SID and TWILIO_TOKEN and TWILIO_FROM)
    return False


def notify_target(row):
    """Canale del messaggio: email se c'è (e il server la sa inviare), altrimenti SMS al telefono."""
    if not row["consent"]:
        return None, "", "no_consent"
    if row["email"] and email_ready():
        return "email", row["email"], ""
    if row["phone"] and sms_ready():
        return "sms", sms_number(row["phone"]), ""
    return None, "", "not_configured"


def sms_number(phone):
    number = phone.strip()
    if number.startswith("00"):
        number = "+" + number[2:]
    if not number.startswith("+"):
        number = "+39" + number
    return number


def load_messages(lang):
    lang = lang if lang in LANGS else "it"
    if lang not in MESSAGES_CACHE:
        MESSAGES_CACHE[lang] = json.loads((MESSAGES_DIR / (lang + ".json")).read_text(encoding="utf-8"))
    return MESSAGES_CACHE[lang]


def render_message(kind, row):
    pack = load_messages(row["lang"])
    template = pack[kind]
    day = date.fromisoformat(row["day"])
    reason = (row["status_reason"] or "").strip()
    values = {
        "name": row["customer_name"],
        "date": pack["date_long"].format(weekday=pack["days"][day.weekday()], day=day.day, month=pack["months"][day.month - 1]),
        "date_short": pack["date_short"].format(day=day.day, month=day.month),
        "time": row["time"],
        "guests": (pack["guests_one"] if row["guests"] == 1 else pack["guests_many"]).format(n=row["guests"]),
        "count": row["guests"],
        "code": row["reference"],
        "address": CONTACT_ADDRESS,
        "phone": CONTACT_PHONE,
        "service": pack["services"][row["service"]],
        "reason_line": pack["reason_line"].format(reason=reason) if reason else "",
    }
    return {
        "subject": template["subject"].format_map(values),
        "email": template["email"].format_map(values).replace("\n\n\n", "\n\n"),
        "sms": template["sms"].format_map(values).replace("  ", " ").strip(),
    }


def write_outbox(channel, recipient, subject, body):
    stamp = local_now().strftime("%Y-%m-%d %H:%M:%S")
    with OUTBOX_LOCK, OUTBOX_PATH.open("a", encoding="utf-8") as handle:
        handle.write("--- {} · {} · {}\n".format(stamp, channel, recipient))
        if subject:
            handle.write("Oggetto: {}\n".format(subject))
        handle.write(body.rstrip() + "\n\n")


def send_email(recipient, subject, body):
    if EMAIL_TRANSPORT == "log":
        write_outbox("email", recipient, subject, body)
        return
    message = EmailMessage()
    message["From"] = SMTP_FROM
    message["To"] = recipient
    message["Subject"] = subject
    message["Date"] = formatdate(localtime=True)
    message["Message-ID"] = make_msgid(domain=(SMTP_FROM.rsplit("@", 1)[-1].strip(">") or None))
    if SMTP_REPLY_TO:
        message["Reply-To"] = SMTP_REPLY_TO
    message.set_content(body)
    context = ssl.create_default_context()
    if SMTP_SECURITY == "ssl":
        server = smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, context=context, timeout=20)
    else:
        server = smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=20)
    with server:
        if SMTP_SECURITY == "starttls":
            server.starttls(context=context)
        if SMTP_USER:
            server.login(SMTP_USER, SMTP_PASSWORD)
        server.send_message(message)


def send_sms(number, text):
    if SMS_PROVIDER == "log":
        write_outbox("sms", number, "", text)
        return
    if SMS_PROVIDER == "brevo":
        body = json.dumps({"type": "transactional", "sender": SMS_SENDER, "recipient": number.lstrip("+"), "content": text}).encode("utf-8")
        request = Request("https://api.brevo.com/v3/transactionalSMS/sms", data=body, method="POST",
                          headers={"api-key": BREVO_API_KEY, "Content-Type": "application/json", "Accept": "application/json"})
    elif SMS_PROVIDER == "twilio":
        body = urlencode({"To": number, "From": TWILIO_FROM, "Body": text}).encode("utf-8")
        token = base64.b64encode("{}:{}".format(TWILIO_SID, TWILIO_TOKEN).encode("utf-8")).decode("ascii")
        request = Request("https://api.twilio.com/2010-04-01/Accounts/{}/Messages.json".format(TWILIO_SID), data=body, method="POST",
                          headers={"Authorization": "Basic " + token, "Content-Type": "application/x-www-form-urlencoded"})
    else:
        raise RuntimeError("Nessun provider SMS configurato.")
    try:
        with urlopen(request, timeout=20) as response:
            response.read(2048)
    except HTTPError as error:
        detail = error.read(300).decode("utf-8", "replace")
        raise RuntimeError("Il provider SMS ha risposto {}: {}".format(error.code, detail))


def describe_error(error):
    if isinstance(error, smtplib.SMTPAuthenticationError):
        return "Accesso al server email rifiutato: controlla utente e password SMTP."
    if isinstance(error, smtplib.SMTPRecipientsRefused):
        return "Indirizzo email rifiutato dal server di posta."
    if isinstance(error, (URLError, OSError)) and not isinstance(error, smtplib.SMTPException):
        return "Servizio di invio non raggiungibile ({}).".format(error.__class__.__name__)
    return str(error)[:240] or error.__class__.__name__


def deliver_notification(reservation_id, kind):
    """Gira in un thread separato: il gestore non aspetta il provider. Registra esito e orario."""
    channel, recipient, state, error_text = "", "", "errore", ""
    try:
        with open_db() as connection:
            row = connection.execute("SELECT * FROM reservations WHERE id = ?", (reservation_id,)).fetchone()
        if not row:
            return
        channel, recipient, reason = notify_target(row)
        if not channel:
            state = "non_inviato"
            error_text = "Il cliente non ha dato il consenso ai messaggi." if reason == "no_consent" else "Email e SMS non sono configurati sul server."
            channel = ""
        else:
            message = render_message(kind, row)
            if channel == "email":
                send_email(recipient, message["subject"], message["email"])
            else:
                send_sms(recipient, message["sms"])
            state = "inviato"
    except Exception as error:  # qualunque errore del provider va registrato, non deve fermare il server
        state, error_text = "errore", describe_error(error)
    status_for_kind = "confermata" if kind == "conferma" else "annullata"
    with open_db() as connection:
        connection.execute(
            "UPDATE reservations SET notify_state = ?, notify_channel = ?, notify_to = ?, notify_at = ?, notify_error = ?, notify_kind = ?, "
            "notified_status = CASE WHEN ? = 'inviato' THEN ? ELSE notified_status END WHERE id = ?",
            (state, channel or "", recipient, local_now().isoformat(timespec="seconds"), error_text, kind, state, status_for_kind, reservation_id),
        )


def start_notification(reservation_id, kind):
    threading.Thread(target=deliver_notification, args=(reservation_id, kind), daemon=True).start()


def reservation_payload(row):
    data = dict(row)
    channel, recipient, reason = notify_target(row)
    data["notifyPreview"] = {"channel": channel, "to": recipient, "reason": reason}
    return data


# ---------------------------------------------------------------------------
# Server HTTP
# ---------------------------------------------------------------------------

class MareHandler(SimpleHTTPRequestHandler):
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map, ".woff2": "font/woff2"}

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(SITE_DIR), **kwargs)

    def end_headers(self):
        path = urlparse(self.path).path
        is_menu_pdf = bool(re.fullmatch(r"/assets/menus/[A-Za-z0-9_-]+\.pdf", path, flags=re.IGNORECASE))
        # HTML, CSS e JS vanno sempre ricontrollati: dopo un deploy nessuno vede la versione vecchia.
        if re.search(r"(/$|\.(html|css|js)$)", path) and not path.startswith("/api/"):
            self.send_header("Cache-Control", "no-cache")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "SAMEORIGIN" if is_menu_pdf else "DENY")
        self.send_header("Referrer-Policy", "strict-origin-when-cross-origin")
        self.send_header("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
        if HTTPS_MODE:
            self.send_header("Strict-Transport-Security", "max-age=31536000")
        frame_rule = "frame-ancestors 'self'" if is_menu_pdf else "frame-ancestors 'none'"
        self.send_header("Content-Security-Policy", "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; script-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'self'; " + frame_rule)
        super().end_headers()

    def send_json(self, payload, status=200, extra_headers=None):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        if extra_headers:
            for key, value in extra_headers.items():
                self.send_header(key, value)
        self.end_headers()
        self.wfile.write(body)

    def send_error_json(self, error):
        payload = {"error": error.message}
        if error.code:
            payload["code"] = error.code
        self.send_json(payload, error.status)

    def read_json(self, max_bytes=32768):
        if "application/json" not in self.headers.get("Content-Type", "").lower():
            raise ValueError("La richiesta deve usare JSON.")
        try:
            size = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            raise ValueError("Dimensione della richiesta non valida.")
        if size < 1 or size > max_bytes:
            raise ValueError("La richiesta è vuota o supera il limite consentito.")
        try:
            payload = json.loads(self.rfile.read(size).decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            raise ValueError("Il contenuto della richiesta non è valido.")
        if not isinstance(payload, dict):
            raise ValueError("Il contenuto della richiesta non è valido.")
        return payload

    def client_ip(self):
        for header in CLIENT_IP_HEADERS:
            candidate = self.headers.get(header, "").split(",")[0].strip()
            if candidate:
                return candidate[:64]
        return self.client_address[0]

    def site_origin(self):
        if SITE_URL:
            return SITE_URL
        host = self.headers.get("Host", "")
        if not re.fullmatch(r"[A-Za-z0-9.\-]+(:\d{1,5})?", host):
            host = "localhost"
        forwarded = self.headers.get("X-Forwarded-Proto", "").split(",")[0].strip().lower()
        scheme = "https" if HTTPS_MODE or forwarded == "https" else "http"
        return scheme + "://" + host

    def require_admin(self):
        if self.admin_session():
            return True
        self.send_json({"error": "Accedi per continuare."}, 401)
        return False

    def session_token(self):
        cookie = SimpleCookie(self.headers.get("Cookie", ""))
        morsel = cookie.get("mare_session")
        return morsel.value if morsel else ""

    def admin_session(self):
        token = self.session_token()
        if not token:
            return False
        with STATE_LOCK:
            expiry = SESSIONS.get(token)
            if expiry and expiry > time.time():
                return True
            SESSIONS.pop(token, None)
        return False

    def static_path_allowed(self, path):
        if path in {"/styles.css", "/admin.css", "/app.js", "/admin.js", "/boot.js", "/favicon.svg"}:
            return True
        if re.fullmatch(r"/assets/[A-Za-z0-9_.-]+\.jpg", path, flags=re.IGNORECASE):
            return True
        if re.fullmatch(r"/assets/fonts/[A-Za-z0-9_-]+\.woff2", path):
            return True
        return bool(re.fullmatch(r"/assets/menus/[A-Za-z0-9_-]+\.pdf", path, flags=re.IGNORECASE))

    def serve_html(self, relative, lang, head_only=False):
        path = SITE_DIR / relative
        try:
            body = path.read_bytes()
        except OSError:
            self.send_json({"error": "Risorsa non trovata."}, 404)
            return
        origin = self.site_origin()
        if b"<!--structured-data-->" in body:
            with open_db() as connection:
                block = structured_data(connection, lang, origin)
            body = body.replace(b"<!--structured-data-->", block.encode("utf-8"))
        body = body.replace(b"__ORIGIN__", origin.encode("utf-8"))
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        if not head_only:
            self.wfile.write(body)

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        query = parse_qs(parsed.query)
        if path.startswith("/api/"):
            self.route_api_get(path, query)
            return
        if path in REDIRECTS:
            self.send_response(301 if path != "/admin" else 302)
            self.send_header("Location", REDIRECTS[path])
            self.end_headers()
            return
        if path in HTML_ROUTES:
            self.serve_html(*HTML_ROUTES[path])
            return
        if self.static_path_allowed(path):
            super().do_GET()
        else:
            self.send_json({"error": "Risorsa non trovata."}, 404)

    def do_HEAD(self):
        path = urlparse(self.path).path
        if path in HTML_ROUTES:
            self.serve_html(*HTML_ROUTES[path], head_only=True)
        elif self.static_path_allowed(path):
            super().do_HEAD()
        else:
            self.send_response(404)
            self.end_headers()

    def route_api_get(self, path, query):
        if path == "/api/availability":
            self.get_availability(query)
        elif path == "/api/booking-config":
            self.get_booking_config()
        elif path == "/api/hours":
            with open_db() as connection:
                self.send_json(hours_payload(connection))
        elif path == "/api/weather":
            self.send_json(current_weather())
        elif path == "/api/admin/session":
            self.send_json({"authenticated": self.admin_session(), "configured": bool(PASSWORD_HASH)})
        elif path.startswith("/api/admin/") and not self.require_admin():
            return
        elif path == "/api/admin/config":
            self.get_admin_config(query)
        elif path == "/api/admin/overview":
            self.get_admin_overview(query)
        elif path == "/api/admin/upcoming":
            self.get_admin_upcoming(query)
        elif path == "/api/admin/opening":
            self.get_admin_opening()
        else:
            self.send_json({"error": "Risorsa non trovata."}, 404)

    # ----- API pubbliche -----

    def get_booking_config(self):
        today = today_iso()
        last = last_bookable_day()
        with open_db() as connection:
            opening = Opening(connection)
            closed = {}
            current = today
            while current <= last:
                services = opening.closed_services(current)
                if services:
                    closed[current] = services
                current = add_days(current, 1)
            hours = opening.settings["hours"]
        self.send_json({
            "maxGuests": MAX_GUESTS, "lastDay": last, "today": today, "closed": closed,
            "serviceStart": {"pranzo": hours["pranzo"]["open"], "cena": hours["cena"]["open"]},
        })

    def get_availability(self, query):
        day = query.get("date", [""])[0]
        service = query.get("service", [""])[0]
        guests_text = query.get("guests", ["1"])[0]
        if not valid_date(day) or service not in SERVICES:
            self.send_json({"error": "Seleziona una data e un servizio validi.", "code": "invalid_date"}, 400)
            return
        try:
            guests = int(guests_text)
        except ValueError:
            guests = 0
        if guests < 1 or guests > MAX_GUESTS:
            self.send_json({"error": "Per i gruppi più numerosi contatta direttamente lo stabilimento.", "code": "group_too_large"}, 400)
            return
        if day > last_bookable_day():
            self.send_json({"slots": [], "state": "out_of_range"})
            return
        with open_db() as connection:
            opening = Opening(connection)
            is_open, reason = opening.service_open(day, service)
            if not is_open:
                last = last_bookable_day()
                start = max(day, today_iso())
                next_day = opening.next_open(start, last, service) or opening.next_open(today_iso(), last, service)
                self.send_json({"slots": [], "state": "closed", "reason": reason, "nextOpen": next_day})
                return
            slots = connection.execute("SELECT * FROM service_slots WHERE service = ? AND active = 1 ORDER BY time", (service,)).fetchall()
            total_limit = day_limit(connection, day)
            daily_remaining = max(0, total_limit - booked_seats(connection, day)) if total_limit is not None else None
            result = []
            for slot in slots:
                if not slot_is_future(day, slot["time"]):
                    continue
                remaining = max(0, effective_slot_capacity(connection, day, slot) - slot_booked(connection, day, service, slot["time"]))
                if daily_remaining is not None:
                    remaining = min(remaining, daily_remaining)
                result.append({"time": slot["time"], "available": remaining >= guests, "remaining": remaining})
        if not slots:
            availability_state = "not_configured"
        elif not result:
            availability_state = "no_future_slots"
        elif not any(slot["available"] for slot in result):
            availability_state = "full"
        else:
            availability_state = "available"
        self.send_json({"slots": result, "state": availability_state})

    # ----- API area gestione -----

    def get_admin_config(self, query):
        day = query.get("date", [""])[0]
        if not valid_date(day):
            self.send_json({"error": "La data selezionata non è valida."}, 400)
            return
        with open_db() as connection:
            slots = connection.execute("SELECT * FROM service_slots ORDER BY service, time").fetchall()
            result = []
            for slot in slots:
                override = connection.execute("SELECT capacity FROM slot_limits WHERE day = ? AND slot_id = ?", (day, slot["id"])).fetchone()
                result.append({
                    "id": slot["id"],
                    "service": slot["service"],
                    "time": slot["time"],
                    "capacity": int(slot["capacity"]),
                    "active": bool(slot["active"]),
                    "dayCapacity": int(override[0]) if override else None,
                    "booked": slot_booked(connection, day, slot["service"], slot["time"]),
                })
            daily_capacity = day_limit(connection, day)
            opening = Opening(connection)
            day_status = {}
            for service in ("pranzo", "cena"):
                is_open, reason = opening.service_open(day, service)
                day_status[service] = {"open": is_open, "reason": reason}
            closures = [{"id": item["id"], "service": item["service"], "note": item["note"]} for item in opening.closures.get(day, [])]
        self.send_json({
            "date": day, "dailyCapacity": daily_capacity, "slots": result,
            "dayStatus": day_status, "closures": closures,
            "notify": {"email": email_ready(), "sms": sms_ready()},
        })

    def get_admin_overview(self, query):
        day = query.get("date", [""])[0]
        if not valid_date(day):
            self.send_json({"error": "La data selezionata non è valida."}, 400)
            return
        with open_db() as connection:
            reservations = connection.execute("SELECT * FROM reservations WHERE day = ? ORDER BY time, id", (day,)).fetchall()
            total_limit = day_limit(connection, day)
            total_booked = booked_seats(connection, day)
            remaining = max(0, total_limit - total_booked) if total_limit is not None else None
            slots = connection.execute("SELECT * FROM service_slots WHERE active = 1 ORDER BY service, time").fetchall()
            slot_result = []
            for slot in slots:
                capacity = effective_slot_capacity(connection, day, slot)
                used = slot_booked(connection, day, slot["service"], slot["time"])
                slot_result.append({
                    "service": slot["service"],
                    "time": slot["time"],
                    "capacity": capacity,
                    "booked": used,
                    "remaining": max(0, capacity - used),
                })
            reservation_result = [reservation_payload(row) for row in reservations]
        self.send_json({
            "date": day,
            "totalBooked": total_booked,
            "dailyCapacity": total_limit,
            "dailyRemaining": remaining,
            "slots": slot_result,
            "reservations": reservation_result,
        })

    def get_admin_upcoming(self, query):
        """Riepilogo dei prossimi 14 giorni: richieste e coperti non annullati, separati per servizio, e chiusure."""
        start = query.get("from", [""])[0]
        if not valid_date(start):
            self.send_json({"error": "La data selezionata non è valida."}, 400)
            return
        end = add_days(start, 13)
        with open_db() as connection:
            rows = connection.execute(
                "SELECT day, service, COUNT(*) AS bookings, COALESCE(SUM(guests), 0) AS guests, "
                "SUM(CASE WHEN status = 'ricevuta' THEN 1 ELSE 0 END) AS pending "
                "FROM reservations WHERE day BETWEEN ? AND ? AND status != 'annullata' GROUP BY day, service",
                (start, end),
            ).fetchall()
            opening = Opening(connection)
            closed = {}
            current = start
            while current <= end:
                services = opening.closed_services(current)
                if services:
                    closed[current] = services
                current = add_days(current, 1)
        days = {}
        for row in rows:
            entry = days.setdefault(row["day"], {"day": row["day"], "bookings": 0, "guests": 0, "pending": 0, "pranzo": 0, "cena": 0})
            entry["bookings"] += int(row["bookings"])
            entry["guests"] += int(row["guests"])
            entry["pending"] += int(row["pending"])
            entry[row["service"]] = int(row["guests"])
        self.send_json({"from": start, "to": end, "days": sorted(days.values(), key=lambda item: item["day"]), "closed": closed})

    def get_admin_opening(self):
        with open_db() as connection:
            opening = Opening(connection)
            closures = opening.upcoming_closures(add_days(today_iso(), -7), 400, with_notes=True)
        self.send_json({"opening": opening.settings, "closures": closures})

    def do_POST(self):
        path = urlparse(self.path).path
        if path == "/api/reservations":
            self.create_reservation()
            return
        if path == "/api/admin/login":
            self.admin_login()
            return
        if path == "/api/admin/logout":
            self.admin_logout()
            return
        if path == "/api/admin/closures":
            if self.require_admin():
                self.create_closure()
            return
        match = re.fullmatch(r"/api/admin/reservations/(\d+)/notify", path)
        if match:
            if self.require_admin():
                self.resend_notification(int(match.group(1)))
            return
        if path.startswith("/api/"):
            self.send_json({"error": "Risorsa non trovata."}, 404)
            return
        self.send_json({"error": "Metodo non consentito."}, 405)

    def create_reservation(self):
        prune_state()
        ip = self.client_ip()
        if rate_limited(BOOKING_ATTEMPTS, ip, BOOKING_WINDOW, BOOKING_MAX_ATTEMPTS):
            self.send_json({"error": "Hai inviato molte richieste in poco tempo. Riprova più tardi o contatta lo stabilimento.", "code": "rate_limited"}, 429)
            return
        try:
            payload = self.read_json()
            # Campo nascosto: le persone non lo vedono, i bot lo compilano.
            if safe_text(payload.get("website", ""), 200):
                record_attempt(BOOKING_ATTEMPTS, ip)
                self.send_json({"reference": new_reference(), "status": "ricevuta"}, 201)
                return
            day = payload.get("date")
            service = payload.get("service")
            slot_time = payload.get("time")
            guests = payload.get("guests")
            name = clean_name(payload.get("name"))
            phone = normalize_phone(payload.get("phone"))
            email = clean_email(payload.get("email"))
            notes = safe_text(payload.get("notes", ""), 500)
            lang = payload.get("lang") if payload.get("lang") in LANGS else "it"
            consent = payload.get("consent") is True
            if not name:
                raise ApiError(400, "Inserisci il nome per la prenotazione: almeno 2 lettere.", "invalid_name")
            if not phone:
                raise ApiError(400, "Inserisci un numero di telefono valido, con almeno 6 cifre.", "invalid_phone")
            if email is None:
                raise ApiError(400, "L'indirizzo email non è valido.", "invalid_email")
            if not valid_date(day):
                raise ApiError(400, "Scegli una data valida.", "invalid_date")
            if service not in SERVICES:
                raise ApiError(400, "Scegli pranzo o cena.", "invalid_service")
            if not isinstance(slot_time, str) or not TIME_PATTERN.fullmatch(slot_time):
                raise ApiError(400, "Scegli un orario valido.", "invalid_time")
            if day > last_bookable_day() or not slot_is_future(day, slot_time):
                raise ApiError(400, "Questo orario non è prenotabile online. Scegli un’altra data o un altro orario.", "not_bookable")
            if isinstance(guests, bool) or not isinstance(guests, int) or guests < 1 or guests > MAX_GUESTS:
                raise ApiError(400, "Per i gruppi più numerosi contatta direttamente lo stabilimento.", "group_too_large")
            utm = payload.get("utm", {})
            if not isinstance(utm, dict):
                utm = {}
            utm_values = [safe_text(utm.get(key, ""), 150) for key in ("utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content")]
        except ValueError as error:
            self.send_json({"error": str(error)}, 400)
            return
        except ApiError as error:
            self.send_error_json(error)
            return
        record_attempt(BOOKING_ATTEMPTS, ip)
        reference = new_reference()
        error = None
        try:
            with open_db() as connection:
                connection.execute("BEGIN IMMEDIATE")
                if not Opening(connection).service_open(day, service)[0]:
                    error = (409, "In quel giorno il servizio è chiuso. Scegli un altro giorno.", "closed")
                else:
                    error = capacity_error(connection, day, service, slot_time, guests)
                if error is None:
                    connection.execute(
                        "INSERT INTO reservations (reference, day, service, time, guests, customer_name, phone, email, lang, consent, notes, status, "
                        "utm_source, utm_medium, utm_campaign, utm_term, utm_content, created_at) "
                        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ricevuta', ?, ?, ?, ?, ?, ?)",
                        (reference, day, service, slot_time, guests, name, phone, email, lang, 1 if consent else 0, notes,
                         *utm_values, local_now().isoformat(timespec="seconds")),
                    )
        except sqlite3.Error:
            self.send_json({"error": "Non è stato possibile salvare la prenotazione. Riprova.", "code": "save_failed"}, 500)
            return
        if error is not None:
            self.send_json({"error": error[1], "code": error[2]}, error[0])
            return
        if consent and email and email_ready():
            channel, recipient = "email", email
        elif consent and sms_ready():
            channel, recipient = "sms", phone
        else:
            channel, recipient = "", ""
        self.send_json({"reference": reference, "status": "ricevuta", "notify": {"channel": channel, "to": recipient}}, 201)

    def admin_login(self):
        if not PASSWORD_HASH:
            self.send_json({"error": "Accesso admin non configurato. Imposta le credenziali del responsabile sul server."}, 503)
            return
        prune_state()
        ip = self.client_ip()
        if rate_limited(LOGIN_ATTEMPTS, ip, LOGIN_WINDOW, LOGIN_MAX_ATTEMPTS):
            self.send_json({"error": "Troppi tentativi. Riprova tra qualche minuto."}, 429)
            return
        try:
            payload = self.read_json(8192)
            username = safe_text(payload.get("username"), 120)
            password = payload.get("password", "")
            if not isinstance(password, str):
                password = ""
        except ValueError as error:
            self.send_json({"error": str(error)}, 400)
            return
        password_hash = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), PASSWORD_SALT, 310000)
        user_ok = hmac.compare_digest(username.encode("utf-8"), ADMIN_USER.encode("utf-8"))
        password_ok = hmac.compare_digest(password_hash, PASSWORD_HASH)
        if not (user_ok and password_ok):
            record_attempt(LOGIN_ATTEMPTS, ip)
            self.send_json({"error": "Nome utente o password non corretti."}, 401)
            return
        token = secrets.token_urlsafe(32)
        with STATE_LOCK:
            LOGIN_ATTEMPTS.pop(ip, None)
            SESSIONS[token] = time.time() + SESSION_SECONDS
        cookie = "mare_session={}; Path=/; Max-Age={}; HttpOnly; SameSite=Strict".format(token, SESSION_SECONDS)
        if HTTPS_MODE:
            cookie += "; Secure"
        self.send_json({"authenticated": True}, extra_headers={"Set-Cookie": cookie})

    def admin_logout(self):
        token = self.session_token()
        if token:
            with STATE_LOCK:
                SESSIONS.pop(token, None)
        expired_cookie = "mare_session=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict"
        if HTTPS_MODE:
            expired_cookie += "; Secure"
        self.send_json({"authenticated": False}, extra_headers={"Set-Cookie": expired_cookie})

    def create_closure(self):
        try:
            payload = self.read_json()
            day = payload.get("day")
            service = payload.get("service")
            note = safe_text(payload.get("note", ""), 120)
            if not valid_date(day):
                raise ValueError("La data della chiusura non è valida.")
            if service not in ("pranzo", "cena", "tutto"):
                raise ValueError("Scegli pranzo, cena o tutto il giorno.")
        except ValueError as error:
            self.send_json({"error": str(error)}, 400)
            return
        with open_db() as connection:
            if service == "tutto":
                connection.execute("DELETE FROM closures WHERE day = ? AND service IN ('pranzo', 'cena')", (day,))
            connection.execute(
                "INSERT INTO closures (day, service, note, created_at) VALUES (?, ?, ?, ?) "
                "ON CONFLICT(day, service) DO UPDATE SET note = excluded.note",
                (day, service, note, local_now().isoformat(timespec="seconds")),
            )
            services = ("pranzo", "cena") if service == "tutto" else (service,)
            active = connection.execute(
                "SELECT COUNT(*) FROM reservations WHERE day = ? AND status != 'annullata' AND service IN ({})".format(",".join("?" * len(services))),
                (day, *services),
            ).fetchone()[0]
        self.send_json({"saved": True, "activeReservations": int(active)})

    def resend_notification(self, reservation_id):
        with open_db() as connection:
            row = connection.execute("SELECT * FROM reservations WHERE id = ?", (reservation_id,)).fetchone()
            if not row:
                self.send_json({"error": "Prenotazione non trovata."}, 404)
                return
            if row["status"] == "confermata":
                kind = "conferma"
            elif row["status"] == "annullata":
                kind = row["notify_kind"] if row["notify_kind"] in ("rifiuto", "annullamento") else "rifiuto"
            else:
                self.send_json({"error": "Per una richiesta da verificare non c'è un messaggio da inviare."}, 400)
                return
            connection.execute("UPDATE reservations SET notify_state = 'in_corso', notify_kind = ?, notify_error = '' WHERE id = ?", (kind, reservation_id))
        start_notification(reservation_id, kind)
        self.send_json({"queued": True})

    def do_PUT(self):
        path = urlparse(self.path).path
        handlers = {"/api/admin/slots": self.update_slots, "/api/admin/capacity": self.update_capacity, "/api/admin/opening": self.update_opening}
        if path in handlers:
            if self.require_admin():
                handlers[path]()
            return
        self.send_json({"error": "Risorsa non trovata."}, 404)

    def do_DELETE(self):
        match = re.fullmatch(r"/api/admin/closures/(\d+)", urlparse(self.path).path)
        if not match:
            self.send_json({"error": "Risorsa non trovata."}, 404)
            return
        if not self.require_admin():
            return
        with open_db() as connection:
            deleted = connection.execute("DELETE FROM closures WHERE id = ?", (int(match.group(1)),)).rowcount
        if not deleted:
            self.send_json({"error": "Chiusura non trovata."}, 404)
            return
        self.send_json({"deleted": True})

    def update_opening(self):
        try:
            settings = validate_opening(self.read_json())
        except ValueError as error:
            self.send_json({"error": str(error)}, 400)
            return
        with open_db() as connection:
            connection.execute(
                "INSERT INTO settings(key, value) VALUES('opening', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                (json.dumps(settings),),
            )
        self.send_json({"saved": True, "opening": settings})

    def update_slots(self):
        try:
            payload = self.read_json()
            slots = payload.get("slots")
            if not isinstance(slots, list) or len(slots) > 100:
                raise ValueError("Elenco degli orari non valido.")
            prepared = []
            active_keys = set()
            for item in slots:
                if not isinstance(item, dict):
                    raise ValueError("Controlla i dati degli orari.")
                service = item.get("service")
                slot_time = item.get("time")
                capacity = item.get("capacity")
                active = item.get("active") is True
                slot_id = item.get("id")
                if service not in SERVICES or not isinstance(slot_time, str) or not TIME_PATTERN.fullmatch(slot_time):
                    raise ValueError("Inserisci un servizio e un orario validi.")
                if isinstance(capacity, bool) or not isinstance(capacity, int) or capacity < 1 or capacity > 500:
                    raise ValueError("La capienza per orario deve essere tra 1 e 500.")
                if active:
                    key = (service, slot_time)
                    if key in active_keys:
                        raise ValueError("Non ripetere lo stesso orario per lo stesso servizio.")
                    active_keys.add(key)
                if slot_id is not None and (isinstance(slot_id, bool) or not isinstance(slot_id, int) or slot_id < 1):
                    raise ValueError("Identificativo dell’orario non valido.")
                prepared.append((slot_id, service, slot_time, capacity, 1 if active else 0))
        except ValueError as error:
            self.send_json({"error": str(error)}, 400)
            return
        today = today_iso()
        try:
            with open_db() as connection:
                connection.execute("BEGIN IMMEDIATE")
                connection.execute("UPDATE service_slots SET active = 0")
                for slot_id, service, slot_time, capacity, active in prepared:
                    if slot_id is None:
                        existing = connection.execute("SELECT id FROM service_slots WHERE service = ? AND time = ? ORDER BY active DESC LIMIT 1", (service, slot_time)).fetchone()
                        if existing:
                            connection.execute("UPDATE service_slots SET capacity = ?, active = ? WHERE id = ?", (capacity, active, existing["id"]))
                        else:
                            connection.execute("INSERT INTO service_slots (service, time, capacity, active) VALUES (?, ?, ?, ?)", (service, slot_time, capacity, active))
                        continue
                    existing = connection.execute("SELECT service, time FROM service_slots WHERE id = ?", (slot_id,)).fetchone()
                    if not existing:
                        raise ValueError("Un orario è stato modificato da un’altra sessione. Aggiorna la pagina.")
                    if (existing["service"], existing["time"]) != (service, slot_time):
                        # Le prenotazioni sono legate a servizio e orario: spostare la fascia le lascerebbe fuori dal conteggio.
                        pending = connection.execute(
                            "SELECT COUNT(*) FROM reservations WHERE service = ? AND time = ? AND day >= ? AND status != 'annullata'",
                            (existing["service"], existing["time"], today),
                        ).fetchone()[0]
                        if pending:
                            raise ValueError("L’orario {} ha prenotazioni attive: invece di modificarlo, disattivalo e aggiungi un nuovo orario.".format(existing["time"]))
                        connection.execute("DELETE FROM slot_limits WHERE slot_id = ? AND day >= ?", (slot_id, today))
                    connection.execute("UPDATE service_slots SET service = ?, time = ?, capacity = ?, active = ? WHERE id = ?", (service, slot_time, capacity, active, slot_id))
        except ValueError as error:
            self.send_json({"error": str(error)}, 409)
            return
        except sqlite3.Error:
            self.send_json({"error": "Non è stato possibile salvare gli orari."}, 500)
            return
        self.send_json({"saved": True})

    def update_capacity(self):
        try:
            payload = self.read_json()
            day = payload.get("date")
            daily_capacity = payload.get("dailyCapacity")
            slot_capacities = payload.get("slotCapacities")
            if not valid_date(day):
                raise ValueError("La data selezionata non è valida.")
            if daily_capacity is not None and (isinstance(daily_capacity, bool) or not isinstance(daily_capacity, int) or daily_capacity < 1 or daily_capacity > 500):
                raise ValueError("La capienza giornaliera deve essere tra 1 e 500 oppure vuota.")
            if not isinstance(slot_capacities, list) or len(slot_capacities) > 100:
                raise ValueError("Capienze per orario non valide.")
            prepared = []
            for item in slot_capacities:
                if not isinstance(item, dict):
                    raise ValueError("Controlla le capienze per orario.")
                slot_id = item.get("id")
                capacity = item.get("capacity")
                if isinstance(slot_id, bool) or not isinstance(slot_id, int) or slot_id < 1:
                    raise ValueError("Identificativo dell’orario non valido.")
                if capacity is not None and (isinstance(capacity, bool) or not isinstance(capacity, int) or capacity < 1 or capacity > 500):
                    raise ValueError("La capienza di un orario deve essere tra 1 e 500 oppure vuota.")
                prepared.append((slot_id, capacity))
        except ValueError as error:
            self.send_json({"error": str(error)}, 400)
            return
        try:
            with open_db() as connection:
                connection.execute("BEGIN IMMEDIATE")
                if daily_capacity is not None and daily_capacity < booked_seats(connection, day):
                    raise ValueError("Il totale giornaliero non può essere inferiore ai coperti già prenotati.")
                if daily_capacity is None:
                    connection.execute("DELETE FROM daily_limits WHERE day = ?", (day,))
                else:
                    connection.execute("INSERT INTO daily_limits(day, capacity) VALUES(?, ?) ON CONFLICT(day) DO UPDATE SET capacity = excluded.capacity", (day, daily_capacity))
                for slot_id, capacity in prepared:
                    slot = connection.execute("SELECT service, time FROM service_slots WHERE id = ?", (slot_id,)).fetchone()
                    if not slot:
                        raise ValueError("Un orario è stato modificato da un’altra sessione. Aggiorna la pagina.")
                    if capacity is not None and capacity < slot_booked(connection, day, slot["service"], slot["time"]):
                        raise ValueError("Una capienza non può essere inferiore ai coperti già prenotati.")
                    if capacity is None:
                        connection.execute("DELETE FROM slot_limits WHERE day = ? AND slot_id = ?", (day, slot_id))
                    else:
                        connection.execute("INSERT INTO slot_limits(day, slot_id, capacity) VALUES(?, ?, ?) ON CONFLICT(day, slot_id) DO UPDATE SET capacity = excluded.capacity", (day, slot_id, capacity))
        except ValueError as error:
            self.send_json({"error": str(error)}, 409)
            return
        except sqlite3.Error:
            self.send_json({"error": "Non è stato possibile salvare le capienze."}, 500)
            return
        self.send_json({"saved": True})

    def do_PATCH(self):
        path = urlparse(self.path).path
        match = re.fullmatch(r"/api/admin/reservations/(\d+)", path)
        if not match:
            self.send_json({"error": "Risorsa non trovata."}, 404)
            return
        if not self.require_admin():
            return
        try:
            payload = self.read_json(8192)
            status = payload.get("status")
            reason = safe_text(payload.get("reason", ""), 160)
            if status not in STATUSES:
                raise ValueError("Stato della prenotazione non valido.")
        except ValueError as error:
            self.send_json({"error": str(error)}, 400)
            return
        reservation_id = int(match.group(1))
        error = None
        notify_kind = None
        try:
            with open_db() as connection:
                # BEGIN IMMEDIATE: il controllo dei posti e l'aggiornamento avvengono senza prenotazioni concorrenti.
                connection.execute("BEGIN IMMEDIATE")
                reservation = connection.execute("SELECT * FROM reservations WHERE id = ?", (reservation_id,)).fetchone()
                if not reservation:
                    error = (404, "Prenotazione non trovata.")
                elif reservation["status"] == "annullata" and status != "annullata":
                    capacity = capacity_error(connection, reservation["day"], reservation["service"], reservation["time"], reservation["guests"], require_active=False)
                    if capacity and capacity[2] == "slot_unavailable":
                        error = (409, "Configura di nuovo questo orario prima di riattivare la prenotazione.")
                    elif capacity:
                        error = (409, "La capienza disponibile non basta per riattivare questa prenotazione.")
                if error is None:
                    previous = reservation["status"]
                    # Un messaggio parte solo se lo stato cambia davvero e il cliente non è già stato avvisato di questo stato.
                    if status != previous and status in ("confermata", "annullata") and status != reservation["notified_status"]:
                        notify_kind = "conferma" if status == "confermata" else ("annullamento" if previous == "confermata" else "rifiuto")
                    connection.execute(
                        "UPDATE reservations SET status = ?, status_reason = ? WHERE id = ?",
                        (status, reason if status == "annullata" else "", reservation_id),
                    )
                    if notify_kind:
                        connection.execute("UPDATE reservations SET notify_state = 'in_corso', notify_kind = ?, notify_error = '' WHERE id = ?", (notify_kind, reservation_id))
        except sqlite3.Error:
            self.send_json({"error": "Non è stato possibile aggiornare la prenotazione."}, 500)
            return
        if error is not None:
            self.send_json({"error": error[1]}, error[0])
            return
        if notify_kind:
            start_notification(reservation_id, notify_kind)
        self.send_json({"saved": True, "notify": notify_kind})


class MareServer(ThreadingHTTPServer):
    # La coda predefinita (5) rifiuta connessioni quando il browser scarica molte immagini insieme.
    request_queue_size = 64


def main():
    initialize_db()
    server = MareServer((HOST, PORT), MareHandler)
    print("Sito Marè disponibile su http://{}:{}".format(HOST, PORT))
    if not PASSWORD_HASH:
        print("Area admin non attiva: configura MARE_ADMIN_USER e MARE_ADMIN_PASSWORD (almeno 12 caratteri).")
    elif not ADMIN_USER_CONFIGURED:
        print("Attenzione: MARE_ADMIN_USER non è impostato, si usa il nome utente predefinito \"admin\". Sceglierne uno meno prevedibile.")
    print("Messaggi ai clienti: email {}, SMS {}.".format(
        "attiva ({})".format(EMAIL_TRANSPORT) if email_ready() else "non configurata",
        "attivi ({})".format(SMS_PROVIDER) if sms_ready() else "non configurati",
    ))
    if HOST not in {"127.0.0.1", "localhost", "::1"}:
        if not HTTPS_MODE:
            print("Rete attiva senza MARE_COOKIE_SECURE=1: usa un proxy HTTPS e attiva il cookie Secure.")
        if not CLIENT_IP_HEADERS:
            print("MARE_CLIENT_IP_HEADER non impostato: dietro un proxy i limiti di tentativi vedono un solo IP.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nArresto del server.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
