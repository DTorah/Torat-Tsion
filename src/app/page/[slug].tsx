import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { apiUrl } from '@/lib/api';

type Page = { title: string; seoTitle?: string; seoDescription?: string; draft?: { design?: { background?: string; text?: string }; sections?: Array<{ title?: string; subtitle?: string; enabled?: boolean; background?: string; textColor?: string }> } };

export default function CustomPage() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [page, setPage] = useState<Page | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    void fetch(apiUrl('/api/analytics/event'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'page_view', path: `/page/${String(slug || '')}` }) }).catch(() => {});
    fetch(apiUrl(`/api/pages/${encodeURIComponent(String(slug || ''))}`)).then(async (response) => {
      const payload = await response.json() as { page?: Page; error?: string };
      if (!response.ok || !payload.page) throw new Error(payload.error || 'Page not found');
      setPage(payload.page);
    }).catch((reason) => setError(reason instanceof Error ? reason.message : 'Page not found'));
  }, [slug]);
  if (error) return <View style={styles.center}><Text style={styles.error}>{error}</Text></View>;
  if (!page) return <View style={styles.center}><ActivityIndicator color="#0052CC" /></View>;
  const design = page.draft?.design || {};
  return <ScrollView contentContainerStyle={[styles.page, { backgroundColor: design.background || '#F8F9FA' }]}><Text style={[styles.title, { color: design.text || '#111827' }]}>{page.title}</Text>{page.draft?.sections?.filter((section) => section.enabled !== false).map((section, index) => <View key={`${section.title}-${index}`} style={[styles.section, { backgroundColor: section.background || '#fff' }]}><Text style={[styles.sectionTitle, { color: section.textColor || design.text || '#111827' }]}>{section.title || 'Torah Farsi'}</Text>{section.subtitle ? <Text style={styles.subtitle}>{section.subtitle}</Text> : null}</View>)}</ScrollView>;
}

const styles = StyleSheet.create({
  page: { minHeight: '100%', padding: 32 },
  title: { fontSize: 36, fontWeight: '800', marginBottom: 24 },
  section: { borderRadius: 12, marginBottom: 16, padding: 22 },
  sectionTitle: { fontSize: 22, fontWeight: '800' },
  subtitle: { color: '#667085', fontSize: 15, marginTop: 8 },
  center: { alignItems: 'center', flex: 1, justifyContent: 'center', padding: 40 },
  error: { color: '#b42318', fontSize: 16 },
});
