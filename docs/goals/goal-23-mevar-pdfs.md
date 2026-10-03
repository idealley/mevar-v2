# GOAL 23: Every edited Mevar text offers its PDFs

## Problem

Goal 10 edited 170 texts from the OneDrive folder and the mevar.org PDFs.
Their pages offer no PDF: the OneDrive texts have no `local_pdf` or
`pdf_url` (only « Le Royaume de Dieu », a mevar.org PDF, has one). A
reader who wants to print or keep a sermon cannot.

## Samuel's answers (2026-10-03)

- Each page offers **both**: a PDF made from the edited text, the main
  download, and the original, « PDF d'origine ».
- The originals are published as they are, contact details included:
  « they are published like this and it was published at that time on
  purpose ».

## Work items

1. **`scripts/90-mevar-pdfs.mjs`**, for every text goal 10 promoted
   (`editorial_pass`, source `onedrive` or `mevar-pdfs`, not a duplicate):
   - the original: the OneDrive PDF the text was edited from (for a split
     work, the PDF it was printed in), copied to `files/onedrive/`, and
     `local_pdf` set; a mevar.org PDF already has its `local_pdf`;
   - the edited PDF: built from the text and its frontmatter (title,
     subtitle, and the line the page shows: preacher, date, place), with
     its page numbers at each page's foot, to
     `files/mevar-edited/<slug>.pdf`, and `edited_pdf` set. A text holding
     what the PDF does not render (HTML, code) is refused, not garbled.
   Deterministic: a second run is a no-op (fixed creation date, the
   `editorial_pass`); it deletes only edited PDFs it made that no text
   names any more.
2. **The pages**: « PDF » downloads `edited_pdf` where there is one, and
   « PDF d'origine » the original; elsewhere, as before.
3. **Dependencies**: `pdfkit` (writes the PDFs; nothing in the repository
   does) and `@expo-google-fonts/noto-serif` (an open font with the full
   Latin range embedded in each PDF: « Wojtyła », « 50ᵉ »; the PDF
   standard fonts lack them). Both only at the script's run, not on the
   site.

## Acceptance evidence

- Every promoted OneDrive or mevar.org text names an `edited_pdf` and an
  original, both files present; `check:dist` resolves every link.
- 90 run twice: the second run changes nothing.
- Three edited PDFs opened and read against their pages.
- Build and `check:dist` pass.

## Stop points

- The repository grows by the PDFs (about 28 MB of originals); Samuel
  sees the size in the PR.

## Follow-up

- 90 reads frontmatter with the same small helpers as 86 and 88 (`field`,
  `frontmatter`, `slug`); naming them once in a shared module touches
  those two scripts, outside this goal. Found by goal 23's review.
