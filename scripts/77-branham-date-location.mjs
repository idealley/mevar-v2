#!/usr/bin/env node
// Date, year and location of every Branham sermon, from their source: the
// sermon id is the date ("50-0714" is 1950-07-14; a "00" month or day is no
// date), and branham.org's year listing gives the place. Until now these came
// from the LLM cleanup (73): 174 dates and 153 years disagreed with the id,
// 550 sermons had no location and others had "Canada (likely)". Written into
// manifests/branham-*.json and the frontmatter of markdown/branham/.
//
// The listing is fetched once per year into .firecrawl/ (gitignored); a rerun
// reads it from there and changes nothing. Run 50-build-index.mjs after it.
//
//   node scripts/77-branham-date-location.mjs

import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");

// branham.org writes "Jeffersonville IN"; the corpus writes "Jeffersonville, Indiana".
const REGIONS = {
  AL: "Alabama", AR: "Arkansas", AZ: "Arizona", CA: "California", CT: "Connecticut",
  DC: "D.C.", FL: "Florida", GA: "Georgia", IA: "Iowa", IL: "Illinois", IN: "Indiana",
  KS: "Kansas", KY: "Kentucky", LA: "Louisiana", MA: "Massachusetts", ME: "Maine",
  MI: "Michigan", MN: "Minnesota", MS: "Mississippi", NC: "North Carolina",
  NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York", OH: "Ohio",
  OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", PR: "Puerto Rico",
  SC: "South Carolina", SD: "South Dakota", TN: "Tennessee", TX: "Texas", VA: "Virginia",
  VT: "Vermont", WA: "Washington", WI: "Wisconsin", WV: "West Virginia",
  AB: "Alberta", BC: "British Columbia", SK: "Saskatchewan",
};

/** "Jeffersonville IN" -> "Jeffersonville, Indiana"; "AB" -> "Alberta"; "Unknown", "" -> undefined. */
function place(listed) {
  if (!listed || listed === "Unknown") return undefined;
  const m = listed.match(/^(?:(.+) )?([A-Z]{2})$/);
  if (!m) return listed; // Zurich, Karlsruhe, Lausanne, Johannesburg
  if (!REGIONS[m[2]]) throw new Error(`no region for ${m[2]} in "${listed}"`);
  return m[1] ? `${m[1]}, ${REGIONS[m[2]]}` : REGIONS[m[2]];
}

async function listing(yy) {
  const cache = path.join(root, ".firecrawl", `branham-listing-${yy}.json`);
  if (!fs.existsSync(cache)) {
    const res = await fetch("https://branham.org/branham/messageaudio.aspx/wmSearchByYear", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ formVars: [{ name: "year", value: `${yy}-` }] }),
    });
    if (!res.ok) throw new Error(`branham.org ${yy}-: ${res.status}`);
    fs.mkdirSync(path.dirname(cache), { recursive: true });
    fs.writeFileSync(cache, await res.text());
  }
  const html = JSON.parse(fs.readFileSync(cache, "utf8")).d[0];
  const rows = new Map();
  for (const block of html.split('class="messagebox"').slice(1)) {
    const id = block.match(/<div class="prodtext">\s*([\w-]+)\s*<\/div>/)?.[1];
    const [location] = [...block.matchAll(/prodtext2">([^<]*)</g)].map((m) => m[1].trim());
    if (id) rows.set(id, location);
  }
  return rows;
}

const listed = new Map();
for (let yy = 47; yy <= 65; yy++) for (const [id, loc] of await listing(yy)) listed.set(id, loc);

/** The fields a sermon should have; undefined means none. */
function fields(id) {
  if (!listed.has(id)) throw new Error(`${id} is not in branham.org's listing`);
  const [, yy, mm, dd] = id.match(/^(\d\d)-(\d\d)(\d\d)/);
  const date = mm === "00" || dd === "00" ? undefined : `19${yy}-${mm}-${dd}`;
  return { date, year: 1900 + Number(yy), location: place(listed.get(id)) };
}

let manifests = 0;
for (const f of fs.readdirSync(path.join(root, "manifests")).filter((f) => /^branham-\d{4}\.json$/.test(f))) {
  const p = path.join(root, "manifests", f);
  const text = fs.readFileSync(p, "utf8");
  const entries = JSON.parse(text);
  for (const e of entries) {
    for (const [k, v] of Object.entries(fields(e.sermon_id))) {
      if (v === undefined) delete e[k];
      else e[k] = v;
    }
  }
  const out = JSON.stringify(entries, null, 2);
  if (out !== text) fs.writeFileSync(p, out), manifests++;
}

// In the frontmatter, a field is replaced where it is, or added after the
// title, in the order date, year, location.
let files = 0;
for (const rel of fs.readdirSync(path.join(root, "markdown/branham"), { recursive: true })) {
  if (!rel.endsWith(".md")) continue;
  const p = path.join(root, "markdown/branham", rel);
  const text = fs.readFileSync(p, "utf8");
  const end = text.indexOf("\n---\n", 4);
  const lines = text.slice(4, end).split("\n");
  let after = lines.findIndex((l) => l.startsWith("title: "));
  for (const [k, v] of Object.entries(fields(path.basename(rel, ".md")))) {
    const i = lines.findIndex((l) => l.startsWith(`${k}: `));
    if (v === undefined) {
      if (i >= 0) lines.splice(i, 1);
      if (i >= 0 && i <= after) after--;
      continue;
    }
    const line = `${k}: ${typeof v === "number" ? v : JSON.stringify(v)}`;
    if (i >= 0) lines[i] = line;
    else lines.splice(after + 1, 0, line);
    after = i >= 0 ? i : after + 1;
  }
  const out = `---\n${lines.join("\n")}${text.slice(end)}`;
  if (out !== text) fs.writeFileSync(p, out), files++;
}

console.log(`${listed.size} sermons listed by branham.org; ${files} files and ${manifests} manifests rewritten`);
