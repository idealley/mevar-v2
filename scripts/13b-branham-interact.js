// Run via: firecrawl interact -s <scrapeId> -c "$(cat scripts/13b-branham-interact.js)" --node
const years = Array.from({ length: 18 }, (_, i) => 1947 + i);
const results = {};
for (const y of years) {
  const yy = String(y).slice(2);
  await page.evaluate((yy) => {
    searchdata('wmSearchByYear', '../branham/messageaudio.aspx', 'search_results', `${yy}-`);
  }, yy);
  await page.waitForFunction(
    (yy) => {
      const c = document.querySelector('#search_results');
      if (!c) return false;
      return c.querySelectorAll(`a[href*="messagestream/ENG=${yy}-"]`).length > 0
        || (c.innerText || '').includes('No Results');
    },
    yy,
    { timeout: 20000 },
  ).catch(() => {});
  await page.waitForTimeout(500);
  const sermons = await page.evaluate((yy) => {
    const out = [];
    const container = document.querySelector('#search_results');
    if (!container) return out;
    const links = Array.from(container.querySelectorAll(`a[href*="messagestream/ENG=${yy}-"]`));
    for (const sl of links) {
      const id = sl.href.match(/ENG=([\w-]+)/)?.[1];
      let row = sl;
      let pdf = null, audio = null;
      for (let i = 0; i < 8 && row && (!pdf || !audio); i++) {
        pdf ??= row.querySelector?.('a[href$=".pdf"]')?.href ?? null;
        audio ??= row.querySelector?.('a[href$=".m4a"]')?.href ?? null;
        row = row.parentElement;
      }
      let title = '';
      let tnode = sl.closest('tr');
      if (tnode) title = (tnode.innerText || '').trim();
      out.push({ id, title, pdf, audio, stream: sl.href });
    }
    return out;
  }, yy);
  results[y] = sermons;
}
JSON.stringify(results);
