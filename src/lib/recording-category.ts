const titleCategories = [
  { name: 'Shabbat Shalom', pattern: /\bshabbat\s+shalom\b/i },
  { name: 'Thought', pattern: /\bthought\b/i },
  { name: 'Parsha', pattern: /\bparsha\b|\bparash(a|at)\b/i },
] as const;

export function inferRecordingCategory(title: string, category?: string | null) {
  if (category?.trim()) return category.trim();
  return titleCategories.find(({ pattern }) => pattern.test(title))?.name || 'Torah';
}
