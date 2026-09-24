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
 * site with their own route, not works.
 */
export async function allWorks(): Promise<WorkEntry[]> {
  const all = await getCollection("works", (e) => e.data.status !== "draft" && e.data.type !== "page");
  return all.sort((a, b) => {
    const da = entryDate(a), db = entryDate(b);
    if (da !== db) return db.localeCompare(da);
    return (a.data.title ?? "").localeCompare(b.data.title ?? "");
  });
}

/** Ghost posts keep the root URL they had on Ghost; every other work lives under /works/. */
export function workUrl(e: WorkEntry): string {
  return e.data.source === "mevar" ? `/${e.id.slice("mevar/".length)}/` : `/works/${e.id}/`;
}

/** The work at a corpus path ("branham/1963/63-0112"), as `original` and `summary_fr` name it. */
export async function workAt(p: string): Promise<WorkEntry | undefined> {
  const works = await allWorks();
  return works.find((e) => e.filePath === `../markdown/${p}.md`);
}

/** Works of a given kind (sermon | exhortation | bible_study | …) */
export async function worksByKind(kind: string): Promise<WorkEntry[]> {
  const all = await allWorks();
  return all.filter((e) => deriveKind(e.data) === kind);
}

/** Featured / pinned for the home page (recent published mevar posts) */
export async function recentMevar(limit = 6): Promise<WorkEntry[]> {
  const all = await allWorks();
  return all
    .filter((e) => e.data.source === "mevar")
    .slice(0, limit);
}

/** Stats for the home page */
export async function corpusCounts() {
  const all = await allWorks();
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

/** Ghost tags that are the four categories: they link to the category page. */
const CATEGORIES = new Set(["predications", "exhortations", "etudes-bibliques", "publications"]);
/** Place tags: they have a page, but the /themes/ list leaves them out. */
const PLACES = new Set([
  "abidjan", "benin", "biasso", "bouake", "burkina-fasso", "congo-brazzaville",
  "cote-divoire", "cotonou", "dabou", "guiberoua", "hounde", "kouassikro",
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
      const url = CATEGORIES.has(slug) ? `/${slug}/` : year ? `/annees/${slug}/` : `/themes/${slug}/`;
      const theme = !CATEGORIES.has(slug) && !year && !PLACES.has(slug) && !MONTHS.has(slug);
      return [name, { name, slug, url, theme }];
    }),
);

// Name and slug only: the manifest also holds the authors' email addresses.
export const authors = ghostAuthors.map(({ name, slug }) => ({ name, slug }));

/** Published Ghost posts carrying a tag, newest first. */
export async function worksTagged(name: string): Promise<WorkEntry[]> {
  const all = await allWorks();
  return all.filter((e) => e.data.source === "mevar" && e.data.tags?.includes(name));
}

/** Published Ghost posts by an author, newest first. */
export async function worksBy(name: string): Promise<WorkEntry[]> {
  const all = await allWorks();
  return all.filter((e) => e.data.source === "mevar" && e.data.authors?.includes(name));
}
