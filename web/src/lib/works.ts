// Common helpers for filtering and sorting the works collection.
// Centralised so category pages, the index, and search all behave consistently.

import { getCollection } from "astro:content";
import { deriveKind, formatDateShort } from "./utils";
import ghostTags from "../../../manifests/mevar-tags.json";
import bibleRefs from "../../../manifests/bible-refs.json";
import { PREACHERS } from "../../../scripts/preachers.mjs";
import { slug } from "github-slugger";
import { parseRef } from "./bible.mjs";
import { excerpt } from "./bookmarks.mjs";

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
  return e.id.startsWith("mevar/") ? `/${e.id.slice("mevar/".length)}/` : `/works/${e.id}/`;
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

/** The list a card names above its title and a work page leads back to: the first a work is in. */
export function categoryOf(e: WorkEntry): { slug: string; title: string } | undefined {
  const slug = Object.keys(CATEGORIES).find((c) => inCategory(e, c));
  return slug ? { slug, title: CATEGORIES[slug].title } : undefined;
}

// ─── What a card and a work page show of a work ──────────────────────────────

const KIND_LABEL: Record<string, string> = {
  sermon: "Prédication",
  exhortation: "Exhortation",
  bible_study: "Étude biblique",
  book: "Livre",
  chapter: "Chapitre",
  article: "Article",
  testimony: "Témoignage",
  communique: "Communiqué",
};
/** "Exhortation": what kind of text a work is, in one word. */
export const kindLabel = (e: WorkEntry): string => KIND_LABEL[deriveKind(e.data)];

/** Ghost posts name their preacher in `authors`, the other sources in `preacher`. */
export const preacherOf = (e: WorkEntry): string | undefined => e.data.preacher ?? e.data.authors?.[0];

/** Minutes to read the body, at 200 words a minute. */
export const minutes = (e: WorkEntry): number => Math.max(1, Math.round((e.body?.split(/\s+/).length ?? 0) / 200));

/** Its summary, or else the opening of its own words: a text often opens on a Scripture reading. */
export const excerptOf = (e: WorkEntry): string | undefined => e.data.summary ?? excerpt((e.body ?? "").replace(/^>.*$/gm, ""));

/** "Parfait M'bra   ·   41 min de lecture": what a card says of a work, on one line, spaced as the design spaces it. */
export const dots = (...parts: unknown[]): string => parts.filter(Boolean).join("\u00a0\u00a0 · \u00a0\u00a0");

/** The references a work cites, in the order it cites them (frontmatter, goal 12). */
export const refsOf = (e: WorkEntry): string[] => (e.data.bible_refs as string[] | undefined) ?? [];

/** "10 sept. 2026", or the year alone when that is all a work has. */
export function shortDate(e: WorkEntry): string | undefined {
  const d = entryDate(e);
  return /^\d{4}-\d{2}-\d{2}/.test(d) ? formatDateShort(d.slice(0, 10)) : e.data.year ? String(e.data.year) : undefined;
}

/**
 * What to read after a work: the next part of its series, then the texts
 * that follow it (older) in its list, among Mevar's or among its own source's.
 */
export async function nextWorks(e: WorkEntry): Promise<WorkEntry[]> {
  const all = await allWorks();
  const category = categoryOf(e)?.slug;
  const list = all.filter((o) => isMevar(o) === isMevar(e) && (isMevar(e) || o.data.source === e.data.source) && categoryOf(o)?.slug === category);
  const at = list.findIndex((o) => o.id === e.id);
  const part = e.data.series && all.find((o) => o.data.series === e.data.series && o.data.series_part === (e.data.series_part as number) + 1);
  const after = [...list.slice(at + 1), ...list.slice(0, at)].filter((o) => o !== part);
  return [...(part ? [part] : []), ...after].slice(0, 2);
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

/** The Mevar works, newest first: what the home page draws from. */
export async function mevarWorks(): Promise<WorkEntry[]> {
  return (await allWorks()).filter(isMevar);
}

/** The series of the Mevar works, each in reading order, the one read most recently first. */
export async function seriesList(): Promise<{ name: string; slug: string; parts: WorkEntry[] }[]> {
  const byName = new Map<string, WorkEntry[]>();
  for (const e of await mevarWorks()) {
    const name = e.data.series as string | undefined;
    if (name) byName.set(name, [...(byName.get(name) ?? []), e]);
  }
  return [...byName].map(([name, parts]) => ({
    name,
    slug: slug(name),
    parts: parts.sort((a, b) => (a.data.series_part as number) - (b.data.series_part as number)),
  }));
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
 * Every chapter a built work cites, from manifests/bible-refs.json. A range
 * cites each of its verses. Each list is Mevar first, then the archive,
 * newest first in each.
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

/** Every book a built work cites, in the Bible's order: the works citing it, and each chapter's. */
export async function bibleBooks(): Promise<{ book: number; works: Set<WorkEntry>; chapters: { chapter: number; works: Set<WorkEntry> }[] }[]> {
  const books = new Map<number, { book: number; works: Set<WorkEntry>; chapters: { chapter: number; works: Set<WorkEntry> }[] }>();
  for (const c of (await bibleChapters()).values()) {
    const b = books.get(c.book) ?? books.set(c.book, { book: c.book, works: new Set(), chapters: [] }).get(c.book)!;
    const works = new Set([...c.whole, ...[...c.verses.values()].flat()]);
    b.chapters.push({ chapter: c.chapter, works });
    works.forEach((e) => b.works.add(e));
  }
  for (const b of books.values()) b.chapters.sort((x, y) => x.chapter - y.chapter);
  return [...books.values()].sort((x, y) => x.book - y.book);
}
