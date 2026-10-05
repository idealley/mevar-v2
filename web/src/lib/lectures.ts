// « Mes lectures »: the texts a reader opened on this device, how far they
// read each, and the ones they saved. Kept in this browser's localStorage and
// never sent anywhere.

export interface Lecture {
  title: string;
  category: string;
  /** ISO date of the last opening. */
  opened: string;
  /** How far the reader got, 0 to 100; none until they first leave the text. */
  progress?: number;
  saved?: boolean;
}

/** Every text opened here, by URL path. */
export const lectures = (): Record<string, Lecture> => JSON.parse(localStorage.getItem("lectures") ?? "{}");

/** Records what changed about the text at `url`, and returns what is now known of it. */
export function keep(url: string, patch: Partial<Lecture>): Lecture {
  const all = lectures();
  all[url] = { ...all[url], ...patch };
  localStorage.setItem("lectures", JSON.stringify(all));
  return all[url];
}
