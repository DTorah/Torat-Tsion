export const titleCategories = [
  { name: 'Shabbat', pattern: /\bshabbat\b|\bshabbos\b/i },
  { name: 'Thought', pattern: /\bthought\b|\bidea\b|\btorah thought\b/i },
  { name: 'Parsha', pattern: /\bparsha\b|\bparash(a|at)\b/i },
  { name: 'Emunah & Bitachon', pattern: /\bemunah\b|\bemunah\b|\bbitachon\b|\bfaith\b|\btrust\b/i },
  { name: 'Tefillah', pattern: /\btefillah\b|\btefila\b|\bprayer\b|\bdaven\b/i },
  { name: 'Chagim', pattern: /\bpesach\b|\bpassover\b|\bshavuot\b|\bsukkot\b|\brosh hashana\b|\byom kippur\b|\bpurim\b|\bchanukah\b|\bholiday\b/i },
  { name: 'Chinuch', pattern: /\bchinuch\b|\bparenting\b|\braising children\b/i },
  { name: 'Shalom Bayit', pattern: /\bshalom bayit\b|\bpeace in the home\b|\bmarriage\b/i },
  { name: 'Middot', pattern: /\bmiddot\b|\bcharacter\b|\bpatience\b|\banger\b/i },
  { name: 'Hashkafah', pattern: /\bhashkafah\b|\bworldview\b|\bperspective\b/i },
  { name: 'Inner Peace', pattern: /\binner peace\b/i },
] as const;

export const parshaNames = [
  'Bereshit', 'Noach', 'Lech Lecha', 'Vayeira', 'Chayei Sarah', 'Toldot', 'Vayetze', 'Vayishlach', 'Vayeshev', 'Miketz', 'Vayigash', 'Vayechi',
  'Shemot', 'Vaera', 'Bo', 'Beshalach', 'Yitro', 'Mishpatim', 'Terumah', 'Tetzaveh', 'Ki Tisa', 'Vayakhel', 'Pekudei', 'Vayikra', 'Tzav',
  'Shemini', 'Tazria', 'Metzora', 'Acharei Mot', 'Kedoshim', 'Emor', 'Behar', 'Bechukotai', 'Bamidbar', 'Naso', 'Behaalotecha', 'Shelach',
  'Korach', 'Chukat', 'Balak', 'Pinchas', 'Matot', 'Masei', 'Devarim', 'Vaetchanan', 'Eikev', 'Reeh', 'Shoftim', 'Ki Teitzei', 'Ki Tavo',
  'Nitzavim', 'Vayelech', 'Haazinu', 'Vezot Haberachah',
] as const;

export function inferRecordingCategories(title: string, category?: string | null) {
  const normalizedTitle = title.trim();
  const matches = titleCategories.filter(({ pattern }) => pattern.test(normalizedTitle)).map(({ name }) => name);
  const parshaMatches = parshaNames.filter((name) => new RegExp(`\\b${name.replace(' ', '\\s+')}\\b`, 'i').test(normalizedTitle));
  return [...new Set([...(category?.trim() ? [category.trim()] : []), ...parshaMatches.map((name) => `Parshat ${name}`), ...matches])];
}

export function inferRecordingCategory(title: string, category?: string | null) {
  return inferRecordingCategories(title, category)[0] || 'Torah';
}
