# MEVAR vision

Why mevar.org exists and what it never trades away. `AGENTS.md` says how
agents work here; `docs/goals/` says what is being built now.

## The mission (in MEVAR's own words)

MEVAR, Mission d'Évangélisation et de Réveil, exists to wake Christians up
and to evangelise the world. MEVAR is not an organisation and asks for no
money; it is a group of Christians who believe the end-time message, the
return of Christ and the Word of God, and who are part of the Church of
Christ. The full statement is the "À propos" page in the corpus
(`markdown/mevar/a-propos.md`) and it is authoritative over this file.

## What the site is

The library of that message in French: the sermons, exhortations, Bible
studies and books of the preachers of MEVAR, the French summaries of William
Branham's sermons, the English transcripts they summarise, and the related
publications, in one place, free, with every link working. Republication of
the third-party texts is done with written permission.

The site is a place to read and study, not a feed. A reader should be able to
find where to start, follow a series in order, see which Scripture a sermon
rests on, and move from a French summary to the English original. That is
what "clear and pedagogical" means here, and it is the standard every page is
judged by.

## Who reads it

Most visits come from francophone Africa, on phones, over slow and metered
connections that come and go. This is the first constraint of the project,
before any technical taste:

- a page must be light, with no third-party request in the way of the text;
- what a reader has opened stays readable offline;
- nothing on the site depends on a server being awake, a database answering
  or a paid service staying paid.

A design that serves a reader in Lausanne on fibre and fails a reader in
Bouaké on 3G has failed.

## What must persist

The corpus outlives every tool used to publish it. It is plain markdown with
frontmatter in a git repository, and everything else (the site, the search
index, the manifests, the knowledge graph) is derived from it and can be
rebuilt. Ghost served the site for years and is being retired; the next tool
will be retired one day too. The texts, their metadata, their Scripture
references and their links to each other are the asset, and they belong to
no vendor.

The preachers' words are kept as they were preached. Transcription errors
are corrected, layout is normalised, missing Scripture readings are inserted
from the Bible text, and nothing else changes. A summary is labelled as a
summary; a translation as a translation.

## Horizons

**Now (v1).** The whole corpus published on the new site, every old URL still
working, search that works offline, the newsletter on a sender MEVAR
controls, Ghost switched off.

**Next (v1.1).** The pedagogical layer: reading paths for someone new to the
message, series presented as courses, Scripture references that open the
verse in place, the French summary and the English original side by side.

**Later.** Study tools for individuals: personal notes and highlights that
belong to the reader, offline libraries for a whole series, audio where it
exists. Each arrives when a reader asks for it, not before.

## What it is not

Not a social network, not a fundraising platform, not a portal with accounts
to sign up for before reading. Nothing is gated behind a login. Nothing
tracks readers beyond the counts needed to know the site works.
