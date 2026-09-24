// Ghost served its feed at /rss/ and readers are subscribed to it:
// public/_redirects serves this file there.
import rss from "@astrojs/rss";
import type { APIContext } from "astro";
import { allWorks, entryDate, workUrl } from "$lib/works";
import { excerpt } from "$lib/bookmarks.mjs";

export async function GET(context: APIContext) {
  const posts = (await allWorks())
    .filter((e) => e.data.source === "mevar")
    .slice(0, 30);
  return rss({
    title: "Mevar",
    description: "Étude de la Parole pour le temps de la fin",
    site: context.site!,
    items: posts.map((e) => ({
      title: e.data.title,
      description: e.data.summary ?? excerpt(e.body ?? ""),
      link: workUrl(e),
      pubDate: new Date(entryDate(e)),
    })),
  });
}
