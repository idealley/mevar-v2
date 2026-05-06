import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Format a YYYY-MM-DD string into a French long-form date for human display.
export function formatDateFr(d: string | null | undefined): string | null {
  if (!d) return null;
  const m = d.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return d;
  const months = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
  return `${parseInt(m[3], 10)} ${months[parseInt(m[2], 10) - 1]} ${m[1]}`;
}

// Derive `kind` from frontmatter when not explicitly set.
export function deriveKind(fm: Record<string, any>): string {
  if (fm.kind) return fm.kind;
  const tags = fm.tags ?? [];
  if (tags.includes("Prédications")) return "sermon";
  if (tags.includes("Exhortations")) return "exhortation";
  if (tags.includes("Etudes Bibliques")) return "bible_study";
  if (tags.includes("Publications")) return "article";
  if (fm.source === "branham" || fm.source === "le-scribe") return "sermon";
  if (fm.source === "cmpp") return "bible_study";
  if (fm.source === "local") return "book";
  if (fm.subtitle?.toLowerCase()?.startsWith("exhortation")) return "exhortation";
  if (/chap\d+ministere/i.test(fm.sermon_id ?? "")) return "chapter";
  return "article";
}
