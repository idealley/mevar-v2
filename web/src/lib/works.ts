// Common helpers for filtering and sorting the works collection.
// Centralised so category pages, the index, and search all behave consistently.

import { getCollection } from "astro:content";
import { deriveKind } from "./utils";

export type WorkEntry = Awaited<ReturnType<typeof getCollection<"works">>>[number];

const IMPORT_TAG = /^#?Import\b/i;

/** Date used for sorting — published_at preferred, else date, else "" */
export function entryDate(e: WorkEntry): string {
  return (e.data.published_at as string) ?? (e.data.date as string) ?? "";
}

/** Cleaned tag list (drops Ghost auto-import tags) */
export function visibleTags(e: WorkEntry): string[] {
  return (e.data.tags ?? []).filter((t: string) => !IMPORT_TAG.test(t));
}

/** All works, deterministic sort: most recent first, ties broken by title */
export async function allWorks(): Promise<WorkEntry[]> {
  const all = await getCollection("works");
  return all.sort((a, b) => {
    const da = entryDate(a), db = entryDate(b);
    if (da !== db) return db.localeCompare(da);
    return (a.data.title ?? "").localeCompare(b.data.title ?? "");
  });
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
    .filter((e) => e.data.source === "mevar" && e.data.status === "published" && e.data.type === "post")
    .slice(0, limit);
}

/** Stats for the home page */
export async function corpusCounts() {
  const all = await getCollection("works");
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
