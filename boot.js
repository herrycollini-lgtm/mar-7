// Caricato in <head> senza defer: applica il tema prima del primo disegno, così non c'è il lampo chiaro in modalità scura.
(function () {
  var root = document.documentElement;
  var theme = null;
  try { theme = localStorage.getItem("mare-theme"); } catch (_) {}
  if (theme !== "light" && theme !== "dark") {
    theme = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  root.dataset.theme = theme;
  root.classList.add("js");

  // Il sipario iniziale compare solo alla prima visita della sessione e mai con movimento ridotto.
  var seen = false;
  try { seen = sessionStorage.getItem("mare-intro") === "1"; } catch (_) {}
  var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!seen && !reduced && root.dataset.page === "site") {
    root.classList.add("is-loading");
    try { sessionStorage.setItem("mare-intro", "1"); } catch (_) {}
  }
})();
