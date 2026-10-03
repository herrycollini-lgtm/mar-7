"""Genera le pagine del sito in ogni lingua da un unico modello.

Uso:  py -3 build.py

- templates/index.html e templates/privacy.html sono i modelli; templates/partials/ contiene i pezzi condivisi.
- i18n/<lingua>.json contiene i testi fissi. {{chiave.sotto}} inserisce un testo (con escape HTML),
  {{{chiave}}} inserisce HTML già pronto, {{> nome}} include templates/partials/nome.html.
- Le pagine generate vanno caricate insieme al resto: index.html, en/, de/, privacy.html.
- I file CSS e JS ricevono una versione calcolata dal contenuto, così dopo ogni modifica il browser li riscarica.
"""
import hashlib
import html
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
LANGS = [
    ("it", "/", "Italiano", "IT"),
    ("en", "/en/", "English", "EN"),
    ("de", "/de/", "Deutsch", "DE"),
]
PAGES = {"index.html": "", "privacy.html": "privacy.html"}
ASSETS = {"styles": "styles.css", "app": "app.js", "boot": "boot.js", "admin_css": "admin.css", "admin_js": "admin.js"}
TOKEN = re.compile(r"\{\{\{\s*([\w.]+)\s*\}\}\}|\{\{\s*([\w.]+)\s*\}\}")
PARTIAL = re.compile(r"\{\{>\s*([a-z_]+)\s*\}\}")


def version(filename):
    return hashlib.sha256((ROOT / filename).read_bytes()).hexdigest()[:10]


def lookup(data, key):
    current = data
    for part in key.split("."):
        if not isinstance(current, dict) or part not in current:
            raise KeyError(key)
        current = current[part]
    if isinstance(current, (dict, list)):
        raise KeyError(key + " (è un gruppo, non un testo)")
    return str(current)


def render(template, context, label):
    template = PARTIAL.sub(lambda match: (ROOT / "templates" / "partials" / (match.group(1) + ".html")).read_text(encoding="utf-8").rstrip("\n"), template)
    missing = []

    def replace(match):
        raw_key, text_key = match.group(1), match.group(2)
        try:
            if raw_key:
                return lookup(context, raw_key)
            return html.escape(lookup(context, text_key), quote=True)
        except KeyError as error:
            missing.append(str(error).strip("'\""))
            return ""

    output = TOKEN.sub(replace, template)
    if missing:
        raise SystemExit("Testi mancanti in {}: {}".format(label, ", ".join(sorted(set(missing)))))
    return output


def language_switch(texts, code, page_suffix):
    links = []
    for other, prefix, name, short in LANGS:
        current = ' aria-current="page"' if other == code else ""
        links.append(
            '<a href="{href}" lang="{lang}" hreflang="{lang}" data-lang-link="{lang}"{current}>'
            '<span aria-hidden="true">{short}</span><span class="sr-only">{name}</span></a>'.format(
                href=prefix + page_suffix, lang=other, current=current, short=short, name=name)
        )
    return '        <nav class="lang-switch" aria-label="{}">{}</nav>'.format(html.escape(lookup(texts, "a11y.lang")), "".join(links))


def alternates(page_suffix):
    lines = ['  <link rel="alternate" hreflang="{}" href="__ORIGIN__{}{}">'.format(code, prefix, page_suffix) for code, prefix, _, _ in LANGS]
    lines.append('  <link rel="alternate" hreflang="x-default" href="__ORIGIN__/{}">'.format(page_suffix))
    return "\n".join(lines)


def main():
    dictionaries = {code: json.loads((ROOT / "i18n" / (code + ".json")).read_text(encoding="utf-8")) for code, _, _, _ in LANGS}
    versions = {key: version(name) for key, name in ASSETS.items()}
    suggest = {code: dictionaries[code]["suggest"] for code in dictionaries}
    prefixes = {code: prefix for code, prefix, _, _ in LANGS}
    written = []
    for code, prefix, _, _ in LANGS:
        texts = dictionaries[code]
        js = dict(texts["js"])
        js.update({"lang": code, "prefix": prefix, "prefixes": prefixes, "suggest": suggest})
        js_json = json.dumps(js, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
        for page, suffix in PAGES.items():
            context = dict(texts)
            context.update({
                "lang": code,
                "prefix": prefix,
                "v": versions,
                "lang_switch": language_switch(texts, code, suffix),
                "alternates": alternates(suffix),
                "js_json": js_json,
            })
            template = (ROOT / "templates" / page).read_text(encoding="utf-8")
            target = ROOT / prefix.strip("/") / page if prefix != "/" else ROOT / page
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(render(template, context, "{}/{}".format(code, page)), encoding="utf-8", newline="\n")
            written.append(str(target.relative_to(ROOT)))
    # L'area gestione non si traduce, ma riceve le stesse versioni dei file.
    admin = ROOT / "admin.html"
    names = {"styles.css": versions["styles"], "admin.css": versions["admin_css"], "boot.js": versions["boot"], "admin.js": versions["admin_js"]}
    text = admin.read_text(encoding="utf-8")
    text = re.sub(r'(href|src)="/(styles\.css|admin\.css|boot\.js|admin\.js)(\?v=[^"]*)?"',
                  lambda m: '{}="/{}?v={}"'.format(m.group(1), m.group(2), names[m.group(2)]), text)
    admin.write_text(text, encoding="utf-8", newline="\n")
    written.append("admin.html (versioni)")
    print("Pagine generate:\n  " + "\n  ".join(written))


if __name__ == "__main__":
    sys.exit(main())
