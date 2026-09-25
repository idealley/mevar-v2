# GOAL 11: The French citations said aloud are found

**Status:** done (dispatched 2026-09-24 by Samuel, after PR #8; merged as
PR #11, 2026-09-25; landing check on `main` the same day)
**Repo:** `mevar-v2` (`scripts/65-normalize-bible.mjs`, `manifests/bible-refs.json`,
`index.json`, the `bible_refs` frontmatter of the French sources, `docs/`)
**Depends on:** 07 (merged as PR #2 and PR #8)
**Rules:** [README.md](README.md)

## Problem

`65` finds a French citation only when a number follows the book name:
"Marc 11", "Jean 3:16". A preacher reading his text aloud says it in
words: "Nous allons lire dans 2 Corinthiens, chapitre 3", "Luc chapitre 18
verset 9", "le chapitre 24 de Matthieu". None of these is recorded.

Goal 07 taught `66` the English forms ("Saint John the 4th chapter"); `65` has
no French equivalent. PR #8 made one visible: `le-ministere-de-lesprit` held
`2 Corinthiens 3` only because a Ghost bookmark card quoted it, and lost it
when goal 03 removed the card.

Measured on 2026-09-24 in `mevar`, `onedrive`, `le-scribe`, `cmpp` and
`local`, with the patterns below: 1,429 spots of the form "<Livre> chapitre
N", 199 of the form "chapitre N de <Livre>".

## Work items

1. **Two spoken patterns in `65`**, as in `66`:
   - `<Livre>,? (au |le )?chapitre N`
   - `(<verse> du )?chapitre N (du livre |de l'épître |de l'Évangile )?(de la |de l'|des |de |d'|aux |selon )<Livre>`,
     the verse before the chapter being "le verset M", "le premier verset",
     "le Mème verset", "les versets M à P" or "verset M et P"

   The chapter can be followed by its verse, in the forms the texts use:
   "chapitre N:M", "chapitre N : M", "chapitre N.M" (CMPP), "verset M", "le
   verset M", "au verset M", "et au verset M", "(versets M-P", "versets M à
   P", "à partir du verset M", "depuis le verset M", "dès le verset M", "à
   partir du premier verset", "au verset premier", "du verset M au verset P",
   "à partir du verset M jusqu'au verset P", and a second verse or range after
   "et" or a comma ("versets 12 et 15", "11.25,26"). "À partir du verset M" is
   recorded as `N:M`, the verse where the reading starts.
2. **Only a full book name.** The spoken form is never abbreviated, and the
   abbreviations are words: "on a **lu** le chapitre 11", "c'**est** au
   chapitre 17", "le texte **hébreu**, au chapitre 18". Case does not matter:
   the transcripts write "dans apocalypse chapitre 12".
3. **The text is not rewritten.** The ref goes to `bible-refs.json` in the
   canonical form; the body stays as said (AGENTS.md hard rule 1).
4. **Regenerate**: 65, then 47 and 50.
5. **Docs**: `docs/data-pipeline.md` names the spoken forms for 65;
   `docs/follow-ups.md` drops "65 does not read '<Livre>, chapitre N'".

## Scope out

- Numbers written in words ("APOCALYPSE, CHAPITRE CINQ", "chapitre
  premier").
- Spellings that are not in `BOOKS_FR` ("Mathieu"): a new variant also
  changes what the numeric pattern reads, its own change.
- A verse separated from its chapter by other words ("Luc chapitre 1, nous
  lisons à partir du verset 26" records `Luc 1`).
- Branham (`66`, goal 07) and the text of any work.

## Acceptance evidence

- `le-ministere-de-lesprit` has `2 Corinthiens 3` again.
- French refs before and after: count, and files with refs. Every added
  ref comes from a spoken pattern; no ref disappears from `bible-refs.json`.
  (The frontmatter keeps 50 refs a file, alphabetically: a new ref can push
  an old one out. Counted and listed, not fixed here; see `docs/follow-ups.md`.)
- Twenty random added refs, each shown with its sentence and checked by hand.
- Every distinct book word the patterns matched in lowercase, listed and
  checked by hand.
- `git diff` on `markdown/` touches only `bible_refs` frontmatter; Branham
  refs unchanged.
- 65, 47 and 50: a second run is a no-op.

## Follow-up

Landing check against `main`, 2026-09-25: a rerun of 65, 66, 47, 49 and 50
leaves `git status` clean; `le-ministere-de-lesprit` has `2 Corinthiens 3`
and `jesus-et-marie` `Actes 1:12-14`. The 50-ref cap then hid 3,946 refs in
90 works, the 38 it took from goal 11 included; that is goal 12.
