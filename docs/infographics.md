# Infographics and timelines

Ideas for visual pages, discussed with Samuel on 2026-09-25. None is built
or scheduled; the pedagogical layer is v1.1 (`VISION.md`, "Next"). This
file records what the corpus can already draw and what would have to be
written first, so a goal can be cut from it when the time comes.

Two families, distinguished by who writes the content. The first is
generated from frontmatter at build time and stays current with the
corpus. The second is authored, and every label in it comes from a work
in the corpus, never from a model.

## Constraints that apply to all of them

- Inline SVG in the page, no chart library, no JavaScript for the static
  ones. A few kilobytes per figure (`VISION.md`, the reader in Bouaké).
- Vertical layouts: the reader is on a phone.
- Every box or bar links to the works it counts. A figure that cannot be
  clicked through is decoration.
- The second family follows the hard rules of `AGENTS.md`: the preachers'
  words, the seeded Segond text, Samuel reads before it goes up.

## Family 1: generated from the corpus

### Bible map

The 66 books as a grid in canonical order, each cell shaded by the number
of works citing the book, each cell linking to `/bible/<livre>/`, which
exists. `bible_refs` is present on ~2,950 works (`manifests/bible-refs.json`).
Answers "where does this message rest in Scripture" for a reader who does
not know the Bible's structure. A second level per book, chapters as
small tiles, is a cheap extension.

### Branham timeline, 1947 to 1965, three layers

One row per year. Per year, three counts drawn from the corpus:

1. English originals: `markdown/branham/<year>/`, 1,206 sermons.
2. French summaries: `markdown/le-scribe/`, 910 summaries, 816 linked to
   their sermon by `summary_fr` on the Branham side (`49-link-le-scribe-branham.mjs`).
3. French translations: `markdown/cmpp/`, 107 works with
   `preacher: "William Branham"`, translated by the CMPP (Ewald Frank's
   French publishing side, cmpp.ch), all dated 1954 to 1965 in frontmatter
   but all filed under `markdown/cmpp/undated/`, and none linked to the
   English original today (`grep -l '^original:' markdown/cmpp` returns
   nothing). The Seven Seals series of March 1963 is there in full
   (`7sceaux1` to `7sceaux10`, plus the questions and answers).

The figure makes the "French summary or translation to English original"
promise of `VISION.md` visible, and it is an honest coverage indicator:
a year with a short French bar is a year where a francophone reader has
little. Two corpus facts it will expose, worth knowing before drawing it:

- 1961 has 92 English sermons and 9 French summaries (against 90 in 1960
  and 102 in 1962). Either Le-Scribe never covered that year or the
  discovery in `11-discover-le-scribe.mjs` missed a page.
- 1953 and 1954 have 90 and 79 English sermons and 8 and 3 summaries.

Counts per year as of today (English / Le-Scribe / CMPP):

| Year | EN | FR summary | FR translation |
| ---- | --: | --: | --: |
| 1947 | 6 | 6 | 0 |
| 1948 | 4 | 2 | 0 |
| 1949 | 2 | 2 | 0 |
| 1950 | 31 | 27 | 0 |
| 1951 | 31 | 28 | 0 |
| 1952 | 21 | 13 | 0 |
| 1953 | 90 | 8 | 0 |
| 1954 | 79 | 3 | 1 |
| 1955 | 88 | 78 | 0 |
| 1956 | 82 | 71 | 0 |
| 1957 | 93 | 80 | 0 |
| 1958 | 88 | 82 | 0 |
| 1959 | 83 | 78 | 3 |
| 1960 | 91 | 90 | 12 |
| 1961 | 92 | 9 | 4 |
| 1962 | 101 | 102 | 7 |
| 1963 | 95 | 94 | 34 |
| 1964 | 76 | 76 | 12 |
| 1965 | 53 | 50 | 25 |

Prerequisite: a link from each CMPP translation to its Branham sermon,
the way script 49 does it for Le-Scribe (by date, then title against the
English title). Without it the third bar counts files, not sermons, and
the work page cannot offer "lire l'original". That is
goal 13 (`goals/goal-13-cmpp-complete.md`), which also rediscovers
cmpp.ch, so the counts above will move.

Open question: whether the same figure should carry the other French
voices of the corpus (Ewald Frank's own 128 works and Alexis Barilier's 6
in `cmpp`, 1972 to 2026) as a second timeline below, or whether that is a
separate "CMPP timeline". They are not Branham, so they do not belong on
the Branham bars.

### MEVAR timeline, 2004 to today

One row per year with the sermons preached that year (the `year` field,
2004 to 2026; 2020 alone has 72) and the places tagged (Koumassi, Abidjan,
Pointe-Noire, Lagos, Cotonou, Houndé, Lausanne, from `mevar-tags.json`).
Tells the story of the mission with no new text. A small outline map of
the countries where preaching happened (Côte d'Ivoire, Congo, Bénin,
Burkina Faso, Nigeria, Suisse) could sit beside it; it is a design piece,
not data, and optional.

### Series as paths

Each declared series (`manifests/mevar-series.json`: Faire front par la
Foi, Le fruit de l'Esprit, Le jour du Seigneur, Le ministère de l'Esprit,
Le nouveau ministère; more once the tags "Le Message des Sept Sceaux",
"Les signes d'un ministère authentique", "Le sermon sur la montagne" are
declared as series) drawn as numbered steps, each step with the Scripture
the part rests on. This is "series presented as courses" from `VISION.md`
and the most directly pedagogical figure of the family.

## Family 2: authored teaching figures

Diagrams where every box links to the sermon that teaches it. Candidates
the corpus supports today:

- The seven seals of Apocalypse 6 to 8: one MEVAR sermon per horseman
  (white, red and black, pale), one for the 4th to 6th seals, one for the
  7th, and the CMPP translation of the 1963 series behind them.
- The end-time sequence as taught in "Le jour du Seigneur" (parts 1 to 5,
  "Ce qui arrive", "Ceux de la grande tribulation" 1 and 2, "Qui sera
  enlevé ?").
- The seven church ages, mentioned in 102 MEVAR sermons.
- The nine fruits of the Spirit (three sermons exist: amour, joie, paix).
- The five ministries of the Word (one sermon).
- The three dimensions of Israel, from Samuel's outline in
  `ideas/israel.md`.

Each of these is an editorial work with a picture: authored under MEVAR's
name, its labels and order taken from the sermons it links to, its verses
from the seeded text, and read by Samuel before publication. Not something
an agent derives.

## Suggested order

Bible map and series paths first: pure data, they serve "clear and
pedagogical" directly, and they tell us whether this kind of page earns
its place before the authored family is started. The Branham timeline
next, once the CMPP link exists.
