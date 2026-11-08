/** Defaults are added only when opening an older homepage for the first time.
 * The marker distinguishes an intentionally empty layout from an unmigrated one.
 */
export const defaultHomepageShelves = [
  ['featured', 'Featured carousel'],
  ['new', 'New Shiurim'],
  ['live', 'Live & Upcoming Broadcasts'],
  ['recent', 'Continue Listening'],
  ['parsha', 'Shiurim by Parsha'],
  ['topic-halacha', 'Halacha'],
  ['topic-hashkafa', 'Hashkafa'],
  ['topic-mussar', 'Mussar'],
  ['topic-emunah', 'Emunah'],
  ['topic-tefillah', 'Tefillah'],
  ['topic-shabbat', 'Shabbat'],
  ['topic-holidays', 'Holidays'],
  ['series', 'Series'],
  ['favorites', 'Favorites'],
  ['all', 'All Shiurim'],
] as const;

export function makeHomepageShelf(source: string, title: string) {
  return { id: `builtin-${source}`, type: 'builtin-shelf' as const, source, title,
    enabled: true, layout: 'shelf' as const, columns: 4, visibleCount: 100,
    videoIds: [] as string[], responsive: { desktop: true, tablet: true, mobile: true },
  };
}

type LayoutSection = { id: string; type: string; source?: string };
export function withHomepageShelves<T extends { sections?: LayoutSection[]; shelvesManaged?: boolean }>(document: T): T {
  if (document.shelvesManaged) return document;
  const existing = document.sections || [];
  const defaults = defaultHomepageShelves
    .filter(([source]) => !existing.some((section) => section.type === 'builtin-shelf' && section.source === source))
    .map(([source, title]) => makeHomepageShelf(source, title));
  return { ...document, shelvesManaged: true, sections: [
    ...defaults.filter((section) => section.source === 'featured'),
    ...existing,
    ...defaults.filter((section) => section.source !== 'featured'),
  ] };
}
