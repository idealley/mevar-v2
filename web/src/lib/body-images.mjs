// Images in a work's body: lazy, and with their size, so the text does not
// jump while a phone downloads them. 21 are files under /images/; one is an
// inline data: PNG (onedrive, "Un peuple de sacrificateurs"). Runs on every
// work's body at build time.

import { imageMetadata } from "astro/assets/utils";
import { readFile } from "node:fs/promises";

export function rehypeBodyImages() {
  return async (tree) => {
    const imgs = [];
    (function walk(node) {
      if (node.tagName === "img") imgs.push(node.properties);
      node.children?.forEach(walk);
    })(tree);
    for (const img of imgs) {
      img.loading = "lazy";
      img.decoding = "async";
      if (!img.src.startsWith("/images/")) continue;
      // Relative to web/, where the build runs.
      const { width, height } = await imageMetadata(await readFile(`public${decodeURI(img.src)}`));
      Object.assign(img, { width, height });
    }
  };
}
