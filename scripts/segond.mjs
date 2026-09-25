// A Scripture reading as goal 10's editorial pass inserts it: the Louis Segond
// verses from SurrealDB (bible_verse, seeded by 110), rendered in the house
// style of goal 04, `> _**1**Adam connut Ève… **2**Elle enfanta…_`. The pass
// (85) writes it, the check (86) verifies it against the same records.

import { Surreal, RecordId } from "surrealdb";
import { BOOKS_FR } from "./bible-books.mjs";

export async function connect() {
  const db = new Surreal();
  await db.connect(`${process.env.SURREAL_URL ?? "http://localhost:8000"}/rpc`);
  await db.signin({ username: process.env.SURREAL_USER ?? "root", password: process.env.SURREAL_PASS ?? "root" });
  await db.use({ namespace: process.env.SURREAL_NS ?? "revelation", database: process.env.SURREAL_DB ?? "main" });
  return db;
}

// The seeded text carries thin spaces (U+2009) where the source had italics:
// "Abel\u2009. Abel fut berger\u2009, et Caïn\u2009 fut". They go; the no-break
// spaces French puts before ; : ! ? are U+202F and stay.
const tidy = (s) => s.replace(/\u2009(?=[\s.,])/g, "").replace(/\u2009/g, " ").trim();

// "Luc 6:43-45" (a canonical ref from 65's citations()) → the verses, or null
// when it is not one chapter with a verse or a verse range.
export async function reading(db, ref) {
  const m = ref.match(/^(.+) (\d+):(\d+)(?:-(\d+))?$/);
  if (!m) return null;
  const order = BOOKS_FR.findIndex((row) => row[0] === m[1]) + 1;
  const [chapter, start] = [Number(m[2]), Number(m[3])];
  const ids = [];
  for (let v = start; v <= Number(m[4] ?? start); v++) ids.push(new RecordId("bible_verse", [order, chapter, v]));
  const [rows] = await db.query("SELECT id, lsg FROM $ids", { ids });
  if (!ids.length || rows.length !== ids.length) return null;
  return rows.map((r) => ({ n: r.id.id[2], text: tidy(r.lsg) })).sort((a, b) => a.n - b.n);
}

export const blockquote = (verses) => `> _${verses.map((v) => `**${v.n}**${v.text}`).join(" ")}_`;
