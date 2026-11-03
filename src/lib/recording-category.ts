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

const categoryAliases: Record<string, string[]> = {
  vayeira: ['vayera', 'va yera', 'vaiera', 'va era'],
  vaera: ['vaera', 'va era', 'va-e ra', 'vae ra'],
  bereshit: ['bereishit', 'bereshis', 'genesis'],
  noach: ['noah', 'noach'],
  lechlecha: ['lech lecha', 'lech-lecha', 'lech lecha'],
  shabbat: ['shabbat', 'shabbos', 'שבת'],
  parsha: ['parsha', 'parashah', 'parashat', 'פרשה', 'פרשת'],
  thought: ['thought', 'idea', 'machshava', 'מחשבה'],
  emunahbitachon: ['emunah', 'bitachon', 'faith', 'אמונה', 'בטחון', 'ביטחון'],
  tefillah: ['tefillah', 'tefila', 'daven', 'prayer', 'תפילה'],
};

function categoryKey(value: string) {
  return value.toLocaleLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\u0590-\u05ff]/g, '');
}

function categoryTerms(categoryName: string) {
  const key = categoryKey(categoryName);
  const parshaName = key.startsWith('parshat') ? categoryName.replace(/^parshat\s*/i, '') : '';
  const parshaKey = categoryKey(parshaName);
  const isParshaCategory = key === 'parsha' || key === 'parshat' || key === 'parash' || key === 'parashat';
  const allParshaTerms = parshaNames.flatMap((name) => [name, ...(categoryAliases[categoryKey(name)] || [])]);
  return [categoryName, ...(categoryAliases[key] || []), parshaName, ...(categoryAliases[parshaKey] || []), ...(isParshaCategory ? allParshaTerms : [])];
}

export function matchesAdminCategory(
  recording: { title?: string | null; name?: string | null; category?: string | null; categoryId?: string | null },
  category: { id: string; name: string },
) {
  if (recording.categoryId === category.id || recording.category?.trim().toLocaleLowerCase() === category.name.trim().toLocaleLowerCase()) return true;
  const haystack = `${recording.title || ''} ${recording.name || ''} ${recording.category || ''}`.toLocaleLowerCase();
  return categoryTerms(category.name).some((term) => {
    const normalizedTerm = term.toLocaleLowerCase().trim();
    if (!normalizedTerm) return false;
    if (/^[\u0590-\u05ff]+$/.test(normalizedTerm)) return haystack.includes(normalizedTerm);
    const key = categoryKey(normalizedTerm);
    if (!key) return false;
    return categoryKey(haystack).includes(key);
  });
}

export function inferRecordingCategories(title: string, category?: string | null) {
  const normalizedTitle = title.trim();
  const matches = titleCategories.filter(({ pattern }) => pattern.test(normalizedTitle)).map(({ name }) => name);
  const parshaMatches = parshaNames.filter((name) => new RegExp(`\\b${name.replace(' ', '\\s+')}\\b`, 'i').test(normalizedTitle));
  return [...new Set([...(category?.trim() ? [category.trim()] : []), ...parshaMatches.map((name) => `Parshat ${name}`), ...matches])];
}

export function inferRecordingCategory(title: string, category?: string | null) {
  return inferRecordingCategories(title, category)[0] || 'Torah';
}
