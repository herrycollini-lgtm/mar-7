/* Bagno Marè · script del sito pubblico (nessuna dipendenza esterna). I testi arrivano dal blocco #i18n della pagina. */
(function () {
  "use strict";

  var root = document.documentElement;
  var $ = function (selector, scope) { return (scope || document).querySelector(selector); };
  var $$ = function (selector, scope) { return Array.prototype.slice.call((scope || document).querySelectorAll(selector)); };
  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  var CONTACT_PHONE = "333 105 9588";

  /* ---------- Lingua ---------- */
  var I18N = {};
  try { I18N = JSON.parse($("#i18n").textContent); } catch (_) { I18N = {}; }
  var LANG = I18N.lang || root.lang || "it";
  var LOCALE = I18N.locale || "it-IT";

  // t("booking.from", { time: "12:30" }) restituisce il testo della lingua con i segnaposto sostituiti.
  function t(path, vars) {
    var value = path.split(".").reduce(function (node, key) { return node && node[key] !== undefined ? node[key] : undefined; }, I18N);
    if (typeof value !== "string") return path;
    if (!vars) return value;
    return value.replace(/\{(\w+)\}/g, function (match, key) { return vars[key] !== undefined ? vars[key] : match; });
  }

  /* ---------- Utilità ---------- */
  function pad(value) { return String(value).padStart(2, "0"); }
  function toISO(date) { return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate()); }
  function fromISO(value) {
    var parts = value.split("-").map(Number);
    return new Date(parts[0], parts[1] - 1, parts[2], 12);
  }
  function addDays(iso, days) {
    var date = fromISO(iso);
    date.setDate(date.getDate() + days);
    return toISO(date);
  }
  function daysBetween(fromIso, toIso) { return Math.round((fromISO(toIso) - fromISO(fromIso)) / 86400000); }
  var fmtLong = new Intl.DateTimeFormat(LOCALE, { weekday: "long", day: "numeric", month: "long" });
  var fmtShort = new Intl.DateTimeFormat(LOCALE, { weekday: "short", day: "numeric", month: "long" });
  var fmtMonth = new Intl.DateTimeFormat(LOCALE, { month: "long", year: "numeric" });
  var fmtDayMonth = new Intl.DateTimeFormat(LOCALE, { day: "numeric", month: "long" });
  var fmtWeekday = new Intl.DateTimeFormat(LOCALE, { weekday: "long" });
  function capitalize(text) { return text.charAt(0).toUpperCase() + text.slice(1); }
  function wait(ms) { return new Promise(function (resolve) { window.setTimeout(resolve, ms); }); }
  function normalize(text) { return String(text || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(); }
  // Versione tollerante per la ricerca: lettere doppie ridotte ("brodetto" = "brodeto").
  function loose(text) { return normalize(text).replace(/([a-z])\1+/g, "$1"); }
  // Radice approssimativa di una parola: senza vocali finali ("doccia" → "doc", "calde" → "cald").
  function stem(token) {
    var base = loose(token);
    var cut = base.replace(/[aeiou]+$/, "");
    return cut.length >= 3 ? cut : base;
  }
  function escapeHTML(text) {
    return String(text).replace(/[&<>"']/g, function (char) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char];
    });
  }
  function scrollBehavior() { return reducedMotion.matches ? "auto" : "smooth"; }
  // "08:30" → "8:30"
  function clock(value) { return value ? value.replace(/^0(\d)/, "$1") : ""; }
  function isoWeekdayName(day) { return fmtWeekday.format(fromISO(addDays("2024-01-01", day - 1))); }
  function joinList(items) {
    if (items.length < 2) return items.join("");
    return items.slice(0, -1).join(", ") + t("hours.and") + items[items.length - 1];
  }

  async function api(path, options) {
    var response;
    try {
      response = await fetch(path, Object.assign({ headers: { Accept: "application/json" } }, options || {}));
    } catch (_) {
      var networkError = new Error(t("network_error"));
      networkError.status = 0;
      throw networkError;
    }
    var data = {};
    try { data = await response.json(); } catch (_) { data = {}; }
    if (!response.ok) {
      var error = new Error(data.error || t("request_failed"));
      error.status = response.status;
      error.code = data.code || "";
      throw error;
    }
    return data;
  }
  // Messaggio d'errore del server nella lingua della pagina, se il codice è noto.
  function errorText(error) {
    if (error.code) {
      var translated = t("booking.codes." + error.code);
      if (translated.indexOf("booking.codes.") !== 0) return translated;
    }
    return error.message;
  }

  var toastEl = $("#toast");
  var toastTimer;
  function toast(message) {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.classList.add("is-visible");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () { toastEl.classList.remove("is-visible"); }, 2400);
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (_) {
      var area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.append(area);
      area.select();
      var ok = false;
      try { ok = document.execCommand("copy"); } catch (__) { ok = false; }
      area.remove();
      return ok;
    }
  }

  /* ---------- Dialoghi: blocco dello scorrimento e chiusura sullo sfondo ---------- */
  function syncScrollLock() {
    root.classList.toggle("is-locked", $$("dialog[open]").length > 0);
  }
  function openDialog(dialog) {
    if (!dialog || dialog.open) return;
    dialog.showModal();
    syncScrollLock();
  }
  function closeDialog(dialog) {
    if (!dialog || !dialog.open) return;
    dialog.close();
    syncScrollLock();
  }
  $$("dialog").forEach(function (dialog) {
    dialog.addEventListener("close", syncScrollLock);
    dialog.addEventListener("click", function (event) {
      if (event.target === dialog && dialog.id !== "bookingDrawer") closeDialog(dialog);
    });
    $$("[data-close]", dialog).forEach(function (button) {
      button.addEventListener("click", function () {
        if (dialog.id === "bookingDrawer") closeBooking();
        else closeDialog(dialog);
      });
    });
  });

  /* ---------- Tema chiaro / scuro ---------- */
  var themeToggle = $("#themeToggle");
  function applyTheme(theme, persist) {
    root.dataset.theme = theme;
    var dark = theme === "dark";
    if (themeToggle) {
      themeToggle.setAttribute("aria-pressed", String(dark));
      themeToggle.setAttribute("aria-label", dark ? t("theme_to_light") : t("theme_to_dark"));
    }
    $$('meta[name="theme-color"]').forEach(function (meta) { meta.setAttribute("content", dark ? "#1c1d2b" : "#edf2f4"); });
    if (persist) {
      try { localStorage.setItem("mare-theme", theme); } catch (_) {}
    }
  }
  applyTheme(root.dataset.theme === "dark" ? "dark" : "light", false);
  if (themeToggle) {
    themeToggle.addEventListener("click", function () {
      applyTheme(root.dataset.theme === "dark" ? "light" : "dark", true);
    });
  }

  /* ---------- Selettore lingua e suggerimento alla prima visita ---------- */
  var pageSuffix = root.dataset.page === "privacy" ? "privacy.html" : "";
  function rememberLanguage(lang) {
    try { localStorage.setItem("mare-lang", lang); } catch (_) {}
  }
  $$("[data-lang-link]").forEach(function (link) {
    link.addEventListener("click", function (event) {
      rememberLanguage(link.dataset.langLink);
      if (window.location.hash && !pageSuffix) {
        event.preventDefault();
        window.location.href = link.getAttribute("href") + window.location.hash;
      }
    });
  });
  (function suggestLanguage() {
    var hint = $("#langHint");
    if (!hint || !I18N.suggest || !I18N.prefixes) return;
    var chosen = null;
    try { chosen = localStorage.getItem("mare-lang"); } catch (_) { return; }
    if (chosen) return;
    var preferred = null;
    (navigator.languages || [navigator.language || ""]).some(function (code) {
      var short = String(code).slice(0, 2).toLowerCase();
      if (I18N.prefixes[short]) { preferred = short; return true; }
      return false;
    });
    // Nessun reindirizzamento: solo un avviso discreto, nella lingua proposta.
    if (!preferred || preferred === LANG) return;
    var texts = I18N.suggest[preferred];
    $("#langHintText").textContent = texts.text;
    var link = $("#langHintLink");
    link.textContent = texts.action;
    link.href = I18N.prefixes[preferred] + pageSuffix;
    link.lang = preferred;
    $("#langHintText").lang = preferred;
    $("#langHintCloseLabel").textContent = texts.dismiss;
    link.addEventListener("click", function () { rememberLanguage(preferred); });
    $("#langHintClose").addEventListener("click", function () {
      rememberLanguage(LANG);
      hint.hidden = true;
    });
    window.setTimeout(function () { hint.hidden = false; }, root.classList.contains("is-loading") ? 2000 : 600);
  })();

  /* ---------- Intestazione, barra di avanzamento, torna su ---------- */
  var header = $("#siteHeader");
  var progressBar = $("#progressBar");
  var toTop = $("#toTop");
  var ticking = false;
  function onScroll() {
    var max = document.documentElement.scrollHeight - window.innerHeight;
    var progress = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
    if (progressBar) progressBar.style.setProperty("--progress", progress.toFixed(4));
    if (header && root.dataset.page === "site") header.classList.toggle("is-scrolled", window.scrollY > 8);
    if (toTop) toTop.classList.toggle("is-visible", window.scrollY > window.innerHeight * 0.8);
    ticking = false;
  }
  window.addEventListener("scroll", function () {
    if (!ticking) {
      ticking = true;
      window.requestAnimationFrame(onScroll);
    }
  }, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });
  onScroll();

  if (toTop) {
    toTop.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: scrollBehavior() });
      var mark = $(".site-header .wordmark");
      if (mark) mark.focus({ preventScroll: true });
    });
  }

  // Evidenzia nel menu la sezione in lettura.
  var navLinks = $$(".main-nav a");
  if ("IntersectionObserver" in window && navLinks.length) {
    var byId = {};
    navLinks.forEach(function (link) { byId[link.getAttribute("href").slice(1)] = link; });
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        navLinks.forEach(function (link) { link.removeAttribute("aria-current"); });
        var active = byId[entry.target.id];
        if (active) active.setAttribute("aria-current", "true");
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    Object.keys(byId).forEach(function (id) {
      var section = document.getElementById(id);
      if (section) spy.observe(section);
    });
  }

  /* ---------- Menu mobile ---------- */
  var mobileNav = $("#mobileNav");
  var menuOpen = $("#menuOpen");
  if (menuOpen && mobileNav) {
    menuOpen.addEventListener("click", function () { openDialog(mobileNav); });
    $$(".mnav__links a", mobileNav).forEach(function (link) {
      link.addEventListener("click", function (event) {
        var target = document.querySelector(link.getAttribute("href"));
        if (!target) return;
        event.preventDefault();
        closeDialog(mobileNav);
        history.pushState(null, "", link.getAttribute("href"));
        target.scrollIntoView({ behavior: scrollBehavior(), block: "start" });
      });
    });
  }

  /* ---------- Copia negli appunti ---------- */
  document.addEventListener("click", async function (event) {
    var button = event.target.closest("[data-copy], [data-copy-from]");
    if (!button) return;
    var text = button.dataset.copy;
    if (!text && button.dataset.copyFrom) {
      var source = $(button.dataset.copyFrom);
      text = source ? source.textContent.trim() : "";
    }
    if (!text) return;
    var ok = await copyText(text);
    var label = $("span", button);
    var icon = $("use", button);
    if (!ok) {
      toast(t("copy_fail"));
      return;
    }
    button.classList.add("is-copied");
    if (label) label.textContent = t("copied");
    if (icon) icon.setAttribute("href", "#i-check");
    toast(t("copy_done"));
    window.setTimeout(function () {
      button.classList.remove("is-copied");
      if (label) label.textContent = t("copy");
      if (icon) icon.setAttribute("href", "#i-copy");
    }, 2200);
  });

  /* ---------- Badge meteo nella hero ---------- */
  var WEATHER_KEYS = [
    [[0], "clear"], [[1], "mostly_clear"], [[2], "partly_cloudy"], [[3], "cloudy"],
    [[45, 48], "fog"], [[51, 53, 55, 56, 57], "drizzle"], [[61, 63, 65, 66, 67], "rain"],
    [[71, 73, 75, 77, 85, 86], "snow"], [[80, 81, 82], "showers"], [[95, 96, 99], "storm"]
  ];
  function weatherLabel(code, isDay) {
    if (code === 0 && !isDay) return t("weather.clear_night");
    for (var i = 0; i < WEATHER_KEYS.length; i++) {
      if (WEATHER_KEYS[i][0].indexOf(code) !== -1) return t("weather." + WEATHER_KEYS[i][1]);
    }
    return "";
  }
  var weatherText = $("#weatherText");
  if (weatherText) {
    api("/api/weather").then(function (data) {
      if (!data.available) return;
      var label = weatherLabel(data.code, data.isDay);
      weatherText.textContent = data.temperature + "°" + (label ? " " + label : "");
      if (typeof data.sea === "number") {
        var sea = document.createElement("span");
        sea.className = "hero__badge-sea";
        sea.textContent = " · " + t("weather.sea", { t: data.sea });
        weatherText.append(sea);
      }
      $("#weatherBadge").setAttribute("title", t("weather.title"));
    }).catch(function () { /* resta il testo statico */ });
  }

  /* ---------- Orari, stagione e stato di oggi ---------- */
  function formatRange(entry) { return entry ? t("hours.range", { a: clock(entry.open), b: clock(entry.close) }) : t("hours.not_offered"); }
  function whenText(iso, today) {
    var distance = daysBetween(today, iso);
    if (distance === 1) return t("status.tomorrow");
    if (distance > 1 && distance < 7) return t("status.on_weekday", { weekday: fmtWeekday.format(fromISO(iso)) });
    return t("status.on_date", { date: fmtDayMonth.format(fromISO(iso)) });
  }

  function renderStatus(data) {
    var text = $("#statusText");
    if (!text) return;
    var status = data.status;
    var bar = $("#statusBar");
    var message;
    if (status.open) {
      message = t(status.kind === "beach" ? "status.open_beach" : "status.open_kitchen", { time: clock(status.until) });
    } else if (status.nextOpen) {
      message = t(status.openToday ? "status.closed_now" : "status.closed_today", { when: whenText(status.nextOpen, data.today) });
    } else {
      message = t("status.closed_season");
    }
    text.textContent = message;
    bar.classList.toggle("is-open", status.open);
    bar.classList.toggle("is-closed", !status.open);
  }

  function renderHours(data) {
    $$("[data-hours-row]").forEach(function (row) {
      var entry = data.hours[row.dataset.hoursRow];
      row.hidden = !entry;
      $("td", row).textContent = formatRange(entry);
    });
    $$("time[data-hour]").forEach(function (time) {
      var entry = data.hours[time.dataset.hour];
      var stop = time.closest("li");
      if (stop) stop.hidden = !entry;
      if (entry) {
        time.textContent = clock(entry.open);
        time.setAttribute("datetime", entry.open);
      }
    });
    var beachHours = $("#beachHours");
    if (beachHours && data.hours.spiaggia) {
      var compact = function (value) { return /:00$/.test(value) ? String(Number(value.slice(0, 2))) : clock(value); };
      beachHours.textContent = compact(data.hours.spiaggia.open) + " / " + compact(data.hours.spiaggia.close);
    }
    $$("[data-service-from]").forEach(function (small) {
      var entry = data.hours[small.dataset.serviceFrom];
      if (entry) small.textContent = t("booking.from", { time: clock(entry.open) });
    });
    var season = $("#daySeason");
    if (season) {
      season.textContent = t("hours.day_season", {
        year: data.restaurant.start.slice(0, 4),
        start: fmtDayMonth.format(fromISO(data.restaurant.start)),
        end: fmtDayMonth.format(fromISO(data.restaurant.end))
      });
    }
    var notes = $("#hoursNotes");
    if (!notes) return;
    var lines = [
      t("hours.restaurant_season", { start: fmtDayMonth.format(fromISO(data.restaurant.start)), end: fmtDayMonth.format(fromISO(data.restaurant.end)) })
    ];
    if (data.hours.spiaggia) {
      lines.push(t("hours.beach_season", { start: fmtDayMonth.format(fromISO(data.beach.start)), end: fmtDayMonth.format(fromISO(data.beach.end)) }));
    }
    if (data.weeklyClosed.length) {
      lines.push(t("hours.weekly", { days: joinList(data.weeklyClosed.map(isoWeekdayName)) }));
    }
    if (data.offSeason.enabled) {
      var services = data.offSeason.services.length === 2 ? t("hours.services_both") : t("hours.services_" + data.offSeason.services[0]);
      lines.push(t("hours.offseason", { days: joinList(data.offSeason.days.map(isoWeekdayName)), services: services }));
    } else {
      lines.push(t("hours.offseason_none"));
    }
    if (data.closures.length) {
      var items = data.closures.slice(0, 6).map(function (item) {
        return t("hours.closure_" + item.service, { date: fmtShort.format(fromISO(item.day)) });
      });
      lines.push(t("hours.closures", { list: joinList(items) }));
    }
    notes.replaceChildren();
    lines.forEach(function (line) {
      var li = document.createElement("li");
      li.textContent = line;
      notes.append(li);
    });
  }

  if ($("#statusText") || $("#hoursBody")) {
    api("/api/hours").then(function (data) {
      renderStatus(data);
      renderHours(data);
    }).catch(function () { /* restano gli orari statici della pagina */ });
  }

  /* ---------- Anteprima dei piatti ---------- */
  var dishList = $("#dishList");
  var dishStage = $("#dishStage");
  var previewMedia = window.matchMedia("(hover: hover) and (min-width: 1080px)");
  var activeDish = null;
  function showDish(dish) {
    if (!dish || dish === activeDish || !dishStage) return;
    activeDish = dish;
    $$(".dish", dishList).forEach(function (item) { item.classList.toggle("is-active", item === dish); });
    var image = new Image();
    image.alt = "";
    image.decoding = "async";
    image.src = dish.dataset.preview;
    image.className = "is-entering";
    image.addEventListener("animationend", function () {
      while (dishStage.children.length > 1 && dishStage.firstElementChild !== image) dishStage.firstElementChild.remove();
    });
    dishStage.append(image);
    while (dishStage.children.length > 3) dishStage.firstElementChild.remove();
    $("#dishCaptionMoment").textContent = $(".dish__moment", dish).textContent;
    $("#dishCaptionName").textContent = $(".dish__name", dish).textContent;
  }
  if (dishList && dishStage) {
    var preloaded = false;
    dishList.addEventListener("pointerover", function (event) {
      if (!previewMedia.matches) return;
      if (!preloaded) {
        preloaded = true;
        $$(".dish", dishList).forEach(function (dish) { var img = new Image(); img.src = dish.dataset.preview; });
      }
      showDish(event.target.closest(".dish"));
    });
    var firstDish = $(".dish", dishList);
    if (previewMedia.matches) showDish(firstDish);
    previewMedia.addEventListener("change", function () { if (previewMedia.matches && !activeDish) showDish(firstDish); });
  }

  /* ---------- UTM: salvati alla prima visita della sessione e inviati con la prenotazione ---------- */
  var UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"];
  (function captureUtm() {
    var params = new URLSearchParams(window.location.search);
    var found = {};
    UTM_KEYS.forEach(function (key) {
      var value = params.get(key);
      if (value) found[key] = value.slice(0, 150);
    });
    if (Object.keys(found).length) {
      try { sessionStorage.setItem("mare-utm", JSON.stringify(found)); } catch (_) {}
    }
  })();
  function readUtm() {
    try { return JSON.parse(sessionStorage.getItem("mare-utm")) || {}; } catch (_) { return {}; }
  }

  /* ---------- Ricerca nel sito ---------- */
  var searchDialog = $("#searchDialog");
  var searchInput = $("#searchInput");
  var searchResults = $("#searchResults");
  var searchStatus = $("#searchStatus");
  var searchIndex = null;

  function buildIndex() {
    return $$("[data-search]").map(function (element) {
      var heading = element.matches("h2") ? element : $("h2, h3, summary, .dish__name, .menu-files__label", element);
      var title = (heading || element).textContent.replace(/\s+/g, " ").trim();
      var snippetSource = element.matches("h2")
        ? $("p:not(.sec-index)", element.parentElement)
        : $(".faq__body, .dish__desc, p, td", element);
      var snippet = snippetSource && snippetSource !== heading ? snippetSource.textContent.replace(/\s+/g, " ").trim() : "";
      var extra = element.matches(".hours") ? element.textContent : "";
      var all = [title, snippet, extra, element.dataset.searchSection].join(" ");
      return {
        element: element,
        title: title,
        section: element.dataset.searchSection || "",
        snippet: snippet,
        haystack: normalize(all),
        looseHaystack: loose(all),
        titleKey: normalize(title)
      };
    });
  }

  function accentPattern(token) {
    var map = { a: "[aàáâä]", e: "[eèéêë]", i: "[iìíîï]", o: "[oòóôö]", u: "[uùúûü]" };
    return token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/[aeiou]/g, function (vowel) { return map[vowel]; });
  }
  function highlight(text, tokens) {
    var safe = escapeHTML(text);
    if (!tokens.length) return safe;
    var pattern = new RegExp("(" + tokens.map(accentPattern).join("|") + ")", "gi");
    return safe.replace(pattern, "<mark>$1</mark>");
  }

  function renderResults(query) {
    if (!searchIndex) searchIndex = buildIndex();
    var tokens = normalize(query).split(/\s+/).filter(function (token) { return token.length > 1; });
    searchResults.replaceChildren();
    if (!tokens.length) {
      searchStatus.textContent = t("search.suggestions");
      (I18N.search && I18N.search.items || []).forEach(function (item) {
        var li = document.createElement("li");
        var link = document.createElement("a");
        link.href = item.href || "#prenota";
        link.innerHTML = "<small>" + escapeHTML(item.section) + "</small><strong>" + escapeHTML(item.title) + "</strong>";
        link.addEventListener("click", function (event) {
          event.preventDefault();
          closeDialog(searchDialog);
          if (item.action === "booking") openBooking();
          else document.querySelector(item.href).scrollIntoView({ behavior: scrollBehavior(), block: "start" });
        });
        li.append(link);
        searchResults.append(li);
      });
      return;
    }
    var results = searchIndex.map(function (item) {
      var score = 0;
      for (var i = 0; i < tokens.length; i++) {
        var token = tokens[i];
        if (item.haystack.indexOf(token) === -1) {
          // Nessuna corrispondenza esatta: prova con la radice, con un punteggio più basso.
          if (item.looseHaystack.indexOf(stem(token)) === -1) return null;
          score += 0.5;
          continue;
        }
        if (item.titleKey.indexOf(token) === 0) score += 5;
        else if (item.titleKey.indexOf(token) !== -1) score += 3;
        else score += 1;
      }
      return { item: item, score: score };
    }).filter(Boolean).sort(function (a, b) { return b.score - a.score; }).slice(0, 8);

    searchStatus.textContent = results.length === 1 ? t("search.results_one") : t("search.results_many", { n: results.length });
    if (!results.length) {
      var empty = document.createElement("li");
      empty.className = "search__empty";
      empty.textContent = t("search.empty", { q: query.trim() });
      searchResults.append(empty);
      return;
    }
    results.forEach(function (result) {
      var item = result.item;
      var li = document.createElement("li");
      var link = document.createElement("a");
      link.href = "#" + (item.element.id || (item.element.closest("[id]") || {}).id || "contenuto");
      link.innerHTML = "<small>" + escapeHTML(item.section) + "</small><strong>" + highlight(item.title, tokens) + "</strong>" +
        (item.snippet ? "<span>" + highlight(item.snippet, tokens) + "</span>" : "");
      link.addEventListener("click", function (event) {
        event.preventDefault();
        closeDialog(searchDialog);
        revealResult(item.element);
      });
      li.append(link);
      searchResults.append(li);
    });
  }

  function revealResult(element) {
    var details = element.matches("details") ? element : element.closest("details");
    if (details) details.open = true;
    element.scrollIntoView({ behavior: scrollBehavior(), block: "center" });
    element.classList.remove("is-found");
    void element.offsetWidth;
    element.classList.add("is-found");
    window.setTimeout(function () { element.classList.remove("is-found"); }, 2000);
  }

  function openSearch() {
    if (!searchDialog) return;
    if (mobileNav && mobileNav.open) closeDialog(mobileNav);
    openDialog(searchDialog);
    searchInput.value = "";
    renderResults("");
    searchInput.focus();
  }

  if (searchDialog) {
    $("#searchOpen").addEventListener("click", openSearch);
    $$("[data-open-search]").forEach(function (button) { button.addEventListener("click", openSearch); });
    var searchTimer;
    searchInput.addEventListener("input", function () {
      window.clearTimeout(searchTimer);
      searchTimer = window.setTimeout(function () { renderResults(searchInput.value); }, 90);
    });
    searchInput.addEventListener("keydown", function (event) {
      if (event.key === "ArrowDown") {
        var first = $("a", searchResults);
        if (first) { event.preventDefault(); first.focus(); }
      }
      if (event.key === "Enter") {
        var top = $("a", searchResults);
        if (top) { event.preventDefault(); top.click(); }
      }
    });
    searchResults.addEventListener("keydown", function (event) {
      var links = $$("a", searchResults);
      var index = links.indexOf(document.activeElement);
      if (index === -1) return;
      if (event.key === "ArrowDown" && links[index + 1]) { event.preventDefault(); links[index + 1].focus(); }
      if (event.key === "ArrowUp") { event.preventDefault(); (links[index - 1] || searchInput).focus(); }
    });
    document.addEventListener("keydown", function (event) {
      var typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName) || document.activeElement.isContentEditable;
      var anyDialog = $$("dialog[open]").length > 0;
      if ((event.key === "k" || event.key === "K") && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        if (!anyDialog || (mobileNav && mobileNav.open)) openSearch();
      } else if (event.key === "/" && !typing && !anyDialog) {
        event.preventDefault();
        openSearch();
      }
    });
  }

  /* ---------- Prenotazione ---------- */
  var drawer = $("#bookingDrawer");
  var panel = drawer ? $(".drawer__panel", drawer) : null;
  var form = $("#bookingForm");
  var calBody = $("#calBody");
  var calMonth = $("#calMonth");
  var calPrev = $("#calPrev");
  var calNext = $("#calNext");
  var slotsBox = $("#timeSlots");
  var guestsInput = $("#bookingGuests");
  var notesInput = $("#bookingNotes");
  var nameInput = $("#bookingName");
  var phoneInput = $("#bookingPhone");
  var emailInput = $("#bookingEmail");
  var consentInput = $("#bookingConsent");
  var submitButton = $("#bookingSubmit");
  var formAlert = $("#formAlert");
  var successPanel = $("#bookingSuccess");
  var drawerFoot = $("#drawerFoot");
  var summaryEl = $("#bookingSummary");
  var lastFocus = null;
  var configPromise = null;
  var availabilityRequest = 0;
  var guestsTimer;
  var lastBooking = null;

  var state = {
    service: "pranzo",
    date: null,
    time: null,
    guests: 2,
    today: toISO(new Date()),
    lastDay: addDays(toISO(new Date()), 180),
    maxGuests: 12,
    closed: {},
    view: null,
    focusDate: null
  };

  function serviceName(service) { return service === "pranzo" ? t("booking.lunch") : t("booking.dinner"); }
  function guestsText(n) { return t(n === 1 ? "booking.guest_one" : "booking.guest_many", { n: n }); }

  function ensureConfig() {
    if (!configPromise) {
      configPromise = api("/api/booking-config").then(function (config) {
        if (config.today) state.today = config.today;
        if (config.lastDay) state.lastDay = config.lastDay;
        if (config.maxGuests) state.maxGuests = config.maxGuests;
        state.closed = config.closed || {};
        guestsInput.max = String(state.maxGuests);
        $("#guestsHint").textContent = t("booking.guests_hint", { max: state.maxGuests });
        if (config.serviceStart) {
          $$("[data-service-from]").forEach(function (small) {
            var start = config.serviceStart[small.dataset.serviceFrom];
            if (start) small.textContent = t("booking.from", { time: clock(start) });
          });
        }
      }).catch(function () {
        configPromise = null;
        showAlert(t("booking.service_down", { phone: CONTACT_PHONE }));
      });
    }
    return configPromise || Promise.resolve();
  }

  function openBooking(options) {
    if (!drawer || drawer.open) return;
    options = options || {};
    var pop = $("#contactPop");
    if (pop && pop.matches(":popover-open")) pop.hidePopover();
    if (mobileNav && mobileNav.open) closeDialog(mobileNav);
    if (searchDialog && searchDialog.open) closeDialog(searchDialog);
    lastFocus = document.activeElement;
    if (options.service) setService(options.service);
    drawer.showModal();
    syncScrollLock();
    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(function () { drawer.classList.add("is-open"); });
    });
    // Il calendario compare subito con la data del dispositivo; quando arriva la configurazione del server
    // (data di Roma, giorni chiusi, ultimo giorno prenotabile) viene ridisegnato.
    function prepare() {
      if (!state.view) {
        var start = fromISO(state.date || state.today);
        state.view = new Date(start.getFullYear(), start.getMonth(), 1);
      }
      renderCalendar();
      updateStepper();
      updateSummary();
    }
    prepare();
    ensureConfig().then(prepare);
  }

  function closeBooking() {
    if (!drawer || !drawer.open) return;
    drawer.classList.remove("is-open");
    var finished = false;
    function finish() {
      if (finished) return;
      finished = true;
      drawer.close();
      syncScrollLock();
      if (lastFocus && document.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
    }
    panel.addEventListener("transitionend", function handler(event) {
      if (event.target !== panel || event.propertyName !== "transform") return;
      panel.removeEventListener("transitionend", handler);
      finish();
    });
    window.setTimeout(finish, 650);
  }

  if (drawer) {
    drawer.addEventListener("cancel", function (event) {
      event.preventDefault();
      closeBooking();
    });
    drawer.addEventListener("click", function (event) {
      if (event.target === drawer) closeBooking();
    });
  }

  document.addEventListener("click", function (event) {
    var trigger = event.target.closest("[data-open-booking]");
    if (!trigger || !drawer) return;
    event.preventDefault();
    openBooking({ service: trigger.dataset.service });
  });

  function setService(service) {
    var radio = form.querySelector('input[name="service"][value="' + service + '"]');
    if (radio) radio.checked = true;
    if (state.service !== service) {
      state.service = service;
      state.time = null;
      renderCalendar();
      loadAvailability();
    }
  }

  /* Calendario con navigazione da tastiera (frecce, Pagina su/giù, Inizio/Fine) e giorni chiusi. */
  function inRange(iso) { return iso >= state.today && iso <= state.lastDay; }
  function isClosed(iso) { return (state.closed[iso] || []).indexOf(state.service) !== -1; }
  function isSelectable(iso) { return inRange(iso) && !isClosed(iso); }

  function renderCalendar() {
    if (!state.view || !calBody) return;
    var year = state.view.getFullYear();
    var month = state.view.getMonth();
    calMonth.textContent = capitalize(fmtMonth.format(state.view));
    var offset = (new Date(year, month, 1).getDay() + 6) % 7;
    var daysInMonth = new Date(year, month + 1, 0).getDate();
    var monthStart = toISO(new Date(year, month, 1));
    var monthEnd = toISO(new Date(year, month, daysInMonth));

    var focusTarget = state.focusDate && state.focusDate >= monthStart && state.focusDate <= monthEnd ? state.focusDate : null;
    if (!focusTarget && state.date && state.date >= monthStart && state.date <= monthEnd) focusTarget = state.date;
    if (!focusTarget && state.today >= monthStart && state.today <= monthEnd) focusTarget = state.today;

    var cells = [];
    for (var blank = 0; blank < offset; blank++) cells.push(null);
    for (var day = 1; day <= daysInMonth; day++) cells.push(day);
    while (cells.length % 7) cells.push(null);

    var firstEnabled = null;
    calBody.replaceChildren();
    for (var c = 0; c < cells.length; c += 7) {
      var tr = document.createElement("tr");
      cells.slice(c, c + 7).forEach(function (dayNumber) {
        var td = document.createElement("td");
        if (dayNumber) {
          var iso = toISO(new Date(year, month, dayNumber));
          var button = document.createElement("button");
          button.type = "button";
          button.className = "day-btn";
          button.dataset.date = iso;
          var number = document.createElement("span");
          number.className = "day-btn__num";
          number.textContent = String(dayNumber);
          button.append(number);
          var label = capitalize(fmtLong.format(fromISO(iso)));
          if (iso === state.today) {
            button.classList.add("is-today");
            label = t("booking.today", { date: fmtLong.format(fromISO(iso)) });
          }
          if (inRange(iso) && isClosed(iso)) {
            button.classList.add("is-closed");
            var tag = document.createElement("span");
            tag.className = "day-btn__tag";
            tag.setAttribute("aria-hidden", "true");
            tag.textContent = t("booking.closed_tag");
            button.append(tag);
            label = t("booking.closed_label", { date: label });
          }
          button.setAttribute("aria-label", label);
          button.setAttribute("aria-pressed", String(iso === state.date));
          button.tabIndex = -1;
          if (!isSelectable(iso)) button.disabled = true;
          else if (!firstEnabled) firstEnabled = button;
          if (iso === focusTarget && !button.disabled) button.tabIndex = 0;
          td.append(button);
        }
        tr.append(td);
      });
      calBody.append(tr);
    }
    if (!$('.day-btn[tabindex="0"]', calBody) && firstEnabled) firstEnabled.tabIndex = 0;

    var todayDate = fromISO(state.today);
    var lastDate = fromISO(state.lastDay);
    calPrev.disabled = year < todayDate.getFullYear() || (year === todayDate.getFullYear() && month <= todayDate.getMonth());
    calNext.disabled = year > lastDate.getFullYear() || (year === lastDate.getFullYear() && month >= lastDate.getMonth());
  }

  function changeMonth(step) {
    state.view = new Date(state.view.getFullYear(), state.view.getMonth() + step, 1);
    state.focusDate = null;
    renderCalendar();
  }

  function focusDay(iso) {
    var date = fromISO(iso);
    if (date.getMonth() !== state.view.getMonth() || date.getFullYear() !== state.view.getFullYear()) {
      state.view = new Date(date.getFullYear(), date.getMonth(), 1);
    }
    state.focusDate = iso;
    renderCalendar();
    var button = $('.day-btn[data-date="' + iso + '"]', calBody);
    if (button && !button.disabled) button.focus();
  }

  function selectDate(iso) {
    state.date = iso;
    state.focusDate = iso;
    state.time = null;
    var date = fromISO(iso);
    state.view = new Date(date.getFullYear(), date.getMonth(), 1);
    renderCalendar();
    clearError("date");
    loadAvailability();
    updateSummary();
  }

  if (calBody) {
    calPrev.addEventListener("click", function () { changeMonth(-1); });
    calNext.addEventListener("click", function () { changeMonth(1); });
    calBody.addEventListener("click", function (event) {
      var button = event.target.closest(".day-btn");
      if (!button || button.disabled) return;
      selectDate(button.dataset.date);
      var selected = $('.day-btn[data-date="' + state.date + '"]', calBody);
      if (selected) selected.focus();
    });
    calBody.addEventListener("keydown", function (event) {
      var button = event.target.closest(".day-btn");
      if (!button) return;
      var iso = button.dataset.date;
      var date = fromISO(iso);
      var weekday = (date.getDay() + 6) % 7;
      var moves = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7, Home: -weekday, End: 6 - weekday };
      var target = null;
      if (event.key in moves) target = addDays(iso, moves[event.key]);
      if (event.key === "PageUp" || event.key === "PageDown") {
        var shifted = new Date(date.getFullYear(), date.getMonth() + (event.key === "PageUp" ? -1 : 1), 1, 12);
        var lastOfMonth = new Date(shifted.getFullYear(), shifted.getMonth() + 1, 0).getDate();
        shifted.setDate(Math.min(date.getDate(), lastOfMonth));
        target = toISO(shifted);
      }
      if (!target) return;
      event.preventDefault();
      if (target < state.today) target = state.today;
      if (target > state.lastDay) target = state.lastDay;
      // I giorni chiusi si saltano nella direzione del movimento.
      var step = target >= iso ? 1 : -1;
      var guard = 0;
      while (isClosed(target) && inRange(addDays(target, step)) && guard < 60) { target = addDays(target, step); guard++; }
      focusDay(target);
    });
  }

  /* Numero di persone */
  function updateStepper() {
    if (!guestsInput) return;
    guestsInput.value = String(state.guests);
    $('[data-step="-1"]', form).disabled = state.guests <= 1;
    $('[data-step="1"]', form).disabled = state.guests >= state.maxGuests;
  }
  function setGuests(value) {
    var next = Math.round(Number(value));
    if (!Number.isFinite(next)) next = state.guests;
    next = Math.min(state.maxGuests, Math.max(1, next));
    var changed = next !== state.guests;
    state.guests = next;
    updateStepper();
    updateSummary();
    if (changed) {
      window.clearTimeout(guestsTimer);
      guestsTimer = window.setTimeout(loadAvailability, 300);
    }
  }
  if (form) {
    $$("[data-step]", form).forEach(function (button) {
      button.addEventListener("click", function () { setGuests(state.guests + Number(button.dataset.step)); });
    });
    guestsInput.addEventListener("change", function () { setGuests(guestsInput.value); });
    guestsInput.addEventListener("blur", function () { setGuests(guestsInput.value); });

    $$('input[name="service"]', form).forEach(function (radio) {
      radio.addEventListener("change", function () { if (radio.checked) setService(radio.value); updateSummary(); });
    });

    notesInput.addEventListener("input", function () {
      $("#notesCount").textContent = notesInput.value.length + " / 500";
    });
  }

  /* Orari disponibili */
  function renderSlotState(title, text, action) {
    slotsBox.replaceChildren();
    var box = document.createElement("div");
    box.className = "slots__state";
    var strong = document.createElement("strong");
    strong.textContent = title;
    box.append(strong, document.createTextNode(text));
    if (action) {
      var button = document.createElement("button");
      button.type = "button";
      button.className = "slots__action";
      button.textContent = action.label;
      button.addEventListener("click", action.run);
      box.append(button);
    }
    slotsBox.append(box);
  }

  async function loadAvailability() {
    if (!slotsBox) return;
    if (!state.date) {
      slotsBox.replaceChildren();
      var hint = document.createElement("p");
      hint.className = "hint";
      hint.textContent = t("booking.time_hint");
      slotsBox.append(hint);
      return;
    }
    var requestId = ++availabilityRequest;
    slotsBox.setAttribute("aria-busy", "true");
    slotsBox.replaceChildren();
    for (var i = 0; i < 4; i++) {
      var skeleton = document.createElement("div");
      skeleton.className = "slot--skeleton";
      skeleton.setAttribute("aria-hidden", "true");
      slotsBox.append(skeleton);
    }
    var query = "?date=" + encodeURIComponent(state.date) + "&service=" + state.service + "&guests=" + state.guests;
    try {
      var results = await Promise.all([api("/api/availability" + query), wait(350)]);
      if (requestId !== availabilityRequest) return;
      renderSlots(results[0]);
    } catch (error) {
      if (requestId !== availabilityRequest) return;
      renderSlotState(t("booking.unavailable_title"), " " + errorText(error), { label: t("booking.retry"), run: loadAvailability });
    } finally {
      if (requestId === availabilityRequest) slotsBox.setAttribute("aria-busy", "false");
    }
  }

  function renderSlots(data) {
    var serviceLabel = state.service === "pranzo" ? t("booking.service_lunch") : t("booking.service_dinner");
    if (data.state === "closed") {
      state.time = null;
      var dayLabel = capitalize(fmtLong.format(fromISO(state.date)));
      var text = " " + t(state.service === "pranzo" ? "booking.closed_lunch" : "booking.closed_dinner", { date: dayLabel });
      if (data.nextOpen) {
        var nextLabel = fmtLong.format(fromISO(data.nextOpen));
        renderSlotState(t("booking.closed_title"), text + " " + t("booking.closed_next", { date: nextLabel }), {
          label: capitalize(t("booking.closed_pick", { date: nextLabel })),
          run: function () { selectDate(data.nextOpen); }
        });
      } else {
        renderSlotState(t("booking.closed_title"), text + " " + t("booking.closed_none"));
      }
      return updateSummary();
    }
    if (data.state === "not_configured") {
      renderSlotState(t("booking.not_configured_title"), " " + t("booking.not_configured_text", { service: serviceLabel, phone: CONTACT_PHONE }));
      state.time = null;
      return updateSummary();
    }
    if (data.state === "out_of_range") {
      renderSlotState(t("booking.out_of_range_title"), " " + t("booking.out_of_range_text"));
      state.time = null;
      return updateSummary();
    }
    if (data.state === "no_future_slots") {
      renderSlotState(t("booking.past_title"), " " + t("booking.past_text"));
      state.time = null;
      return updateSummary();
    }
    slotsBox.replaceChildren();
    var stillAvailable = false;
    data.slots.forEach(function (slot) {
      var label = document.createElement("label");
      label.className = "slot" + (slot.available ? "" : " is-full");
      var input = document.createElement("input");
      input.type = "radio";
      input.name = "time";
      input.value = slot.time;
      input.disabled = !slot.available;
      if (slot.available && slot.time === state.time) { input.checked = true; stillAvailable = true; }
      var face = document.createElement("span");
      var time = document.createElement("span");
      time.className = "slot__time";
      time.textContent = slot.time;
      var meta = document.createElement("span");
      meta.className = "slot__meta";
      if (!slot.available) meta.textContent = slot.remaining > 0 ? t("booking.slot_max", { n: slot.remaining }) : t("booking.slot_full");
      else meta.textContent = slot.remaining <= 6 ? t("booking.slot_last") : t("booking.slot_free");
      face.append(time, meta);
      label.append(input, face);
      slotsBox.append(label);
    });
    if (!stillAvailable) state.time = null;
    if (data.state === "full") {
      var note = document.createElement("p");
      note.className = "hint";
      note.style.gridColumn = "1 / -1";
      note.textContent = capitalize(t("booking.full", { service: serviceLabel, "for": state.guests > 1 ? t("booking.full_for", { n: state.guests }) : "" }));
      slotsBox.append(note);
    }
    updateSummary();
  }

  if (slotsBox) {
    slotsBox.addEventListener("change", function (event) {
      if (event.target.name !== "time") return;
      state.time = event.target.value;
      clearError("time");
      updateSummary();
    });
  }

  function updateSummary() {
    if (!summaryEl) return;
    var parts = ["<strong>" + escapeHTML(serviceName(state.service)) + "</strong>"];
    parts.push(escapeHTML(state.date ? fmtShort.format(fromISO(state.date)) : t("booking.day_missing")));
    parts.push(escapeHTML(state.time || t("booking.time_missing")));
    parts.push(escapeHTML(guestsText(state.guests)));
    summaryEl.innerHTML = parts.join(" · ");
  }

  /* Validazione */
  var ERROR_TARGETS = {
    date: { message: "#dateError" },
    time: { message: "#timeError" },
    name: { message: "#nameError", input: "#bookingName" },
    phone: { message: "#phoneError", input: "#bookingPhone" },
    email: { message: "#emailError", input: "#bookingEmail" }
  };
  function setError(key, message) {
    var target = ERROR_TARGETS[key];
    var messageEl = $(target.message);
    messageEl.textContent = message;
    messageEl.hidden = false;
    if (target.input) $(target.input).setAttribute("aria-invalid", "true");
  }
  function clearError(key) {
    var target = ERROR_TARGETS[key];
    var messageEl = $(target.message);
    if (!messageEl) return;
    messageEl.textContent = "";
    messageEl.hidden = true;
    if (target.input) $(target.input).removeAttribute("aria-invalid");
  }
  // Stesse regole del server: lettere di qualsiasi alfabeto, spazi, apostrofi, punti e trattini.
  function validName(value) { return /^\p{L}[\p{L}\p{M} '’.\-]+$/u.test(value.trim().replace(/\s+/g, " ")); }
  function validPhone(value) { return /^\+?\d{6,15}$/.test(value.replace(/[\s().\-/]/g, "")); }
  function validEmail(value) { return !value.trim() || /^[^@\s<>()[\]\\,;:"']{1,64}@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)*\.[A-Za-z]{2,24}$/.test(value.trim()); }

  function checkName() {
    if (!validName(nameInput.value)) { setError("name", t("booking.err_name")); return false; }
    clearError("name");
    return true;
  }
  function checkPhone() {
    if (!validPhone(phoneInput.value)) { setError("phone", t("booking.err_phone")); return false; }
    clearError("phone");
    return true;
  }
  function checkEmail() {
    if (!validEmail(emailInput.value)) { setError("email", t("booking.err_email")); return false; }
    clearError("email");
    return true;
  }
  if (nameInput) {
    [[nameInput, checkName], [phoneInput, checkPhone], [emailInput, checkEmail]].forEach(function (pair) {
      pair[0].addEventListener("blur", function () { if (pair[0].value) pair[1](); });
      pair[0].addEventListener("input", function () { if (pair[0].hasAttribute("aria-invalid")) pair[1](); });
    });
  }

  function showAlert(message) {
    if (!formAlert) return;
    formAlert.textContent = message;
    formAlert.hidden = false;
  }
  function hideAlert() {
    formAlert.textContent = "";
    formAlert.hidden = true;
  }

  function validateAll() {
    var firstInvalid = null;
    if (!state.date) {
      setError("date", t("booking.err_date"));
      firstInvalid = firstInvalid || $('.day-btn[tabindex="0"]', calBody);
    }
    if (!state.time) {
      setError("time", state.date ? t("booking.err_time") : t("booking.err_time_no_date"));
      firstInvalid = firstInvalid || $('input[name="time"]:not(:disabled)', slotsBox) || slotsBox;
    }
    if (!checkName()) firstInvalid = firstInvalid || nameInput;
    if (!checkPhone()) firstInvalid = firstInvalid || phoneInput;
    if (!checkEmail()) firstInvalid = firstInvalid || emailInput;
    return firstInvalid;
  }

  if (form) {
    form.addEventListener("submit", async function (event) {
      event.preventDefault();
      hideAlert();
      var invalid = validateAll();
      if (invalid) {
        if (invalid === slotsBox) slotsBox.scrollIntoView({ behavior: scrollBehavior(), block: "center" });
        else invalid.focus();
        return;
      }
      submitButton.disabled = true;
      submitButton.classList.add("is-loading");
      submitButton.setAttribute("aria-busy", "true");
      var payload = {
        date: state.date,
        service: state.service,
        time: state.time,
        guests: state.guests,
        name: nameInput.value.trim(),
        phone: phoneInput.value.trim(),
        email: emailInput.value.trim(),
        consent: consentInput.checked,
        lang: LANG,
        notes: notesInput.value.trim(),
        website: $("#bookingWebsite").value,
        utm: readUtm()
      };
      try {
        var results = await Promise.all([
          api("/api/reservations", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(payload) }),
          wait(500)
        ]);
        showSuccess(results[0], payload);
      } catch (error) {
        showAlert(errorText(error));
        if (error.status === 409) {
          state.time = null;
          if (error.code === "closed") {
            ensureConfig();
          }
          loadAvailability();
        }
        formAlert.scrollIntoView({ behavior: scrollBehavior(), block: "center" });
      } finally {
        submitButton.disabled = false;
        submitButton.classList.remove("is-loading");
        submitButton.removeAttribute("aria-busy");
      }
    });
  }

  function recapRows(booking) {
    return [
      [t("booking.recap_service"), serviceName(booking.service)],
      [t("booking.recap_day"), capitalize(fmtLong.format(fromISO(booking.date)))],
      [t("booking.recap_time"), booking.time],
      [t("booking.recap_guests"), String(booking.guests)],
      [t("booking.recap_name"), booking.name]
    ];
  }

  function showSuccess(result, booking) {
    lastBooking = Object.assign({ reference: result.reference }, booking);
    var recap = $("#successRecap");
    recap.replaceChildren();
    recapRows(booking).forEach(function (row) {
      var wrapper = document.createElement("div");
      var dt = document.createElement("dt");
      dt.textContent = row[0];
      var dd = document.createElement("dd");
      dd.textContent = row[1];
      wrapper.append(dt, dd);
      recap.append(wrapper);
    });
    $("#successRef").textContent = result.reference;
    var notify = result.notify || {};
    var note = notify.channel === "email" ? t("booking.note_email", { to: notify.to })
      : notify.channel === "sms" ? t("booking.note_sms", { to: booking.phone })
      : t("booking.note_none", { phone: CONTACT_PHONE });
    $("#successNote").textContent = note;
    form.hidden = true;
    drawerFoot.hidden = true;
    successPanel.hidden = false;
    $("#drawerBody").scrollTop = 0;
    successPanel.focus();
  }

  function resetBooking() {
    form.hidden = false;
    drawerFoot.hidden = false;
    successPanel.hidden = true;
    state.time = null;
    notesInput.value = "";
    $("#notesCount").textContent = "0 / 500";
    hideAlert();
    loadAvailability();
    updateSummary();
    $("#drawerBody").scrollTop = 0;
    var first = $('input[name="service"]:checked', form);
    if (first) first.focus();
  }

  if (successPanel) {
    $("#newBooking").addEventListener("click", resetBooking);

    $("#addToCalendar").addEventListener("click", function () {
      if (!lastBooking) return;
      var start = lastBooking.date.replace(/-/g, "") + "T" + lastBooking.time.replace(":", "") + "00";
      var endDate = new Date(fromISO(lastBooking.date));
      var parts = lastBooking.time.split(":").map(Number);
      endDate.setHours(parts[0] + 2, parts[1], 0, 0);
      var end = toISO(endDate).replace(/-/g, "") + "T" + pad(endDate.getHours()) + pad(endDate.getMinutes()) + "00";
      var stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
      var lines = [
        "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Bagno Mare//Prenotazioni//IT", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
        "BEGIN:VEVENT",
        "UID:" + lastBooking.reference + "@bagnomare",
        "DTSTAMP:" + stamp,
        "DTSTART;TZID=Europe/Rome:" + start,
        "DTEND;TZID=Europe/Rome:" + end,
        "SUMMARY:" + t(lastBooking.service === "pranzo" ? "booking.ics_lunch" : "booking.ics_dinner"),
        "LOCATION:Bagno Marè\\, Molo di Levante 74\\, 47042 Cesenatico (FC)",
        "DESCRIPTION:" + t("booking.ics_desc", { code: lastBooking.reference, guests: guestsText(lastBooking.guests) }),
        "END:VEVENT", "END:VCALENDAR"
      ];
      var url = URL.createObjectURL(new Blob([lines.join("\r\n")], { type: "text/calendar;charset=utf-8" }));
      var link = document.createElement("a");
      link.href = url;
      link.download = t("booking.ics_file") + "-" + lastBooking.reference + ".ics";
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    });

    $("#printBooking").addEventListener("click", function () {
      if (!lastBooking) return;
      var area = $("#printArea");
      if (!area) {
        area = document.createElement("div");
        area.id = "printArea";
        document.body.append(area);
      }
      area.replaceChildren();
      var title = document.createElement("h1");
      title.textContent = t("booking.print_title");
      var list = document.createElement("dl");
      recapRows(lastBooking).concat([[t("booking.print_code"), lastBooking.reference], [t("booking.print_address"), "Molo di Levante 74, 47042 Cesenatico (FC)"]]).forEach(function (row) {
        var wrapper = document.createElement("div");
        var dt = document.createElement("dt");
        dt.textContent = row[0];
        var dd = document.createElement("dd");
        dd.textContent = row[1];
        wrapper.append(dt, dd);
        list.append(wrapper);
      });
      var note = document.createElement("p");
      note.textContent = t("booking.print_note");
      area.append(title, list, note);
      document.body.classList.add("print-booking");
      window.print();
    });
    window.addEventListener("afterprint", function () { document.body.classList.remove("print-booking"); });
  }

  /* ---------- Avvio ---------- */
  var year = $("#year");
  if (year) year.textContent = String(new Date().getFullYear());
  if (summaryEl) updateSummary();

  // Link diretto alla prenotazione: /#prenota apre il pannello (utile nelle campagne con UTM).
  if (window.location.hash === "#prenota" && drawer) {
    window.setTimeout(function () { openBooking(); }, root.classList.contains("is-loading") ? 1700 : 300);
  }
})();
