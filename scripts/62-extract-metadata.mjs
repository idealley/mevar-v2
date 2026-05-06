#!/usr/bin/env node
// Walk markdown/onedrive/, clean each file, extract metadata, write back cleaned md
// + accumulate manifests/onedrive.json with full structured fields.
//
// Patterns handled:
//   - Exhortation [(Première|Deuxième|Troisième) ]? [Spéciale ]? [du Mois ]? [de ]? [Fin (de l'année|de) ]? [Mi-]? <MOIS> <YYYY>
//   - "Exhortation de Fin d'année <YYYY>" → date = YYYY-12-31
//   - Sermon header (joined across lines): pr[êe]ch[ée]?e? [par PERSON]? [à LIEU]? [le [JOUR] DD MOIS YYYY]?
//   - LIEU, [le|Le] [JOUR]? DD MOIS YYYY
//   - "Auteur: PERSON" / "TITRE : ..." labels
//   - Multi-line wrapped titles ending in comma + "Partie N"

import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const mdRoot = path.join(root, "markdown", "onedrive");
const inv = JSON.parse(fs.readFileSync(path.join(root, "manifests/onedrive-inventory.json"), "utf8"));

const canonByMd = new Map();
for (const e of inv) {
  const mdRel = e.canonical_path.replace(/^onedrive\//, "").replace(/\.(pdf|docx)$/i, ".md");
  canonByMd.set(mdRel, e);
}

const MONTHS = {
  janvier: "01", fevrier: "02", "février": "02", mars: "03", avril: "04",
  mai: "05", juin: "06", juillet: "07", aout: "08", "août": "08",
  septembre: "09", octobre: "10", novembre: "11", decembre: "12", "décembre": "12",
};
function normMonth(m) {
  return m.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

const MONTH_RE = "(janvier|f[ée]vrier|mars|avril|mai|juin|juillet|ao[ûu]t|septembre|octobre|novembre|d[ée]cembre)";
const WEEKDAY_RE = "(?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)(?:\\s+(?:matin|soir|apr[èe]s[\\s\\-]?midi))?";

const EXHO_RE = new RegExp(
  "(?:(Premi[èe]re|Deuxi[èe]me|Troisi[èe]me|Quatri[èe]me)\\s+)?" +
  "(?:Exhortation|Exho)" +
  "(?:\\s+Sp[ée]ciale|\\s+spec\\.?)?" +
  "(?:\\s+du\\s+Mois)?" +
  "(?:\\s+(?:[Dd][e'’]?))?" +
  "(?:\\s+(?:[Ff]in|[Mm]i[\\s\\-_]?))?" +
  "\\s*" + MONTH_RE +
  "\\s+(\\d{4})",
  "iu",
);
const EXHO_FIN_ANNEE_RE = /Exhortation\s+(?:de\s+)?Fin\s+d['’]?\s*ann[eé]e\s+(\d{4})/iu;

// Sermon header — applied to the first ~15 lines joined with single spaces.
// Capture groups: 1 prêché-form, 2 day-num, 3 month, 4 year, 5 location, 6 preacher.
// Covers "prêché [par X] [à Y] [le D mois Y]" in any order, with optional weekday.
const PRECH_DATE_RE = new RegExp(
  "[Pp]r[êe]ch[ée](?:e|es)?\\s+" +
  "(?:(?:par\\s+(?:le\\s+)?(?:fr[èe]re|fr|s[œoe]ur)?\\.?\\s*([A-ZÀ-Ÿ][^,;()]+?))\\s+)?" +
  "(?:[àa]\\s+([\\wÀ-ÿ' \\-]+?)\\s+)?" +
  "(?:le\\s+)?(?:" + WEEKDAY_RE + "\\s+)?(\\d{1,2})(?:[eè]r|e)?\\s+" + MONTH_RE + "\\s+(\\d{4})",
  "iu",
);
// Reverse pattern: "[à] LIEU le D mois YYYY" or "Prêché à LIEU le D mois YYYY par X"
const LIEU_DATE_RE = new RegExp(
  "(?:[Pp]r[êe]ch[ée](?:e)?\\s+)?[àa]\\s+([A-Z][\\wÀ-ÿ' \\-]+?),?\\s+(?:le\\s+)?(?:" + WEEKDAY_RE + "\\s+)?(\\d{1,2})(?:[eè]r|e)?\\s+" + MONTH_RE + "\\s+(\\d{4})",
  "iu",
);
// "LIEU, [le|Le] [JOUR]? D mois YYYY" — location-first
const LIEU_FIRST_RE = new RegExp(
  "^\\s*([A-Z][\\wÀ-ÿ\\- ]{2,40}?),\\s+(?:[Ll]e\\s+)?(?:" + WEEKDAY_RE + "\\s+)?(\\d{1,2})(?:[eè]r|e)?\\s+" + MONTH_RE + "\\s+(\\d{4})",
  "iu",
);
// "par X" — capture 1-3 capitalized/uppercase tokens.
// Each name token: ALLCAPS (≥2 chars, with possible apostrophe/hyphen) OR Capitalized (Camel-style)
// Match a single name token: starts with an uppercase letter, then 1-30 letters/apostrophe/hyphen.
// Covers M'BRA, IRIE, ANDERSON, Kadjany, André, O'Connor, Jean-Marie.
const NAME_TOKEN = "[A-ZÀ-Ÿ][A-Za-zÀ-ÿ'’\\-]{1,30}";
const PAR_PERSON_RE = new RegExp(
  "par\\s+(?:le\\s+)?(?:fr[èe]re|fr|s[œoe]ur)\\.?\\s+" +
  "(" + NAME_TOKEN + "(?:\\s+" + NAME_TOKEN + "){0,2})",
  "u",
);
const STOP_WORDS_AFTER_NAME = new Set([
  "Que", "Mes", "Je", "Nous", "Notre", "Le", "La", "Les", "Un", "Une", "Des",
  "Ce", "Cette", "Ces", "Bon", "Voici", "Voilà", "Vraiment", "Et", "Or",
  "Donc", "Mais", "Comme", "Ainsi", "Alors", "Message", "C'est", "Cher",
  "Chers", "Mon", "Ma", "Bien", "Aujourd'hui", "Beaucoup", "Pour", "Avec",
  "Quand", "Lorsque", "Frère", "Frères", "Sœur", "Sœurs", "Amen", "Alléluia",
  "Vous", "Tous", "Tout", "Toute",
]);
// Auteur: / TITRE: explicit labels
const AUTEUR_RE = /Auteur\s*[:\-]\s*([^\n]+)/i;
const TITRE_RE = /TITRE\s*[:\-]\s*([^\n]+)/i;

function cleanLines(md) {
  return md
    .split("\n")
    .map((l) => l
      .replace(/^[\s>]+/, "")
      .replace(/\s+$/, "")
      .replace(/\u00A0/g, " ")
      .replace(/^#+\s*/, "")
      .replace(/<a\s+id="[^"]*"\s*>\s*<\/a>/g, "")
      .replace(/^_{2,}|_{2,}$/g, "")
      .replace(/__([^_]+)__/g, "$1")
      .replace(/\\-/g, "-")
      .replace(/\\!/g, "!")
    );
}

function cleanMarkdown(md) {
  // Strip any pre-existing frontmatter so extraction doesn't re-ingest it.
  md = md.replace(/^---\n[\s\S]*?\n---\n+/, "");
  let lines = cleanLines(md);
  // Drop noise lines: pure digits (page numbers), "X sur N" pagination,
  // "DD/MM/YYYY MEVAR" publication-date headers, leading "lit page X of N"
  lines = lines.filter((l) => {
    if (/^\d+$/.test(l)) return false;
    if (/^\d+\s+sur\s+\d+$/i.test(l)) return false;
    if (/^\d{1,2}\/\d{1,2}\/\d{2,4}\s+MEVAR$/i.test(l)) return false;
    return true;
  });
  // Collapse 3+ blank lines to one
  const out = [];
  let blank = 0;
  for (const l of lines) {
    if (l === "") {
      blank++;
      if (blank > 1) continue;
    } else {
      blank = 0;
    }
    out.push(l);
  }
  // Strip leading blank lines
  while (out.length && out[0] === "") out.shift();
  return out.join("\n");
}

function extract(md, basename) {
  const lines = md.split("\n").filter(Boolean);
  const head = lines.slice(0, 20);
  const headJoined = head.join(" ").replace(/\s+/g, " ").trim();

  let title = null;
  let subtitle = null;
  let date = null;
  let location = null;
  let preacher = null;
  let titleLineIdx = null;

  // 1) Explicit labels
  const titreM = headJoined.match(TITRE_RE);
  if (titreM) title = titreM[1].trim();
  const auteurM = headJoined.match(AUTEUR_RE);
  if (auteurM) preacher = auteurM[1].trim();

  // 2) Exhortation subtitle
  const finAnneeM = headJoined.match(EXHO_FIN_ANNEE_RE);
  if (finAnneeM) {
    subtitle = finAnneeM[0].trim();
    date = `${finAnneeM[1]}-12-31`;
  } else {
    const exM = headJoined.match(EXHO_RE);
    if (exM) {
      // Find the line index containing the match to locate the title
      const idx = head.findIndex((l) => EXHO_RE.test(l));
      titleLineIdx = idx >= 0 ? idx + 1 : null;
      subtitle = exM[0].trim();
      const mo = MONTHS[normMonth(exM[2])];
      const yr = Number(exM[3]);
      if (mo && yr) date = `${yr}-${mo}-01`;
    }
  }

  // 3) Sermon-header date/location/preacher
  if (!date) {
    const m = headJoined.match(PRECH_DATE_RE);
    if (m) {
      const dd = String(m[3]).padStart(2, "0");
      const mo = MONTHS[normMonth(m[4])];
      const yr = Number(m[5]);
      if (mo && yr) date = `${yr}-${mo}-${dd}`;
      if (m[1]) preacher ??= m[1].trim();
      if (m[2]) location ??= m[2].trim();
    }
  }
  if (!date) {
    const m = headJoined.match(LIEU_DATE_RE);
    if (m) {
      const dd = String(m[2]).padStart(2, "0");
      const mo = MONTHS[normMonth(m[3])];
      const yr = Number(m[4]);
      if (mo && yr) date = `${yr}-${mo}-${dd}`;
      if (m[1]) location ??= m[1].trim();
    }
  }
  if (!date) {
    for (const l of head) {
      const m = l.match(LIEU_FIRST_RE);
      if (m) {
        const dd = String(m[2]).padStart(2, "0");
        const mo = MONTHS[normMonth(m[3])];
        const yr = Number(m[4]);
        if (mo && yr) date = `${yr}-${mo}-${dd}`;
        if (m[1]) location ??= m[1].trim();
        break;
      }
    }
  }
  // 4) "par X" / "par le frère X"
  if (!preacher) {
    const m = headJoined.match(PAR_PERSON_RE);
    if (m) preacher = m[1].trim();
  }

  // 5) Title fallback: walk head, skip exhortation/sermon-header lines
  if (!title) {
    for (let i = 0; i < head.length; i++) {
      let l = head[i];
      // Skip non-substantive lines
      if (/^[\s\W_-]+$/.test(l)) continue;
      if (/^[-_\d\s]+\d?[-_\s]*$/.test(l)) continue;
      if (EXHO_RE.test(l) || EXHO_FIN_ANNEE_RE.test(l)) continue;
      if (LIEU_FIRST_RE.test(l)) continue;
      if (/^TITRE\b|^Auteur\b/i.test(l)) continue;
      if (/^pr[êe]ch/i.test(l)) continue;
      // If "prêché" appears mid-line, take the prefix as title.
      const prechIdx = l.search(/[,;\s]+(?:Message\s+)?pr[êe]ch[ée]/i);
      if (prechIdx > 0) {
        const cand = l.slice(0, prechIdx).trim();
        if (cand.length >= 3) { title = cand; break; }
        continue;
      } else if (PRECH_DATE_RE.test(l)) {
        continue;
      }
      if (l.length < 3) continue;
      title = l;
      // Only join with next line if it's a clear "Partie N" continuation.
      const next = head[i + 1] ?? "";
      if (/^Partie\s+\d+$/i.test(next)) title += " — " + next;
      break;
    }
  }

  // Title cleanup
  if (title) {
    title = title
      .replace(/[,;\s]+(?:Message\s+)?pr[êe]ch[ée].*/i, "")  // strip ", prêché..." or " Message prêché..."
      .replace(/\s*Auteur\s*:.*/i, "")
      .replace(/^_{2,}|_{2,}$/g, "")            // strip __bold__ markers
      .replace(/^\*{2,}|\*{2,}$/g, "")          // strip **bold**
      .replace(/^[-_\d\s.]+(?=[A-Za-zÀ-ÿ])/, "") // strip leading "-1- ", "1 ", "_____"
      .replace(/\\!/g, "!")                      // un-escape mammoth
      .replace(/[,;.]\s*$/, "")
      .replace(/\s+/g, " ")
      .trim();
    if (title.length > 200) title = title.slice(0, 200) + "…";
    if (!title) title = null;
  }
  if (subtitle) subtitle = subtitle.replace(/\s+/g, " ").trim();
  if (location) {
    location = location.replace(/^[,\s]+|[,.\s]+$/g, "").replace(/\s+/g, " ");
    if (location.length > 60) location = location.slice(0, 60) + "…";
  }
  if (preacher) {
    preacher = preacher.replace(/^[,\s]+|[,.\s]+$/g, "").replace(/\s+/g, " ").replace(/\.$/, "");
    // Trim trailing stopword-tokens that crept in from following body text
    const tokens = preacher.split(/\s+/);
    while (tokens.length > 0 && STOP_WORDS_AFTER_NAME.has(tokens.at(-1))) tokens.pop();
    preacher = tokens.join(" ").trim();
    if (preacher.length < 2 || preacher.length > 50) preacher = null;
  }

  return { title, subtitle, date, location, preacher };
}

function fingerprintBody(md) {
  let text = md.replace(/^---[\s\S]*?\n---\n/, "");
  text = text.toLowerCase().replace(/[^a-zà-ÿ ]+/g, " ");
  const words = text.split(/\s+/).filter((w) => w.length >= 4);
  return [...new Set(words)].slice(0, 200);
}

function* walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) yield* walk(p);
    else if (ent.isFile() && p.endsWith(".md")) yield p;
  }
}

const entries = [];
for (const md of walk(mdRoot)) {
  const rel = path.relative(path.join(root, "markdown"), md);
  const raw = fs.readFileSync(md, "utf8");
  const cleaned = cleanMarkdown(raw);
  if (cleaned !== raw) fs.writeFileSync(md, cleaned);

  const basename = path.basename(md, ".md");
  const meta = extract(cleaned, basename);
  const invEntry = canonByMd.get(rel);

  entries.push({
    source: "onedrive",
    sermon_id: basename,
    title: meta.title,
    subtitle: meta.subtitle,
    date: meta.date,
    year: meta.date ? Number(meta.date.slice(0, 4)) : null,
    location: meta.location,
    preacher: meta.preacher,
    pdf_url: null,
    audio_url: null,
    stream_url: null,
    local_md: rel.replace(/^/, "markdown/"),
    source_path: invEntry?.canonical_path ?? null,
    aliases: invEntry?.aliases ?? [],
    hash: invEntry?.hash ?? null,
    fingerprint_words: fingerprintBody(cleaned),
  });
}

entries.sort((a, b) => (a.date ?? "9999").localeCompare(b.date ?? "9999")
  || (a.title ?? "").localeCompare(b.title ?? ""));

fs.writeFileSync(path.join(root, "manifests/onedrive.json"), JSON.stringify(entries, null, 2));

const stats = {
  total: entries.length,
  with_title: entries.filter((e) => e.title).length,
  with_subtitle: entries.filter((e) => e.subtitle).length,
  with_date: entries.filter((e) => e.date).length,
  with_location: entries.filter((e) => e.location).length,
  with_preacher: entries.filter((e) => e.preacher).length,
};
console.log("onedrive metadata extraction:");
for (const [k, v] of Object.entries(stats)) console.log(`  ${k}: ${v}`);
