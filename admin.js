/* Bagno Marè · area gestione (in italiano). */
(function () {
  "use strict";

  var root = document.documentElement;
  var $ = function (selector, scope) { return (scope || document).querySelector(selector); };
  var $$ = function (selector, scope) { return Array.prototype.slice.call((scope || document).querySelectorAll(selector)); };

  var loginSection = $("#adminLogin");
  var dashboard = $("#adminDashboard");
  var loginForm = $("#loginForm");
  var loginMessage = $("#loginMessage");
  var dateInput = $("#adminDate");
  var listEl = $("#reservationList");
  var logoutButton = $("#logoutButton");

  var STATUS_LABELS = { ricevuta: "Da verificare", confermata: "Confermata", annullata: "Rifiutata / annullata" };
  var SERVICE_LABELS = { pranzo: "Pranzo", cena: "Cena", tutto: "Tutto il giorno" };
  var WEEKDAYS = ["lun", "mar", "mer", "gio", "ven", "sab", "dom"];
  var WEEKDAYS_LONG = ["lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato", "domenica"];
  var HOUR_ROWS = [["spiaggia", "Spiaggia"], ["colazione", "Colazione"], ["pranzo", "Pranzo"], ["aperitivo", "Aperitivo"], ["cena", "Cena"]];
  var LANG_LABELS = { it: "IT", en: "EN", de: "DE" };
  var REASON_LABELS = { closure: "chiusura impostata", weekly: "giorno di riposo", season: "fuori stagione" };
  var state = { date: null, filter: "tutte", query: "", reservations: [], refreshTimer: null, followUp: null, config: null };

  /* ---------- Utilità ---------- */
  function pad(value) { return String(value).padStart(2, "0"); }
  function toISO(date) { return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate()); }
  function fromISO(value) { var p = value.split("-").map(Number); return new Date(p[0], p[1] - 1, p[2], 12); }
  function addDays(iso, days) { var d = fromISO(iso); d.setDate(d.getDate() + days); return toISO(d); }
  function today() { return toISO(new Date()); }
  function capitalize(text) { return text.charAt(0).toUpperCase() + text.slice(1); }
  function normalize(text) { return String(text || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(); }
  var fmtLong = new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  var fmtShortDay = new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "numeric", month: "long" });
  var fmtDow = new Intl.DateTimeFormat("it-IT", { weekday: "short" });
  var fmtTime = new Intl.DateTimeFormat("it-IT", { hour: "2-digit", minute: "2-digit" });

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function icon(name) {
    var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "icon");
    svg.setAttribute("aria-hidden", "true");
    var use = document.createElementNS("http://www.w3.org/2000/svg", "use");
    use.setAttribute("href", "#i-" + name);
    svg.append(use);
    return svg;
  }

  async function api(path, options) {
    var response;
    try {
      response = await fetch(path, Object.assign({ headers: { Accept: "application/json" }, credentials: "same-origin" }, options || {}));
    } catch (_) {
      var offline = new Error("Non riesco a contattare il server. Controlla la connessione.");
      offline.status = 0;
      throw offline;
    }
    var data = {};
    try { data = await response.json(); } catch (_) { data = {}; }
    if (!response.ok) {
      var error = new Error(data.error || "La richiesta non è riuscita.");
      error.status = response.status;
      throw error;
    }
    return data;
  }
  function jsonOptions(method, body) {
    return { method: method, headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(body) };
  }

  var toastEl = $("#toast");
  var toastTimer;
  function toast(message) {
    toastEl.textContent = message;
    toastEl.classList.add("is-visible");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () { toastEl.classList.remove("is-visible"); }, 2600);
  }
  function setAlert(element, message, kind) {
    element.textContent = message || "";
    element.hidden = !message;
    element.classList.toggle("is-success", kind === "success");
  }

  /* ---------- Tema ---------- */
  var themeToggle = $("#themeToggle");
  function applyTheme(theme, persist) {
    root.dataset.theme = theme;
    var dark = theme === "dark";
    themeToggle.setAttribute("aria-pressed", String(dark));
    themeToggle.setAttribute("aria-label", dark ? "Passa al tema chiaro" : "Passa al tema scuro");
    $('meta[name="theme-color"]').setAttribute("content", dark ? "#1c1d2b" : "#edf2f4");
    if (persist) { try { localStorage.setItem("mare-theme", theme); } catch (_) {} }
  }
  applyTheme(root.dataset.theme === "dark" ? "dark" : "light", false);
  themeToggle.addEventListener("click", function () { applyTheme(root.dataset.theme === "dark" ? "light" : "dark", true); });

  /* ---------- Accesso ---------- */
  var passwordInput = $("#adminPassword");
  var usernameInput = $("#adminUsername");
  var passwordToggle = $("#passwordToggle");
  passwordToggle.addEventListener("click", function () {
    var show = passwordInput.type === "password";
    passwordInput.type = show ? "text" : "password";
    passwordToggle.setAttribute("aria-pressed", String(show));
    $("span", passwordToggle).textContent = show ? "Nascondi" : "Mostra";
    $("use", passwordToggle).setAttribute("href", show ? "#i-eye-off" : "#i-eye");
  });

  function showLogin(message, kind) {
    stopRefresh();
    dashboard.hidden = true;
    loginSection.hidden = false;
    logoutButton.hidden = true;
    setAlert(loginMessage, message, kind);
  }

  function showDashboard() {
    loginSection.hidden = true;
    dashboard.hidden = false;
    logoutButton.hidden = false;
    if (!state.date) state.date = today();
    dateInput.value = state.date;
    loadDay({ forms: true });
    loadOpening();
    startRefresh();
  }

  [usernameInput, passwordInput].forEach(function (input) {
    input.addEventListener("input", function () { input.removeAttribute("aria-invalid"); });
  });

  loginForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    var username = usernameInput.value.trim();
    var password = passwordInput.value;
    if (!username || !password) {
      if (!username) usernameInput.setAttribute("aria-invalid", "true");
      if (!password) passwordInput.setAttribute("aria-invalid", "true");
      setAlert(loginMessage, "Inserisci nome utente e password.");
      (username ? passwordInput : usernameInput).focus();
      return;
    }
    var button = $("#loginSubmit");
    button.disabled = true;
    button.classList.add("is-loading");
    setAlert(loginMessage, "");
    try {
      await api("/api/admin/login", jsonOptions("POST", { username: username, password: password }));
      passwordInput.value = "";
      showDashboard();
      $("#adminMain").focus({ preventScroll: true });
    } catch (error) {
      if (error.status === 401) {
        usernameInput.setAttribute("aria-invalid", "true");
        passwordInput.setAttribute("aria-invalid", "true");
      }
      setAlert(loginMessage, error.message);
      passwordInput.focus();
      passwordInput.select();
    } finally {
      button.disabled = false;
      button.classList.remove("is-loading");
    }
  });

  logoutButton.addEventListener("click", async function () {
    try { await api("/api/admin/logout", jsonOptions("POST", {})); } catch (_) {}
    showLogin("Sei uscito dall’area gestione.", "success");
    usernameInput.focus();
  });

  function handleAuthError(error) {
    if (error.status === 401) {
      showLogin("La sessione è scaduta. Accedi di nuovo.");
      return true;
    }
    return false;
  }

  /* ---------- Caricamento del giorno ---------- */
  var loadToken = 0;
  async function loadDay(options) {
    options = options || {};
    var token = ++loadToken;
    var query = "?date=" + encodeURIComponent(state.date);
    if (options.forms) listEl.setAttribute("aria-busy", "true");
    try {
      var responses = await Promise.all([
        api("/api/admin/overview" + query),
        api("/api/admin/upcoming?from=" + today()),
        options.forms ? api("/api/admin/config" + query) : Promise.resolve(null)
      ]);
      if (token !== loadToken) return;
      renderTitle();
      renderUpcoming(responses[1].days, responses[1].closed || {});
      renderStats(responses[0]);
      renderOccupancy(responses[0].slots);
      state.reservations = responses[0].reservations;
      renderReservations();
      if (responses[2]) {
        state.config = responses[2];
        renderDayState(responses[2]);
        renderCapacityEditor(responses[2]);
        renderSlotRows(responses[2].slots);
      }
      $("#adminUpdated").textContent = "Ultimo aggiornamento: " + fmtTime.format(new Date());
      scheduleFollowUp();
    } catch (error) {
      if (handleAuthError(error)) return;
      listEl.replaceChildren(el("p", "res__empty", error.message));
    } finally {
      if (token === loadToken) listEl.setAttribute("aria-busy", "false");
    }
  }

  // Se un messaggio è in invio, ricarica tra poco per mostrare l'esito.
  function scheduleFollowUp() {
    window.clearTimeout(state.followUp);
    var pending = state.reservations.some(function (r) { return r.notify_state === "in_corso"; });
    if (pending) state.followUp = window.setTimeout(function () { loadDay({ forms: false }); }, 2500);
  }

  function startRefresh() {
    stopRefresh();
    state.refreshTimer = window.setInterval(function () {
      if (document.visibilityState === "visible" && !dashboard.hidden) loadDay({ forms: false });
    }, 60000);
  }
  function stopRefresh() {
    window.clearInterval(state.refreshTimer);
    window.clearTimeout(state.followUp);
  }

  function setDate(iso) {
    if (!iso) return;
    state.date = iso;
    dateInput.value = iso;
    loadDay({ forms: true });
  }
  dateInput.addEventListener("change", function () { setDate(dateInput.value); });
  $("#prevDay").addEventListener("click", function () { setDate(addDays(state.date, -1)); });
  $("#nextDay").addEventListener("click", function () { setDate(addDays(state.date, 1)); });
  $("#todayButton").addEventListener("click", function () { setDate(today()); });
  $("#refreshButton").addEventListener("click", function () { loadDay({ forms: false }); toast("Elenco aggiornato"); });

  function renderTitle() {
    var label = capitalize(fmtLong.format(fromISO(state.date)));
    $("#dashTitle").textContent = state.date === today() ? "Oggi, " + label.charAt(0).toLowerCase() + label.slice(1) : label;
    document.title = label + " | Gestione Marè";
  }

  /* ---------- Stato del giorno e chiusure ---------- */
  function renderDayState(config) {
    var status = config.dayStatus;
    var lunch = status.pranzo;
    var dinner = status.cena;
    var text;
    if (lunch.open && dinner.open) {
      text = "Aperto a pranzo e a cena.";
    } else if (!lunch.open && !dinner.open) {
      text = "Chiuso tutto il giorno" + (lunch.reason === dinner.reason ? " (" + REASON_LABELS[lunch.reason] + ")" : "") + ". Il sito non accetta prenotazioni.";
    } else {
      var closedService = lunch.open ? "cena" : "pranzo";
      var reason = (lunch.open ? dinner : lunch).reason;
      text = "Chiuso a " + closedService + " (" + REASON_LABELS[reason] + "), aperto a " + (lunch.open ? "pranzo" : "cena") + ".";
    }
    $("#dayStateText").textContent = text;
    $("#dayState").classList.toggle("is-closed", !lunch.open || !dinner.open);
    var list = $("#dayClosures");
    list.replaceChildren();
    config.closures.forEach(function (closure) {
      var item = el("li", "daystate__closure");
      item.append(el("span", "", "Chiusura: " + SERVICE_LABELS[closure.service].toLowerCase() + (closure.note ? " · " + closure.note : "")));
      var reopen = el("button", "inline-link", "Riapri");
      reopen.type = "button";
      reopen.setAttribute("aria-label", "Togli la chiusura: " + SERVICE_LABELS[closure.service].toLowerCase());
      reopen.addEventListener("click", async function () {
        reopen.disabled = true;
        try {
          await api("/api/admin/closures/" + closure.id, { method: "DELETE", headers: { Accept: "application/json" } });
          toast("Chiusura tolta");
          await loadDay({ forms: true });
        } catch (error) {
          if (handleAuthError(error)) return;
          reopen.disabled = false;
          toast(error.message);
        }
      });
      item.append(reopen);
      list.append(item);
    });
  }

  var closureDialog = $("#closureDialog");
  function activeCount(service) {
    return state.reservations.filter(function (r) {
      return r.status !== "annullata" && (service === "tutto" || r.service === service);
    }).length;
  }
  function updateClosureWarning() {
    var service = $('input[name="closureService"]:checked').value;
    var count = activeCount(service);
    var warning = $("#closureWarning");
    warning.hidden = !count;
    if (count) {
      warning.textContent = (count === 1 ? "C’è 1 prenotazione attiva" : "Ci sono " + count + " prenotazioni attive") +
        (service === "tutto" ? " in questo giorno" : " a " + service) +
        ". Restano nell’elenco: per avvisare i clienti, rifiutale una per una dopo la chiusura.";
    }
  }
  $("#closeDayButton").addEventListener("click", function () {
    $("#closureDate").textContent = capitalize(fmtLong.format(fromISO(state.date))) + ". Il calendario del sito mostrerà il giorno come chiuso.";
    $("#closureNote").value = "";
    setAlert($("#closureMessage"), "");
    updateClosureWarning();
    closureDialog.showModal();
  });
  $$('input[name="closureService"]').forEach(function (radio) { radio.addEventListener("change", updateClosureWarning); });
  $("#closureCancel").addEventListener("click", function () { closureDialog.close(); });
  $("#closureForm").addEventListener("submit", async function (event) {
    event.preventDefault();
    var service = $('input[name="closureService"]:checked').value;
    try {
      var result = await api("/api/admin/closures", jsonOptions("POST", { day: state.date, service: service, note: $("#closureNote").value.trim() }));
      closureDialog.close();
      toast(result.activeReservations ? "Giorno chiuso. Restano " + result.activeReservations + " prenotazioni da gestire." : "Giorno chiuso sul sito");
      await loadDay({ forms: true });
    } catch (error) {
      if (handleAuthError(error)) return;
      setAlert($("#closureMessage"), error.message);
    }
  });

  /* ---------- Prossimi 14 giorni ---------- */
  function renderUpcoming(days, closed) {
    var list = $("#upcomingList");
    var byDay = {};
    days.forEach(function (day) { byDay[day.day] = day; });
    var start = today();
    var maxGuests = Math.max(20, Math.max.apply(null, days.map(function (day) { return day.guests; }).concat([0])));
    list.replaceChildren();
    for (var i = 0; i < 14; i++) {
      var iso = addDays(start, i);
      var info = byDay[iso] || { guests: 0, bookings: 0, pending: 0 };
      var closedServices = closed[iso] || [];
      var li = document.createElement("li");
      var button = el("button", "day-tile" + (closedServices.length === 2 ? " is-closed" : closedServices.length ? " is-partial" : ""));
      button.type = "button";
      button.dataset.date = iso;
      if (iso === state.date) button.setAttribute("aria-current", "date");
      var date = fromISO(iso);
      var closedText = closedServices.length === 2 ? "chiuso" : closedServices.length ? "chiuso a " + closedServices[0] : "";
      var description = capitalize(fmtLong.format(date)) + ": " + (closedText ? closedText + ", " : "") + info.guests + " coperti, " + info.bookings + " prenotazioni" + (info.pending ? ", " + info.pending + " da verificare" : "");
      button.setAttribute("aria-label", description);
      var dow = el("span", "day-tile__dow", i === 0 ? "Oggi" : fmtDow.format(date).replace(".", ""));
      var num = el("span", "day-tile__num", String(date.getDate()));
      var bar = el("span", "day-tile__bar");
      var fill = el("span");
      fill.style.width = Math.min(100, Math.round((info.guests / maxGuests) * 100)) + "%";
      bar.append(fill);
      var meta = el("span", "day-tile__meta");
      if (closedServices.length === 2) meta.append(el("span", "day-tile__closed", "Chiuso"));
      else if (closedServices.length) meta.append(el("span", "day-tile__closed", "Solo " + (closedServices[0] === "pranzo" ? "cena" : "pranzo")));
      else meta.append(el("span", "", info.guests + " cop."));
      if (info.pending) {
        var dot = el("span", "day-tile__pending");
        dot.setAttribute("aria-hidden", "true");
        meta.append(dot);
      }
      button.append(dow, num, bar, meta);
      li.append(button);
      list.append(li);
    }
    // Porta in vista il giorno selezionato scorrendo solo la striscia, non la pagina.
    var current = $('[aria-current="date"]', list);
    if (current && list.scrollWidth > list.clientWidth) {
      var tile = current.parentElement;
      var left = tile.offsetLeft;
      if (left < list.scrollLeft || left + tile.offsetWidth > list.scrollLeft + list.clientWidth) {
        list.scrollLeft = Math.max(0, left - (list.clientWidth - tile.offsetWidth) / 2);
      }
    }
  }
  $("#upcomingList").addEventListener("click", function (event) {
    var tile = event.target.closest(".day-tile");
    if (tile) setDate(tile.dataset.date);
  });

  /* ---------- Numeri del giorno ---------- */
  function renderStats(overview) {
    var stats = $("#stats");
    var active = overview.reservations.filter(function (r) { return r.status !== "annullata"; });
    var pending = active.filter(function (r) { return r.status === "ricevuta"; }).length;
    var slotRemaining = overview.slots.reduce(function (sum, slot) { return sum + slot.remaining; }, 0);
    var free = overview.dailyRemaining === null ? slotRemaining : Math.min(overview.dailyRemaining, slotRemaining);
    var items = [
      ["Prenotazioni", String(active.length), pending ? pending + " da verificare" : ""],
      ["Coperti prenotati", String(overview.totalBooked), ""],
      ["Capienza del giorno", overview.dailyCapacity === null ? "Libera" : String(overview.dailyCapacity), overview.dailyCapacity === null ? "solo limiti per orario" : ""],
      ["Coperti liberi", String(free), ""]
    ];
    stats.replaceChildren();
    items.forEach(function (item) {
      var wrapper = el("div");
      var dd = el("dd", "", item[1]);
      if (item[2]) dd.append(el("small", "", item[2]));
      wrapper.append(el("dt", "", item[0]), dd);
      stats.append(wrapper);
    });
  }

  /* ---------- Occupazione per orario ---------- */
  function renderOccupancy(slots) {
    var box = $("#occupancy");
    box.replaceChildren();
    if (!slots.length) {
      box.append(el("p", "hint", "Nessun orario attivo. Aggiungili in fondo alla pagina."));
      return;
    }
    ["pranzo", "cena"].forEach(function (service) {
      var group = slots.filter(function (slot) { return slot.service === service; });
      if (!group.length) return;
      var section = el("div", "occupancy__group");
      section.append(el("h3", "", SERVICE_LABELS[service]));
      group.forEach(function (slot) {
        var row = el("div", "occ");
        var bar = el("div", "occ__bar" + (slot.remaining === 0 ? " is-full" : ""));
        bar.setAttribute("role", "img");
        bar.setAttribute("aria-label", slot.booked + " coperti prenotati su " + slot.capacity);
        var fill = el("span");
        fill.style.width = (slot.capacity ? Math.min(100, Math.round((slot.booked / slot.capacity) * 100)) : 0) + "%";
        bar.append(fill);
        row.append(el("span", "occ__time", slot.time), bar, el("span", "occ__count", slot.booked + " / " + slot.capacity));
        section.append(row);
      });
      box.append(section);
    });
  }

  /* ---------- Elenco prenotazioni ---------- */
  function visibleReservations() {
    var query = normalize(state.query);
    return state.reservations.filter(function (r) {
      if (state.filter !== "tutte" && r.status !== state.filter) return false;
      if (!query) return true;
      return normalize([r.customer_name, r.phone, r.email, r.reference, r.notes].join(" ")).indexOf(query) !== -1;
    });
  }

  function updateTabs() {
    var counts = { tutte: state.reservations.length, ricevuta: 0, confermata: 0, annullata: 0 };
    state.reservations.forEach(function (r) { counts[r.status] = (counts[r.status] || 0) + 1; });
    $$(".tab").forEach(function (tab) {
      var key = tab.dataset.filter;
      var small = $("small", tab) || el("small");
      small.textContent = String(counts[key] || 0);
      if (!small.parentElement) tab.append(small);
      tab.setAttribute("aria-pressed", String(key === state.filter));
    });
  }

  // Esito dell'ultimo messaggio al cliente, con "Invia di nuovo" se qualcosa non è andato.
  function notifyLine(r) {
    var box = el("div", "res__notify");
    var stateName = r.notify_state;
    if (!stateName) return null;
    var when = r.notify_at ? " alle " + r.notify_at.slice(11, 16) : "";
    var channelText = r.notify_channel === "email" ? "Email" : "SMS";
    if (stateName === "in_corso") {
      box.classList.add("is-pending");
      box.append(icon("clock"), el("span", "", "Messaggio in invio…"));
    } else if (stateName === "inviato") {
      box.classList.add("is-sent");
      box.append(icon("check"), el("span", "", channelText + (r.notify_channel === "email" ? " inviata" : " inviato") + when));
      box.title = "Destinatario: " + r.notify_to;
    } else {
      box.classList.add(stateName === "errore" ? "is-error" : "is-skipped");
      box.append(icon(stateName === "errore" ? "alert" : "dash"), el("span", "", stateName === "errore" ? "Invio non riuscito" + when : "Nessun messaggio"));
      if (r.notify_error) box.title = r.notify_error;
      var detail = el("span", "res__notify-detail", r.notify_error);
      box.append(detail);
      var canRetry = stateName === "errore" || (stateName === "non_inviato" && r.notifyPreview && r.notifyPreview.channel);
      if (canRetry && r.status !== "ricevuta") {
        var retry = el("button", "inline-link", "Invia di nuovo");
        retry.type = "button";
        retry.addEventListener("click", async function () {
          retry.disabled = true;
          try {
            await api("/api/admin/reservations/" + r.id + "/notify", jsonOptions("POST", {}));
            toast("Messaggio in invio");
            await loadDay({ forms: false });
          } catch (error) {
            if (handleAuthError(error)) return;
            retry.disabled = false;
            toast(error.message);
          }
        });
        box.append(retry);
      }
    }
    return box;
  }

  function renderReservations() {
    updateTabs();
    var items = visibleReservations();
    var total = state.reservations.length;
    $("#bookingCount").textContent = items.length === total
      ? total + (total === 1 ? " prenotazione" : " prenotazioni")
      : items.length + " su " + total;
    listEl.replaceChildren();
    if (!items.length) {
      listEl.append(el("p", "res__empty", total ? "Nessuna prenotazione corrisponde ai filtri." : "Nessuna prenotazione per questa data."));
      return;
    }
    items.forEach(function (r) {
      var row = el("article", "res__row" + (r.status === "annullata" ? " is-cancelled" : ""));
      var time = el("p", "res__time", r.time);
      time.append(el("small", "", SERVICE_LABELS[r.service]));

      var who = el("div", "res__who");
      var name = el("strong", "", r.customer_name || "Nome non indicato");
      if (r.lang && r.lang !== "it") name.append(el("span", "res__lang", LANG_LABELS[r.lang] || r.lang.toUpperCase()));
      who.append(name);
      if (r.phone) {
        var phone = el("a");
        phone.href = "tel:" + r.phone;
        phone.append(icon("phone"), document.createTextNode(r.phone));
        who.append(phone);
      }
      if (r.email) {
        var email = el("a");
        email.href = "mailto:" + r.email;
        email.append(icon("mail"), document.createTextNode(r.email));
        who.append(email);
      }
      who.append(el("p", "res__code", r.reference + (r.consent ? "" : " · senza consenso ai messaggi")));

      var guests = el("p", "res__guests");
      guests.append(el("strong", "", String(r.guests)), document.createTextNode(r.guests === 1 ? "persona" : "persone"));

      var notes = el("div", "res__notes");
      if (r.notes) notes.append(el("q", "", r.notes));
      else notes.textContent = "Nessuna nota";
      if (r.status === "annullata" && r.status_reason) notes.append(el("p", "res__source", "Motivo: " + r.status_reason));
      if (r.utm_source || r.utm_campaign || r.utm_medium) {
        notes.append(el("p", "res__source", "Arrivata da " + [r.utm_source, r.utm_medium, r.utm_campaign].filter(Boolean).join(" · ")));
      }

      var statusWrap = el("div", "res__status");
      var statusRow = el("div", "res__status-row");
      var dot = el("span", "status-dot status-dot--" + r.status);
      dot.setAttribute("aria-hidden", "true");
      var select = document.createElement("select");
      select.setAttribute("aria-label", "Stato della prenotazione di " + (r.customer_name || r.reference));
      Object.keys(STATUS_LABELS).forEach(function (key) {
        var option = el("option", "", STATUS_LABELS[key]);
        option.value = key;
        option.selected = key === r.status;
        select.append(option);
      });
      select.addEventListener("change", function () { changeStatus(r, select); });
      statusRow.append(dot, select);
      statusWrap.append(statusRow);
      var notify = notifyLine(r);
      if (notify) statusWrap.append(notify);

      row.append(time, who, guests, notes, statusWrap);
      listEl.append(row);
    });
  }

  $("#statusTabs").addEventListener("click", function (event) {
    var tab = event.target.closest(".tab");
    if (!tab) return;
    state.filter = tab.dataset.filter;
    renderReservations();
  });
  var searchTimer;
  $("#reservationSearch").addEventListener("input", function (event) {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(function () {
      state.query = event.target.value;
      renderReservations();
    }, 120);
  });

  /* Conferma prima di cambiare stato: dice anche a chi partirà il messaggio. */
  var confirmDialog = $("#confirmDialog");
  function previewText(r, next) {
    if (next === r.notified_status) return "Il cliente è già stato avvisato di questo stato: non parte un nuovo messaggio.";
    var preview = r.notifyPreview || {};
    if (preview.channel === "email") return "Invieremo un’email a " + preview.to + ".";
    if (preview.channel === "sms") return "Invieremo un SMS al " + preview.to + ".";
    if (preview.reason === "no_consent") return "Nessun messaggio: il cliente non ha dato il consenso. Avvisalo al telefono " + r.phone + ".";
    return "Nessun messaggio: email e SMS non sono ancora configurati sul server. Avvisa il cliente al telefono " + r.phone + ".";
  }
  function askConfirm(r, next) {
    var who = (r.customer_name || r.reference) + ", " + r.guests + (r.guests === 1 ? " persona" : " persone") + " alle " + r.time;
    var copy;
    if (next === "confermata") {
      copy = { title: "Confermare la prenotazione?", text: who + ". Il cliente riceve “Prenotazione confermata” con giorno, ora, persone, codice e indirizzo.", button: "Conferma", danger: false };
    } else if (r.status === "confermata") {
      copy = { title: "Annullare la prenotazione?", text: who + ". I coperti tornano disponibili e il cliente riceve “Prenotazione annullata” con il numero da chiamare.", button: "Annulla la prenotazione", danger: true };
    } else {
      copy = { title: "Rifiutare la richiesta?", text: who + ". I coperti tornano disponibili e il cliente riceve “Non possiamo accoglierti” con l’invito a scegliere un’altra data.", button: "Rifiuta", danger: true };
    }
    return new Promise(function (resolve) {
      $("#confirmTitle").textContent = copy.title;
      $("#confirmText").textContent = copy.text;
      $("#confirmNotify").textContent = previewText(r, next);
      $("#confirmReasonField").hidden = next !== "annullata";
      $("#confirmReason").value = "";
      var yesButton = $("#confirmYes");
      $(".btn__label", yesButton).textContent = copy.button;
      yesButton.classList.toggle("btn--danger", copy.danger);
      yesButton.classList.toggle("btn--solid", !copy.danger);
      confirmDialog.showModal();
      $("#confirmNo").focus();
      function done(result) {
        confirmDialog.close();
        yesButton.removeEventListener("click", yes);
        $("#confirmNo").removeEventListener("click", no);
        confirmDialog.removeEventListener("cancel", no);
        resolve(result);
      }
      function yes() { done({ ok: true, reason: $("#confirmReason").value.trim() }); }
      function no(event) { if (event) event.preventDefault(); done({ ok: false }); }
      yesButton.addEventListener("click", yes);
      $("#confirmNo").addEventListener("click", no);
      confirmDialog.addEventListener("cancel", no);
    });
  }

  async function changeStatus(reservation, select) {
    var previous = reservation.status;
    var next = select.value;
    var reason = "";
    if (next === "confermata" || next === "annullata") {
      var answer = await askConfirm(reservation, next);
      if (!answer.ok) { select.value = previous; select.focus(); return; }
      reason = answer.reason || "";
    }
    select.disabled = true;
    try {
      var result = await api("/api/admin/reservations/" + reservation.id, jsonOptions("PATCH", { status: next, reason: reason }));
      toast("Stato aggiornato: " + STATUS_LABELS[next].toLowerCase() + (result.notify ? ". Messaggio in invio" : ""));
      await loadDay({ forms: false });
    } catch (error) {
      if (handleAuthError(error)) return;
      select.value = previous;
      select.disabled = false;
      toast(error.message);
    }
  }

  /* Esportazione e stampa */
  $("#printReservations").addEventListener("click", function () { window.print(); });
  $("#exportReservations").addEventListener("click", function () {
    var headers = ["Data", "Ora", "Servizio", "Persone", "Nome", "Telefono", "Email", "Lingua", "Codice", "Stato", "Motivo", "Messaggio", "Note", "Fonte"];
    var notifyLabels = { "": "", in_corso: "in invio", inviato: "inviato", errore: "errore", non_inviato: "non inviato" };
    var rows = visibleReservations().map(function (r) {
      return [r.day, r.time, r.service, r.guests, r.customer_name, r.phone, r.email, r.lang, r.reference, STATUS_LABELS[r.status] || r.status,
        r.status_reason, (notifyLabels[r.notify_state] || r.notify_state) + (r.notify_channel ? " (" + r.notify_channel + ")" : ""), r.notes,
        [r.utm_source, r.utm_medium, r.utm_campaign].filter(Boolean).join(" / ")];
    });
    var cell = function (value) {
      var text = String(value == null ? "" : value);
      if (/^[=+\-@]/.test(text.trimStart())) text = "'" + text;
      return '"' + text.replace(/"/g, '""') + '"';
    };
    var csv = "﻿" + [headers].concat(rows).map(function (row) { return row.map(cell).join(";"); }).join("\r\n");
    var url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    var link = document.createElement("a");
    link.href = url;
    link.download = "prenotazioni-" + state.date + ".csv";
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    toast("File CSV pronto");
  });

  /* ---------- Capienza del giorno ---------- */
  function renderCapacityEditor(config) {
    $("#dailyCapacity").value = config.dailyCapacity === null ? "" : String(config.dailyCapacity);
    var editor = $("#slotCapacityEditor");
    editor.replaceChildren();
    var active = config.slots.filter(function (slot) { return slot.active; });
    if (!active.length) {
      editor.append(el("p", "hint", "Aggiungi prima gli orari prenotabili."));
      return;
    }
    active.forEach(function (slot) {
      var row = el("div", "cap-row");
      var id = "cap-" + slot.id;
      var label = el("label", "", SERVICE_LABELS[slot.service] + " " + slot.time);
      label.htmlFor = id;
      label.append(el("small", "", slot.booked + " già prenotati · standard " + slot.capacity));
      var input = el("input", "input");
      input.type = "number";
      input.min = "1";
      input.max = "500";
      input.inputMode = "numeric";
      input.id = id;
      input.dataset.slotId = String(slot.id);
      input.placeholder = String(slot.capacity);
      input.value = slot.dayCapacity === null ? "" : String(slot.dayCapacity);
      row.append(label, input);
      editor.append(row);
    });
  }

  $("#capacityForm").addEventListener("submit", async function (event) {
    event.preventDefault();
    var message = $("#capacityMessage");
    var daily = $("#dailyCapacity").value.trim();
    var payload = {
      date: state.date,
      dailyCapacity: daily ? Number(daily) : null,
      slotCapacities: $$("#slotCapacityEditor input").map(function (input) {
        return { id: Number(input.dataset.slotId), capacity: input.value.trim() ? Number(input.value) : null };
      })
    };
    var invalid = [payload.dailyCapacity].concat(payload.slotCapacities.map(function (s) { return s.capacity; }))
      .some(function (value) { return value !== null && (!Number.isInteger(value) || value < 1 || value > 500); });
    if (invalid) {
      setAlert(message, "Usa numeri interi tra 1 e 500, oppure lascia il campo vuoto.");
      return;
    }
    try {
      await api("/api/admin/capacity", jsonOptions("PUT", payload));
      setAlert(message, "");
      toast("Capienze salvate");
      await loadDay({ forms: true });
    } catch (error) {
      if (handleAuthError(error)) return;
      setAlert(message, error.message);
    }
  });

  /* ---------- Apertura: stagione, orari, riposo, fuori stagione ---------- */
  function weekdayBoxes(container, name, selected) {
    container.replaceChildren();
    WEEKDAYS.forEach(function (label, index) {
      var wrapper = el("label", "weekday");
      var input = el("input");
      input.type = "checkbox";
      input.name = name;
      input.value = String(index + 1);
      input.checked = selected.indexOf(index + 1) !== -1;
      input.setAttribute("aria-label", WEEKDAYS_LONG[index]);
      wrapper.append(input, el("span", "", label));
      container.append(wrapper);
    });
  }
  function checkedDays(container) {
    return $$("input:checked", container).map(function (input) { return Number(input.value); });
  }

  function renderOpening(opening) {
    $("#openingDemo").hidden = Boolean(opening.confirmed);
    $("#restaurantStart").value = opening.restaurant.start;
    $("#restaurantEnd").value = opening.restaurant.end;
    $("#beachStart").value = opening.beach.start;
    $("#beachEnd").value = opening.beach.end;
    weekdayBoxes($("#weeklyClosed"), "weeklyClosed", opening.weeklyClosed);
    weekdayBoxes($("#offDays"), "offDays", opening.offSeason.days);
    $("#offEnabled").checked = opening.offSeason.enabled;
    $("#offLunch").checked = opening.offSeason.services.indexOf("pranzo") !== -1;
    $("#offDinner").checked = opening.offSeason.services.indexOf("cena") !== -1;
    var editor = $("#hoursEditor");
    editor.replaceChildren();
    HOUR_ROWS.forEach(function (pair) {
      var key = pair[0];
      var entry = opening.hours[key];
      var row = el("div", "hours-edit__row");
      row.dataset.key = key;
      var name = el("span", "hours-edit__name", pair[1] + (key === "pranzo" || key === "cena" ? "" : " (facoltativo)"));
      var open = el("input", "input");
      open.type = "time";
      open.value = entry ? entry.open : "";
      open.dataset.role = "open";
      open.setAttribute("aria-label", pair[1] + ": apertura");
      var close = el("input", "input");
      close.type = "time";
      close.value = entry ? entry.close : "";
      close.dataset.role = "close";
      close.setAttribute("aria-label", pair[1] + ": chiusura");
      row.append(name, open, el("span", "hours-edit__sep", "→"), close);
      editor.append(row);
    });
  }

  async function loadOpening() {
    try {
      var data = await api("/api/admin/opening");
      renderOpening(data.opening);
    } catch (error) {
      if (handleAuthError(error)) return;
      setAlert($("#openingMessage"), error.message);
    }
  }

  $("#openingForm").addEventListener("submit", async function (event) {
    event.preventDefault();
    var message = $("#openingMessage");
    var hours = {};
    var problem = "";
    $$(".hours-edit__row").forEach(function (row) {
      var open = $('[data-role="open"]', row).value;
      var close = $('[data-role="close"]', row).value;
      if (!open && !close) hours[row.dataset.key] = null;
      else if (!open || !close) problem = problem || "Per ogni servizio inserisci sia l’apertura sia la chiusura, oppure lascia entrambe vuote.";
      else hours[row.dataset.key] = { open: open, close: close };
    });
    if (problem) { setAlert(message, problem); return; }
    var payload = {
      restaurant: { start: $("#restaurantStart").value, end: $("#restaurantEnd").value },
      beach: { start: $("#beachStart").value, end: $("#beachEnd").value },
      weeklyClosed: checkedDays($("#weeklyClosed")),
      hours: hours,
      offSeason: {
        enabled: $("#offEnabled").checked,
        days: checkedDays($("#offDays")),
        services: [$("#offLunch"), $("#offDinner")].filter(function (input) { return input.checked; }).map(function (input) { return input.value; })
      }
    };
    try {
      var result = await api("/api/admin/opening", jsonOptions("PUT", payload));
      setAlert(message, "");
      renderOpening(result.opening);
      toast("Apertura salvata: il sito è aggiornato");
      await loadDay({ forms: true });
    } catch (error) {
      if (handleAuthError(error)) return;
      setAlert(message, error.message);
    }
  });

  /* ---------- Orari prenotabili ---------- */
  var slotRows = $("#slotRows");
  var rowCounter = 0;
  function createSlotRow(slot) {
    rowCounter += 1;
    var n = rowCounter;
    var row = el("div", "slot-row");
    if (slot && slot.id) row.dataset.slotId = String(slot.id);

    function field(labelText, control) {
      var wrapper = el("div", "field");
      control.id = "slot-" + labelText.toLowerCase() + "-" + n;
      var label = el("label", "", labelText);
      label.htmlFor = control.id;
      wrapper.append(label, control);
      return wrapper;
    }
    var service = el("select", "input");
    service.innerHTML = '<option value="pranzo">Pranzo</option><option value="cena">Cena</option>';
    service.value = slot ? slot.service : "pranzo";
    service.dataset.role = "service";
    var time = el("input", "input");
    time.type = "time";
    time.required = true;
    time.value = slot ? slot.time : "";
    time.dataset.role = "time";
    var capacity = el("input", "input");
    capacity.type = "number";
    capacity.min = "1";
    capacity.max = "500";
    capacity.inputMode = "numeric";
    capacity.required = true;
    capacity.value = slot ? String(slot.capacity) : "";
    capacity.dataset.role = "capacity";

    var activeLabel = el("label", "slot-row__active");
    var active = el("input");
    active.type = "checkbox";
    active.checked = slot ? slot.active : true;
    active.dataset.role = "active";
    activeLabel.append(active, document.createTextNode("Prenotabile"));

    var remove = el("button", "slot-row__remove", "Rimuovi");
    remove.type = "button";
    remove.addEventListener("click", function () { row.remove(); });

    row.append(field("Servizio", service), field("Orario", time), field("Coperti", capacity), activeLabel, remove);
    return row;
  }

  function renderSlotRows(slots) {
    slotRows.replaceChildren();
    if (!slots.length) {
      slotRows.append(el("p", "hint", "Nessun orario configurato. Aggiungi le fasce di pranzo e cena."));
      return;
    }
    slots.forEach(function (slot) { slotRows.append(createSlotRow(slot)); });
  }

  $("#addSlotButton").addEventListener("click", function () {
    var empty = $(".hint", slotRows);
    if (empty) empty.remove();
    var row = createSlotRow(null);
    slotRows.append(row);
    $('[data-role="time"]', row).focus();
  });

  $("#slotsForm").addEventListener("submit", async function (event) {
    event.preventDefault();
    var message = $("#slotsMessage");
    var slots = $$(".slot-row", slotRows).map(function (row) {
      return {
        id: row.dataset.slotId ? Number(row.dataset.slotId) : null,
        service: $('[data-role="service"]', row).value,
        time: $('[data-role="time"]', row).value,
        capacity: Number($('[data-role="capacity"]', row).value),
        active: $('[data-role="active"]', row).checked
      };
    });
    var broken = slots.find(function (slot) { return !slot.time || !Number.isInteger(slot.capacity) || slot.capacity < 1 || slot.capacity > 500; });
    if (broken) {
      setAlert(message, "Ogni orario ha bisogno di un’ora e di un numero di coperti tra 1 e 500.");
      return;
    }
    try {
      await api("/api/admin/slots", jsonOptions("PUT", { slots: slots }));
      setAlert(message, "");
      toast("Orari salvati");
      await loadDay({ forms: true });
    } catch (error) {
      if (handleAuthError(error)) return;
      setAlert(message, error.message);
    }
  });

  /* ---------- Avvio ---------- */
  (async function checkSession() {
    try {
      var session = await api("/api/admin/session");
      if (session.authenticated) showDashboard();
      else if (!session.configured) setAlert(loginMessage, "L’accesso non è ancora configurato: imposta MARE_ADMIN_USER e MARE_ADMIN_PASSWORD sul server.");
    } catch (_) {
      setAlert(loginMessage, "Non riesco a contattare il server. Apri questa pagina dal server del sito.");
    }
  })();
})();
