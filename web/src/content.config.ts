// Astro content collections
// We point the `works` loader at the project-root markdown/ tree so the same
// 3,100-file corpus that feeds SurrealDB also feeds the static site.

import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const KIND = z.enum([
  "sermon", "exhortation", "bible_study", "book",
  "chapter", "article", "testimony", "communique",
]);

const SOURCE = z.enum([
  "branham", "mevar", "le-scribe", "mevar-pdfs", "onedrive", "cmpp", "local",
]);

// Loose frontmatter schema — only fields the site reads at build time.
// Anything else (ghost_id, uuid, hash, source_path, aliases…) is ignored
// gracefully via `passthrough()`.
const works = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "../markdown" }),
  schema: z.object({
    source: SOURCE.optional(),
    sermon_id: z.string().optional(),
    title: z.string().optional(),
    subtitle: z.string().optional().nullable(),
    date: z.string().optional().nullable(),
    year: z.number().optional().nullable(),
    location: z.string().optional().nullable(),
    preacher: z.string().optional().nullable(),
    duration: z.string().optional().nullable(),
    summary: z.string().optional().nullable(),
    tags: z.array(z.string()).optional(),
    persons: z.array(z.string()).optional(),
    places: z.array(z.string()).optional(),
    themes: z.array(z.string()).optional(),
    feature_image: z.string().optional().nullable(),
    local_image: z.string().optional().nullable(),
    pdf_url: z.string().optional().nullable(),
    audio_url: z.string().optional().nullable(),
    stream_url: z.string().optional().nullable(),
    url: z.string().optional().nullable(),
    type: z.string().optional().nullable(),
    status: z.string().optional().nullable(),
    authors: z.array(z.string()).optional(),
    llm_cleaned: z.boolean().optional(),
    // Inferred field set by getEntry handler:
    kind: KIND.optional(),
  }).passthrough(),
});

export const collections = { works };
