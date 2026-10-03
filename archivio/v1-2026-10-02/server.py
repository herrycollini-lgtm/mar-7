import hashlib
import hmac
import json
import os
import re
import secrets
import sqlite3
import threading
import time
from contextlib import contextmanager
from datetime import datetime, timedelta
from http.cookies import SimpleCookie
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse
from zoneinfo import ZoneInfo


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
SERVICES = {"pranzo", "cena"}
STATUSES = {"ricevuta", "confermata", "annullata"}
ROME = ZoneInfo("Europe/Rome")
REFERENCE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


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
                customer_name TEXT NOT NULL DEFAULT '',
                phone TEXT NOT NULL DEFAULT '',
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
            """
        )
        # Migrazione dei database creati prima dei campi nome e telefono.
        columns = {row["name"] for row in connection.execute("PRAGMA table_info(reservations)")}
        if "customer_name" not in columns:
            connection.execute("ALTER TABLE reservations ADD COLUMN customer_name TEXT NOT NULL DEFAULT ''")
        if "phone" not in columns:
            connection.execute("ALTER TABLE reservations ADD COLUMN phone TEXT NOT NULL DEFAULT ''")


def valid_date(value):
    if not isinstance(value, str) or not DATE_PATTERN.fullmatch(value):
        return False
    try:
        return datetime.strptime(value, "%Y-%m-%d").strftime("%Y-%m-%d") == value
    except ValueError:
        return False


def local_now():
    return datetime.now(ROME)


def last_bookable_day():
    return (local_now().date() + timedelta(days=BOOKING_DAYS_AHEAD)).isoformat()


def slot_is_future(day, slot_time):
    today = local_now().date().isoformat()
    if day < today:
        return False
    if day > today:
        return True
    slot_datetime = datetime.strptime(day + " " + slot_time, "%Y-%m-%d %H:%M").replace(tzinfo=ROME)
    return slot_datetime > local_now()


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
    """Restituisce (stato HTTP, messaggio) se i coperti non bastano, altrimenti None."""
    query = "SELECT * FROM service_slots WHERE service = ? AND time = ?"
    query += " AND active = 1" if require_active else " ORDER BY active DESC"
    slot = connection.execute(query + " LIMIT 1", (service, slot_time)).fetchone()
    if not slot:
        return 409, "Questo orario non è più disponibile."
    if slot_booked(connection, day, service, slot_time) + guests > effective_slot_capacity(connection, day, slot):
        return 409, "I posti per questo orario sono terminati. Scegli un altro orario."
    limit = day_limit(connection, day)
    if limit is not None and booked_seats(connection, day) + guests > limit:
        return 409, "La capienza giornaliera è stata raggiunta."
    return None


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


class MareHandler(SimpleHTTPRequestHandler):
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map, ".woff2": "font/woff2"}

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(SITE_DIR), **kwargs)

    def end_headers(self):
        is_menu_pdf = bool(re.fullmatch(r"/assets/menus/[A-Za-z0-9_-]+\.pdf", urlparse(self.path).path, flags=re.IGNORECASE))
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "SAMEORIGIN" if is_menu_pdf else "DENY")
        self.send_header("Referrer-Policy", "strict-origin-when-cross-origin")
        self.send_header("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
        if HTTPS_MODE:
            self.send_header("Strict-Transport-Security", "max-age=31536000")
        frame_rule = "frame-ancestors 'self'" if is_menu_pdf else "frame-ancestors 'none'"
        self.send_header("Content-Security-Policy", "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'self'; " + frame_rule)
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
        if path in {"/", "/index.html", "/admin.html", "/styles.css", "/app.js", "/admin.js"}:
            return True
        if re.fullmatch(r"/assets/[A-Za-z0-9_.-]+\.jpg", path, flags=re.IGNORECASE):
            return True
        if re.fullmatch(r"/assets/fonts/[A-Za-z0-9_-]+\.woff2", path):
            return True
        return bool(re.fullmatch(r"/assets/menus/[A-Za-z0-9_-]+\.pdf", path, flags=re.IGNORECASE))

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/availability":
            self.get_availability(parse_qs(parsed.query))
            return
        if parsed.path == "/api/booking-config":
            self.send_json({"maxGuests": MAX_GUESTS, "lastDay": last_bookable_day()})
            return
        if parsed.path == "/api/admin/session":
            self.send_json({"authenticated": self.admin_session(), "configured": bool(PASSWORD_HASH)})
            return
        if parsed.path == "/api/admin/config":
            if self.require_admin():
                self.get_admin_config(parse_qs(parsed.query))
            return
        if parsed.path == "/api/admin/overview":
            if self.require_admin():
                self.get_admin_overview(parse_qs(parsed.query))
            return
        if parsed.path == "/admin":
            self.send_response(302)
            self.send_header("Location", "/admin.html")
            self.end_headers()
            return
        if parsed.path.startswith("/api/"):
            self.send_json({"error": "Risorsa non trovata."}, 404)
            return
        if self.static_path_allowed(parsed.path):
            super().do_GET()
        else:
            self.send_json({"error": "Risorsa non trovata."}, 404)

    def do_HEAD(self):
        path = urlparse(self.path).path
        if self.static_path_allowed(path):
            super().do_HEAD()
        else:
            self.send_response(404)
            self.end_headers()

    def get_availability(self, query):
        day = query.get("date", [""])[0]
        service = query.get("service", [""])[0]
        guests_text = query.get("guests", ["1"])[0]
        if not valid_date(day) or service not in SERVICES:
            self.send_json({"error": "Seleziona una data e un servizio validi."}, 400)
            return
        try:
            guests = int(guests_text)
        except ValueError:
            guests = 0
        if guests < 1 or guests > MAX_GUESTS:
            self.send_json({"error": "Per i gruppi più numerosi contatta direttamente lo stabilimento."}, 400)
            return
        if day > last_bookable_day():
            self.send_json({"slots": [], "state": "out_of_range"})
            return
        with open_db() as connection:
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
        self.send_json({"date": day, "dailyCapacity": daily_capacity, "slots": result})

    def get_admin_overview(self, query):
        day = query.get("date", [""])[0]
        if not valid_date(day):
            self.send_json({"error": "La data selezionata non è valida."}, 400)
            return
        with open_db() as connection:
            reservations = connection.execute(
                "SELECT id, reference, day, service, time, guests, customer_name, phone, notes, status, utm_source, utm_medium, utm_campaign, created_at FROM reservations WHERE day = ? ORDER BY time, id",
                (day,),
            ).fetchall()
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
            reservation_result = [dict(row) for row in reservations]
        self.send_json({
            "date": day,
            "totalBooked": total_booked,
            "dailyCapacity": total_limit,
            "dailyRemaining": remaining,
            "slots": slot_result,
            "reservations": reservation_result,
        })

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
        if path.startswith("/api/"):
            self.send_json({"error": "Risorsa non trovata."}, 404)
            return
        self.send_json({"error": "Metodo non consentito."}, 405)

    def create_reservation(self):
        prune_state()
        ip = self.client_ip()
        if rate_limited(BOOKING_ATTEMPTS, ip, BOOKING_WINDOW, BOOKING_MAX_ATTEMPTS):
            self.send_json({"error": "Hai inviato molte richieste in poco tempo. Riprova più tardi o contatta lo stabilimento."}, 429)
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
            notes = safe_text(payload.get("notes", ""), 500)
            if not name:
                raise ValueError("Inserisci il nome per la prenotazione: almeno 2 lettere.")
            if not phone:
                raise ValueError("Inserisci un numero di telefono valido, con almeno 6 cifre.")
            if not valid_date(day):
                raise ValueError("Scegli una data valida.")
            if service not in SERVICES:
                raise ValueError("Scegli pranzo o cena.")
            if not isinstance(slot_time, str) or not TIME_PATTERN.fullmatch(slot_time):
                raise ValueError("Scegli un orario valido.")
            if day > last_bookable_day() or not slot_is_future(day, slot_time):
                raise ValueError("Questo orario non è prenotabile online. Scegli un’altra data o un altro orario.")
            if isinstance(guests, bool) or not isinstance(guests, int) or guests < 1 or guests > MAX_GUESTS:
                raise ValueError("Per i gruppi più numerosi contatta direttamente lo stabilimento.")
            utm = payload.get("utm", {})
            if not isinstance(utm, dict):
                utm = {}
            utm_values = [safe_text(utm.get(key, ""), 150) for key in ("utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content")]
        except ValueError as error:
            self.send_json({"error": str(error)}, 400)
            return
        record_attempt(BOOKING_ATTEMPTS, ip)
        reference = new_reference()
        try:
            with open_db() as connection:
                connection.execute("BEGIN IMMEDIATE")
                error = capacity_error(connection, day, service, slot_time, guests)
                if error is None:
                    connection.execute(
                        "INSERT INTO reservations (reference, day, service, time, guests, customer_name, phone, notes, status, utm_source, utm_medium, utm_campaign, utm_term, utm_content, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ricevuta', ?, ?, ?, ?, ?, ?)",
                        (reference, day, service, slot_time, guests, name, phone, notes, *utm_values, local_now().isoformat(timespec="seconds")),
                    )
        except sqlite3.Error:
            self.send_json({"error": "Non è stato possibile salvare la prenotazione. Riprova."}, 500)
            return
        if error is not None:
            self.send_json({"error": error[1]}, error[0])
            return
        self.send_json({"reference": reference, "status": "ricevuta"}, 201)

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

    def do_PUT(self):
        path = urlparse(self.path).path
        if path == "/api/admin/slots":
            if self.require_admin():
                self.update_slots()
            return
        if path == "/api/admin/capacity":
            if self.require_admin():
                self.update_capacity()
            return
        self.send_json({"error": "Risorsa non trovata."}, 404)

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
        today = local_now().date().isoformat()
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
            if status not in STATUSES:
                raise ValueError("Stato della prenotazione non valido.")
        except ValueError as error:
            self.send_json({"error": str(error)}, 400)
            return
        reservation_id = int(match.group(1))
        error = None
        try:
            with open_db() as connection:
                # BEGIN IMMEDIATE: il controllo dei posti e l'aggiornamento avvengono senza prenotazioni concorrenti.
                connection.execute("BEGIN IMMEDIATE")
                reservation = connection.execute("SELECT * FROM reservations WHERE id = ?", (reservation_id,)).fetchone()
                if not reservation:
                    error = (404, "Prenotazione non trovata.")
                elif reservation["status"] == "annullata" and status != "annullata":
                    error = capacity_error(connection, reservation["day"], reservation["service"], reservation["time"], reservation["guests"], require_active=False)
                    if error and error[1] == "Questo orario non è più disponibile.":
                        error = (409, "Configura di nuovo questo orario prima di riattivare la prenotazione.")
                    elif error:
                        error = (409, "La capienza disponibile non basta per riattivare questa prenotazione.")
                if error is None:
                    connection.execute("UPDATE reservations SET status = ? WHERE id = ?", (status, reservation_id))
        except sqlite3.Error:
            self.send_json({"error": "Non è stato possibile aggiornare la prenotazione."}, 500)
            return
        if error is not None:
            self.send_json({"error": error[1]}, error[0])
            return
        self.send_json({"saved": True})


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
