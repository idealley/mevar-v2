// Common helpers for filtering and sorting the works collection.
// Centralised so category pages, the index, and search all behave consistently.

import { getCollection } from "astro:content";
import { deriveKind } from "./utils";
import ghostTags from "../../../manifests/mevar-tags.json";
import ghostAuthors from "../../../manifests/mevar-authors.json";

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

/** The four lists, by URL, with the kinds of work each holds. */
export const CATEGORIES: Record<string, { title: string; kinds: string[] }> = {
  predications: { title: "Prédications", kinds: ["sermon"] },
  exhortations: { title: "Exhortations", kinds: ["exhortation"] },
  "etudes-bibliques": { title: "Études bibliques", kinds: ["bible_study"] },
  publications: { title: "Publications", kinds: ["book", "article", "chapter"] },
};

/**
 * A category's works: the Mevar ones, and the archive's by source. The source
 * is the work's directory: ten works have no frontmatter to name it.
 */
export async function categoryWorks(category: string) {
  const all = await allWorks();
  const works = all.filter((e) => CATEGORIES[category].kinds.includes(deriveKind(e.data)));
  const archive = Object.keys(ARCHIVE_SOURCES)
    .map((source) => ({ source, works: works.filter((e) => !isMevar(e) && e.id.startsWith(`${source}/`)) }))
    .filter((a) => a.works.length);
  return { mevar: works.filter(isMevar), archive };
}

/** Featured / pinned for the home page (recent Mevar works) */
export async function recentMevar(limit = 6): Promise<WorkEntry[]> {
  const all = await allWorks();
  return all.filter(isMevar).slice(0, limit);
}

/** Stats for the home page: Mevar only. */
export async function corpusCounts() {
  const all = (await allWorks()).filter(isMevar);
  const c = { total: all.length, sermons: 0, books: 0, studies: 0, exhortations: 0, articles: 0 };
  for (const e of all) {
    const k = deriveKind(e.data);
    if (k === "sermon") c.sermons++;
    else if (k === "book") c.books++;
    else if (k === "bible_study") c.studies++;
    else if (k === "exhortation") c.exhortations++;
    else if (k === "article") c.articles++;
  }
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

// Name and slug only: the manifest also holds the authors' email addresses.
export const authors = ghostAuthors.map(({ name, slug }) => ({ name, slug }));

/** Mevar works by a Ghost author, newest first. */
export async function worksBy(name: string): Promise<WorkEntry[]> {
  const all = await allWorks();
  return all.filter((e) => isMevar(e) && e.data.authors?.includes(name));
}
