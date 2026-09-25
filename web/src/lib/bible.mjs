// A reference as 65 and 66 record it ("Jean 5:19-21,24", "John 5:19") and
// where its verse page is. A book is its position in scripts/bible-books.mjs,
// whose French and English tables are in the same order: "Jean 5:19" and
// "John 5:19" are the same verse. The page is named for the French book.

import { BOOKS_EN, BOOKS_FR } from "../../../scripts/bible-books.mjs";

const BOOK = new Map([...BOOKS_FR.map((row, i) => [row[0], i]), ...BOOKS_EN.map((row, i) => [row[0], i])]);

/** "Jean 5:19-21,24" -> { book: 42, chapter: 5, verses: [19, 20, 21, 24] }; no verses for a whole chapter. */
export function parseRef(ref) {
  const [, name, chapter, list] = ref.match(/^(.+) (\d+)(?::(.+))?$/);
  const verses = [];
  for (const part of list?.split(",") ?? []) {
    const [from, to = from] = part.split("-").map(Number);
    for (let v = from; v <= Math.max(from, to); v++) verses.push(v);
  }
  return { book: BOOK.get(name), chapter: Number(chapter), verses };
}

/** The French name of a book: "Éphésiens". */
export const bookName = (book) => BOOKS_FR[book][0];

/** "/bible/ephesiens/4/" */
export function chapterUrl(book, chapter) {
  const slug = bookName(book).normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replaceAll(" ", "-");
  return `/bible/${slug}/${chapter}/`;
}
