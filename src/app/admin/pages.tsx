import { useEffect, useState } from 'react';
import { AdminLogin, AdminShell, adminApiUrl, useAdminSession } from '@/components/admin-shell';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

type Page = { id: string; title: string; slug: string; seoTitle: string; seoDescription: string; published: boolean; sortOrder: number };
type PagePayload = { pages?: Page[]; error?: string };
type Analytics = { pageViews: number; searches: number; videoPlays: number; windowDays: number };

export default function PagesAdmin() {
  const session = useAdminSession();
  const [pages, setPages] = useState<Page[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const selected = pages.find((page) => page.id === selectedId) || null;
  const headers = session.token ? { Authorization: `Bearer ${session.token}` } : undefined;
  const load = async () => {
    if (!session.token) return;
    setLoading(true);
    try {
      const response = await fetch(adminApiUrl('/api/admin/site-pages'), { headers });
      const payload = await response.json() as PagePayload;
      if (!response.ok) throw new Error(payload.error || 'Unable to load pages');
      setPages(payload.pages || []);
      const analyticsResponse = await fetch(adminApiUrl('/api/admin/analytics'), { headers });
      if (analyticsResponse.ok) setAnalytics(await analyticsResponse.json() as Analytics);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to load pages');
    } finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [session.token]);
  const create = async () => {
    const title = typeof window !== 'undefined' ? window.prompt('Page title', 'New page')?.trim() : '';
    if (!title) return;
    const response = await fetch(adminApiUrl('/api/admin/site-pages'), { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ title }) });
    const payload = await response.json() as { page?: Page; error?: string };
    if (!response.ok || !payload.page) return setMessage(payload.error || 'Unable to create page');
    setPages((current) => [...current, payload.page!]);
    setSelectedId(payload.page.id);
    setMessage('Draft page created. Publish it explicitly when ready.');
  };
  const save = async (patch: Partial<Page>) => {
    if (!selected) return;
    const response = await fetch(adminApiUrl(`/api/admin/site-pages/${encodeURIComponent(selected.id)}`), { method: 'PUT', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(patch) });
    const payload = await response.json() as { page?: Page; error?: string };
    if (!response.ok || !payload.page) return setMessage(payload.error || 'Unable to save page');
    setPages((current) => current.map((item) => item.id === selected.id ? payload.page! : item));
    setMessage('Page draft saved.');
  };
  const publish = async () => {
    if (!selected) return;
    const response = await fetch(adminApiUrl(`/api/admin/site-pages/${encodeURIComponent(selected.id)}/publish`), { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ published: !selected.published }) });
    const payload = await response.json() as { page?: Page; error?: string };
    if (!response.ok || !payload.page) return setMessage(payload.error || 'Unable to change publication status');
    setPages((current) => current.map((item) => item.id === selected.id ? payload.page! : item));
    setMessage(payload.page.published ? 'Page published.' : 'Page unpublished.');
  };
  const remove = async () => {
    if (!selected || (typeof window !== 'undefined' && !window.confirm(`Delete "${selected.title}"?`))) return;
    const response = await fetch(adminApiUrl(`/api/admin/site-pages/${encodeURIComponent(selected.id)}`), { method: 'DELETE', headers });
    if (!response.ok) return setMessage('Unable to delete page');
    setPages((current) => current.filter((item) => item.id !== selected.id));
    setSelectedId(null);
    setMessage('Page deleted.');
  };
  if (!session.token) return <AdminLogin onLogin={session.setToken} />;
  return <AdminShell token={session.token} title="Custom Pages"><ScrollView contentContainerStyle={styles.page}>
    <View style={styles.header}><View><Text style={styles.eyebrow}>DESIGN STUDIO / PAGES</Text><Text style={styles.title}>Custom pages</Text><Text style={styles.subtitle}>Create draft pages with safe slugs and publish them explicitly.</Text></View><Pressable onPress={() => void create()} style={styles.primary}><Text style={styles.primaryText}>New page</Text></Pressable></View>
    {message ? <Text style={styles.message}>{message}</Text> : null}
    {analytics ? <View style={styles.analytics}><Text style={styles.analyticsTitle}>Verified analytics · last {analytics.windowDays} days</Text><Text style={styles.analyticsText}>Page views: {analytics.pageViews} · Searches: {analytics.searches} · Video plays: {analytics.videoPlays}</Text></View> : <Text style={styles.muted}>Analytics are only shown when recorded events are available.</Text>}
    {loading ? <Text style={styles.muted}>Loading pages…</Text> : <View style={styles.layout}><View style={styles.list}>{pages.length ? pages.map((page) => <Pressable key={page.id} onPress={() => setSelectedId(page.id)} style={[styles.item, selectedId === page.id && styles.selected]}><Text style={styles.itemTitle}>{page.title}</Text><Text style={styles.itemMeta}>/{page.slug} · {page.published ? 'Published' : 'Draft'}</Text></Pressable>) : <Text style={styles.muted}>No custom pages yet.</Text>}</View>{selected ? <View style={styles.editor}><Text style={styles.editorTitle}>Page settings</Text><Text style={styles.label}>Title</Text><TextInput defaultValue={selected.title} onEndEditing={(event) => void save({ title: event.nativeEvent.text })} style={styles.input} /><Text style={styles.label}>URL slug</Text><TextInput autoCapitalize="none" defaultValue={selected.slug} onEndEditing={(event) => void save({ slug: event.nativeEvent.text })} style={styles.input} /><Text style={styles.label}>SEO title</Text><TextInput defaultValue={selected.seoTitle} onEndEditing={(event) => void save({ seoTitle: event.nativeEvent.text })} style={styles.input} /><Text style={styles.label}>SEO description</Text><TextInput defaultValue={selected.seoDescription} multiline onEndEditing={(event) => void save({ seoDescription: event.nativeEvent.text })} style={[styles.input, styles.textarea]} /><View style={styles.actions}><Pressable onPress={() => void publish()} style={styles.secondary}><Text style={styles.secondaryText}>{selected.published ? 'Unpublish' : 'Publish'}</Text></Pressable><Pressable onPress={() => void remove()} style={styles.danger}><Text style={styles.dangerText}>Delete</Text></Pressable></View><Text style={styles.muted}>Page layout editing uses the same persisted homepage section model and will be expanded through Design Studio.</Text></View> : <Text style={styles.muted}>Select a page to edit its settings.</Text>}</View>}
  </ScrollView></AdminShell>;
}

const styles = StyleSheet.create({
  page: { backgroundColor: '#101a2e', minHeight: '100%', padding: 28 },
  header: { alignItems: 'flex-start', flexDirection: 'row', justifyContent: 'space-between', gap: 18 },
  eyebrow: { color: '#8bbcff', fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  title: { color: '#f2f7ff', fontSize: 28, fontWeight: '800', marginTop: 6 },
  subtitle: { color: '#a9bad2', fontSize: 13, marginTop: 8 },
  primary: { backgroundColor: '#2d6cdf', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 12 },
  primaryText: { color: '#fff', fontWeight: '800' },
  message: { color: '#9de0b0', marginTop: 16 },
  analytics: { backgroundColor: '#162544', borderColor: '#30486b', borderRadius: 10, borderWidth: 1, marginTop: 18, padding: 14 },
  analyticsTitle: { color: '#f2f7ff', fontWeight: '800' },
  analyticsText: { color: '#c5d6ee', marginTop: 6 },
  muted: { color: '#a9bad2', lineHeight: 20, marginTop: 18 },
  layout: { flexDirection: 'row', flexWrap: 'wrap', gap: 18, marginTop: 24 },
  list: { flex: 1, minWidth: 240 },
  item: { borderColor: '#30486b', borderRadius: 9, borderWidth: 1, marginBottom: 8, padding: 14 },
  selected: { backgroundColor: '#203967', borderColor: '#8bbcff' },
  itemTitle: { color: '#f2f7ff', fontWeight: '800' },
  itemMeta: { color: '#a9bad2', fontSize: 12, marginTop: 5 },
  editor: { backgroundColor: '#162544', borderColor: '#30486b', borderRadius: 12, borderWidth: 1, flex: 2, minWidth: 280, padding: 18 },
  editorTitle: { color: '#f2f7ff', fontSize: 18, fontWeight: '800', marginBottom: 8 },
  label: { color: '#c5d6ee', fontSize: 12, fontWeight: '700', marginTop: 12 },
  input: { backgroundColor: '#101a2e', borderColor: '#30486b', borderRadius: 8, borderWidth: 1, color: '#f2f7ff', minHeight: 44, marginTop: 6, paddingHorizontal: 12 },
  textarea: { minHeight: 90, paddingTop: 12 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  secondary: { borderColor: '#49678f', borderRadius: 8, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 10 },
  secondaryText: { color: '#8bbcff', fontWeight: '800' },
  danger: { borderColor: '#9c4d5f', borderRadius: 8, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 10 },
  dangerText: { color: '#ff9f9f', fontWeight: '800' },
});
