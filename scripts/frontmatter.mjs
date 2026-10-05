// A text's frontmatter, as the scripts that write PDF links read and set it
// (95, 96): the block between the opening « --- » lines, one `key: value`
// line per field, the value JSON.

export const frontmatter = (text) => text.match(/^---\n([\s\S]*?)\n---\n/)[1];

export const field = (fm, k) => { const m = fm.match(new RegExp(`^${k}: (.*)$`, "m")); return m ? JSON.parse(m[1]) : undefined; };

// Writes `key: value` in a text's frontmatter, in place or appended
export function setField(text, key, value) {
  const fm = frontmatter(text);
  const lineRe = new RegExp(`^${key}: .*$`, "m");
  const next = lineRe.test(fm) ? fm.replace(lineRe, `${key}: ${JSON.stringify(value)}`) : `${fm}\n${key}: ${JSON.stringify(value)}`;
  return text.replace(fm, () => next);
}

// Removes a field's line from a text's frontmatter, if it has one
export function dropField(text, key) {
  const fm = frontmatter(text);
  return text.replace(fm, () => fm.replace(new RegExp(`^${key}: .*(\\n|$)`, "m"), "").replace(/\n$/, ""));
}
