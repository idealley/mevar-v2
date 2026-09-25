// One name per preacher. Edited by hand, like bible-books.mjs: 67 rewrites the
// `preacher` field of every work from it, and the site reads it for the author
// pages. The field is metadata; the bodies keep what the transcript says.
//
// `name` is the display name, given name first, as on the Ghost author pages
// (Samuel, 2026-09-24). `slug` is the author page, /auteurs/<slug>/; a Ghost
// author keeps Ghost's slug, which goal 03's redirects land on. `variants` are
// the spellings seen; a title ("Fr", "Frère", "Pasteur"), case and accents are
// not part of a spelling (see `key`). `archive`: listed under « Archives ».

export const PREACHERS = [
  {
    name: "Parfait M'bra",
    slug: "parfait-mbra",
    variants: ["M'BRA Parfait", "Parfait MBRA"],
  },
  { name: "Samuel Pouyt", slug: "samuel", variants: ["Pouyt Samuel"] },
  { name: "Stéphane Pouyt", slug: "stephane-pouyt", variants: [] },
  {
    name: "André Kadjany",
    slug: "andre-kadjany",
    variants: ["KADJANY André", "KADJANY YOBOUET ANDRE", "KADJANY"],
  },
  { name: "Pierre Kouadio", slug: "pierre-kouadio", variants: ["KOUADIO Pierre"] },
  { name: "Irié Anderson", slug: "irie", variants: ["Anderson Irié"] },
  { name: "Richard Schwéry", slug: "richard-schwery", variants: [] },
  { name: "Christian Kayenga Kalubi", slug: "christian-kayenga-kalubi", variants: [] },
  { name: "Nandy Noël Gbaha", slug: "nandy-noel-gbaha", variants: [] },
  // Full names unknown (Samuel, 2026-09-24): as the texts name them.
  { name: "Frère Doubbin", slug: "frere-doubbin", variants: [] },
  { name: "Rigobert de Cotonou", slug: "rigobert-de-cotonou", variants: [] },
  { name: "William Branham", slug: "william-branham", variants: ["William Marrion Branham"], archive: true },
  { name: "Ewald Frank", slug: "ewald-frank", variants: [], archive: true },
  { name: "Alexis Barilier", slug: "alexis-barilier", variants: [], archive: true },
];

/** A spelling without its title, case, accents or apostrophe style: "Fr. M’BRA Parfait" -> "m'bra parfait". */
export function key(spelling) {
  return spelling
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/’/g, "'")
    .toLowerCase()
    .replace(/^(?:fr\.?|frere|pasteur)\s+/, "")
    .trim();
}
