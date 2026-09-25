// Common helpers for filtering and sorting the works collection.
// Centralised so category pages, the index, and search all behave consistently.

import { getCollection } from "astro:content";
import { deriveKind } from "./utils";
import ghostTags from "../../../manifests/mevar-tags.json";
import bibleRefs from "../../../manifests/bible-refs.json";
import { PREACHERS } from "../../../scripts/preachers.mjs";
import { parseRef } from "./bible.mjs";

export type WorkEntry = Awaited<ReturnType<typeof getCollection<"works">>>[number];

/** Cards per list page: no list page ships more than this many. */
export const PAGE_SIZE = 60;

/** Date used for sorting — published_at preferred, else date, else "" */
export function entryDate(e: WorkEntry): string {
  return (e.data.published_at as string) ?? (e.data.date as string) ?? "";
}

/**
 * Every work, deterministic sort: most recent first, ties broken by title.
 * A draft is never built, listed, counted or indexed: every route and list
 * goes through this filter. (The one exception is bookmarks.mjs, a rehype
 * plugin, which cannot read the collection and reads the frontmatter.) Ghost pages (a-propos, newsletter…) are pages of the
 * site with their own route, not works. A duplicate (goal 09) is not built
 * either: its URL answers 301 to the work it duplicates (astro.config.mjs).
 */
export async function allWorks(): Promise<WorkEntry[]> {
  const all = await getCollection(
    "works",
    (e) => e.data.status !== "draft" && e.data.type !== "page" && !e.data.duplicate_of,
  );
  return all.sort((a, b) => {
    const da = entryDate(a), db = entryDate(b);
    if (da !== db) return db.localeCompare(da);
    return (a.data.title ?? "").localeCompare(b.data.title ?? "");
  });
}

/**
 * Mevar is what mevar.org publishes: the Ghost posts, and a OneDrive or PDF
 * text once goal 10's editorial pass has promoted it (a duplicate is never
 * built, see allWorks). Everything else is the archive, listed below Mevar
 * and searched on request.
 */
export function isMevar(e: WorkEntry): boolean {
  const { source, editorial_pass } = e.data;
  return source === "mevar" || ((source === "mevar-pdfs" || source === "onedrive") && !!editorial_pass);
}

/** Mevar first, then the archive, keeping the order within each (sort is stable). */
const mevarFirst = (list: WorkEntry[]) => list.sort((a, b) => Number(isMevar(b)) - Number(isMevar(a)));

/** The archive's sources, in the order the « Archives » block lists them. */
export const ARCHIVE_SOURCES: Record<string, string> = {
  "mevar-pdfs": "PDF de la mission, non relus",
  onedrive: "Transcriptions de la mission, non relues",
  branham: "William Branham, texte anglais",
  "le-scribe": "Le Scribe, résumés en français",
  cmpp: "CMPP",
  local: "La vie de William Branham",
};

/** Ghost posts keep the root URL they had on Ghost; every other work lives under /works/. */
export function workUrl(e: WorkEntry): string {
  return e.data.source === "mevar" ? `/${e.id.slice("mevar/".length)}/` : `/works/${e.id}/`;
}

/** The work at a corpus path ("branham/1963/63-0112"), as `original` and `summary_fr` name it. */
export async function workAt(p: string): Promise<WorkEntry | undefined> {
  const works = await allWorks();
  return works.find((e) => e.filePath === `../markdown/${p}.md`);
}

/** The four lists, by URL: the Ghost tag and the kinds of work each holds. */
export const CATEGORIES: Record<string, { title: string; tag: string; kinds: string[] }> = {
  predications: { title: "Prédications", tag: "Prédications", kinds: ["sermon"] },
  exhortations: { title: "Exhortations", tag: "Exhortations", kinds: ["exhortation"] },
  "etudes-bibliques": { title: "Études bibliques", tag: "Etudes Bibliques", kinds: ["bible_study"] },
  publications: { title: "Publications", tag: "Publications", kinds: ["book", "article", "chapter"] },
};

/**
 * As on Ghost, a Ghost post is in each category it is tagged with (33 are both
 * « Prédications » and « Etudes Bibliques »), and in none without such a tag
 * (the « Chaîne de prière » months, « Nouveau site web »…: Samuel, 2026-09-25).
 * Any other work is in the category its tags name, or else its kind's.
 */
function inCategory(e: WorkEntry, category: string): boolean {
  const tags = Object.values(CATEGORIES).map((c) => c.tag).filter((t) => e.data.tags?.includes(t));
  if (tags.length || e.data.source === "mevar") return tags.includes(CATEGORIES[category].tag);
  return CATEGORIES[category].kinds.includes(deriveKind(e.data));
}

/** A category's works: the Mevar ones, and the archive's by source. */
export async function categoryWorks(category: string) {
  const all = await allWorks();
  const works = all.filter((e) => inCategory(e, category));
  const archive = Object.keys(ARCHIVE_SOURCES)
    .map((source) => ({ source, works: works.filter((e) => !isMevar(e) && e.data.source === source) }))
    .filter((a) => a.works.length);
  return { mevar: works.filter(isMevar), archive };
}

/** Featured / pinned for the home page (recent Mevar works) */
export async function recentMevar(limit = 6): Promise<WorkEntry[]> {
  const all = await allWorks();
  return all.filter(isMevar).slice(0, limit);
}

/** Stats for the home page: Mevar only, a count per category and the total. */
export async function corpusCounts() {
  const all = (await allWorks()).filter(isMevar);
  const c: Record<string, number> = { total: all.length };
  for (const category of Object.keys(CATEGORIES)) c[category] = all.filter((e) => inCategory(e, category)).length;
  return c;
}

// ─── Ghost taxonomy ──────────────────────────────────────────────────────────
// Tags and authors keep Ghost's slugs, so the redirects from Ghost's URLs land.

/** Place tags: they have a page, but the /themes/ list leaves them out. */
const PLACES = new Set([
  "abidjan", "arrah", "benin", "biasso", "bouake", "burkina-fasso", "congo-brazzaville",
  "cote-divoire", "cotonou", "dabou", "duekoue", "guiberoua", "hounde", "kouassikro",
  "koukloubo", "koumassi", "krakro", "lagos", "lausanne", "morofe", "mougnondzi", "muraz",
  "ndouffou", "nigeria", "pointe-noire", "sinfra", "so-tchanwe", "soubre", "suisse",
]);
const MONTHS = new Set(["janvier", "novembre", "aout"]);

/** Public Ghost tags, by name. */
export const tags = new Map<string, { name: string; slug: string; url: string; theme: boolean }>(
  ghostTags
    .filter((t) => t.visibility === "public")
    .map(({ name, slug }) => {
      const year = /^\d{4}$/.test(slug);
      const url = slug in CATEGORIES ? `/${slug}/` : year ? `/annees/${slug}/` : `/themes/${slug}/`;
      const theme = !(slug in CATEGORIES) && !year && !PLACES.has(slug) && !MONTHS.has(slug);
      return [name, { name, slug, url, theme }];
    }),
);

/** Mevar works carrying a Ghost tag, newest first. */
export async function worksTagged(name: string): Promise<WorkEntry[]> {
  const all = await allWorks();
  return all.filter((e) => isMevar(e) && e.data.tags?.includes(name));
}

// ─── Preachers ───────────────────────────────────────────────────────────────

type Preacher = (typeof PREACHERS)[number];
export { PREACHERS };

/**
 * A preacher's works: the Mevar ones, all of them for an archive preacher,
 * Mevar first, newest first. Ghost posts name theirs in `authors`, the rest in
 * `preacher`.
 */
export async function worksBy(p: Preacher): Promise<WorkEntry[]> {
  const all = await allWorks();
  return mevarFirst(all.filter(
    (e) => (p.archive || isMevar(e)) && (e.data.preacher === p.name || e.data.authors?.includes(p.name)),
  ));
}

// ─── Verse pages ─────────────────────────────────────────────────────────────

export interface Chapter {
  book: number;
  chapter: number;
  /** Works citing the whole chapter. */
  whole: WorkEntry[];
  /** Works citing each verse, by verse. */
  verses: Map<number, WorkEntry[]>;
}

/**
 * Every chapter a built work cites, from manifests/bible-refs.json (the
 * frontmatter keeps 50 refs a work). A range cites each of its verses. Each
 * list is Mevar first, then the archive, newest first in each.
 */
export async function bibleChapters(): Promise<Map<string, Chapter>> {
  const refs: Record<string, string[]> = bibleRefs;
  const map = new Map<string, Chapter>();
  for (const e of await allWorks()) {
    for (const ref of refs[e.filePath!.slice("../".length)] ?? []) {
      const { book, chapter, verses } = parseRef(ref);
      const key = `${book}/${chapter}`;
      if (!map.has(key)) map.set(key, { book, chapter, whole: [], verses: new Map() });
      const c = map.get(key)!;
      const lists = verses.length
        ? verses.map((v) => c.verses.get(v) ?? c.verses.set(v, []).get(v)!)
        : [c.whole];
      for (const list of lists) if (list.at(-1) !== e) list.push(e);
    }
  }
  for (const c of map.values()) {
    mevarFirst(c.whole);
    c.verses.forEach(mevarFirst);
  }
  return map;
}
