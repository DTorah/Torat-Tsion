import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { AdminLogin, AdminShell, adminApiUrl, useAdminSession } from '@/components/admin-shell';

type CarouselItem = { id: string; title: string; subtitle?: string; kind?: string; recordingId?: string | null; coverUrl?: string | null; link?: string | null; countdownAt?: string | null; enabled?: boolean; sortOrder?: number };

export default function CarouselAdmin() {
  const session = useAdminSession();
  const [items, setItems] = useState<CarouselItem[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [draft, setDraft] = useState({ title: '', subtitle: '', recordingId: '', coverUrl: '', link: '', countdownAt: '' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const headers = { Authorization: `Bearer ${session.token}`, 'Content-Type': 'application/json' };

  const load = async () => {
    const response = await fetch(adminApiUrl('/api/admin/carousel'), { headers: { Authorization: `Bearer ${session.token}` } });
    const payload = await response.json() as { carousel?: CarouselItem[] };
    setItems(payload.carousel || []);
  };
  useEffect(() => { if (session.token) void load(); }, [session.token]);
  const sorted = useMemo(() => [...items].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)), [items]);
  if (!session.token) return <AdminLogin onLogin={session.setToken} />;

  const save = async () => {
    if (!draft.title.trim()) { setMessage('A title is required'); return; }
    const payload = { title: draft.title.trim(), subtitle: draft.subtitle.trim(), recordingId: draft.recordingId.trim() || null, coverUrl: draft.coverUrl.trim() || null, link: draft.link.trim() || null, countdownAt: draft.countdownAt.trim() || null, kind: draft.countdownAt.trim() ? 'upcoming' : (draft.recordingId.trim() ? 'recording' : 'custom') };
    const response = await fetch(adminApiUrl(editingId ? `/api/admin/carousel/${editingId}` : '/api/admin/carousel'), {
      method: editingId ? 'PATCH' : 'POST', headers,
      body: JSON.stringify(payload),
    });
    setMessage(response.ok ? `Carousel item ${editingId ? 'updated' : 'added'}` : 'Unable to save carousel item');
    if (response.ok) { setDraft({ title: '', subtitle: '', recordingId: '', coverUrl: '', link: '', countdownAt: '' }); setEditingId(null); void load(); }
  };
  const update = async (item: CarouselItem, patch: Partial<CarouselItem>) => {
    const response = await fetch(adminApiUrl(`/api/admin/carousel/${item.id}`), { method: 'PATCH', headers, body: JSON.stringify(patch) });
    setMessage(response.ok ? 'Carousel item saved' : 'Unable to save carousel item');
    if (response.ok) void load();
  };
  const remove = async (item: CarouselItem) => {
    const response = await fetch(adminApiUrl(`/api/admin/carousel/${item.id}`), { method: 'DELETE', headers: { Authorization: `Bearer ${session.token}` } });
    setMessage(response.ok ? 'Carousel item removed' : 'Unable to remove carousel item');
    if (response.ok) void load();
  };
  const move = async (index: number, direction: -1 | 1) => {
    const item = sorted[index]; const other = sorted[index + direction];
    if (!item || !other) return;
    await Promise.all([
      update(item, { sortOrder: other.sortOrder ?? index + direction }),
      update(other, { sortOrder: item.sortOrder ?? index }),
    ]);
  };

  return <AdminShell token={session.token} title="Content Carousel">
    <View style={styles.panel}>
      <Text style={styles.panelTitle}>{editingId ? 'Edit carousel item' : 'Add carousel item'}</Text>
      <Text style={styles.muted}>Curated items appear on the home page carousel in the order below. If no items are added, recently added recordings are shown automatically — this is not a fake live event, just a fallback.</Text>
      <TextInput placeholder="Title" placeholderTextColor="#59636E" style={styles.input} value={draft.title} onChangeText={(title) => setDraft({ ...draft, title })} />
      <TextInput placeholder="Subtitle (e.g. Rabbi name)" placeholderTextColor="#59636E" style={styles.input} value={draft.subtitle} onChangeText={(subtitle) => setDraft({ ...draft, subtitle })} />
      <TextInput placeholder="Recording ID (optional)" placeholderTextColor="#59636E" style={styles.input} value={draft.recordingId} onChangeText={(recordingId) => setDraft({ ...draft, recordingId })} />
      <TextInput autoCapitalize="none" placeholder="Image URL (optional; overrides recording artwork)" placeholderTextColor="#59636E" style={styles.input} value={draft.coverUrl} onChangeText={(coverUrl) => setDraft({ ...draft, coverUrl })} />
      <TextInput placeholder="Link (optional, e.g. /recordings/xyz)" placeholderTextColor="#59636E" style={styles.input} value={draft.link} onChangeText={(link) => setDraft({ ...draft, link })} />
      <TextInput placeholder="Countdown date/time ISO (optional, upcoming events)" placeholderTextColor="#59636E" style={styles.input} value={draft.countdownAt} onChangeText={(countdownAt) => setDraft({ ...draft, countdownAt })} />
      <Pressable onPress={() => void save()} style={styles.button}><Text style={styles.buttonText}>{editingId ? 'Save item' : 'Add item'}</Text></Pressable>
      {editingId && <Pressable onPress={() => { setEditingId(null); setDraft({ title: '', subtitle: '', recordingId: '', coverUrl: '', link: '', countdownAt: '' }); }}><Text style={styles.action}>Cancel edit</Text></Pressable>}
    </View>
    <View style={styles.panel}>
      <Text style={styles.panelTitle}>Current carousel ({sorted.length})</Text>
      {sorted.length ? sorted.map((item, index) => <View key={item.id} style={styles.row}>
        <View style={styles.copy}>
          <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.meta}>{item.kind || 'custom'}{item.subtitle ? ` · ${item.subtitle}` : ''}{item.coverUrl ? ' · custom image' : ' · recording/fallback image'}{item.enabled === false ? ' · hidden' : ''}</Text>
        </View>
        <Pressable disabled={!index} onPress={() => void move(index, -1)}><Text style={[styles.action, !index && styles.disabled]}>Up</Text></Pressable>
        <Pressable disabled={index === sorted.length - 1} onPress={() => void move(index, 1)}><Text style={[styles.action, index === sorted.length - 1 && styles.disabled]}>Down</Text></Pressable>
        <Pressable onPress={() => { setEditingId(item.id); setDraft({ title: item.title, subtitle: item.subtitle || '', recordingId: item.recordingId || '', coverUrl: item.coverUrl || '', link: item.link || '', countdownAt: item.countdownAt || '' }); }}><Text style={styles.action}>Edit</Text></Pressable>
        <Pressable onPress={() => void update(item, { enabled: item.enabled === false })}><Text style={styles.action}>{item.enabled === false ? 'Show' : 'Hide'}</Text></Pressable>
        <Pressable onPress={() => void remove(item)}><Text style={styles.remove}>Remove</Text></Pressable>
      </View>) : <Text style={styles.empty}>No carousel items yet — the home page will show recently added recordings.</Text>}
    </View>
    {message ? <Text style={styles.message}>{message}</Text> : null}
  </AdminShell>;
}

const styles = StyleSheet.create({
  panel: { backgroundColor: '#1B2026', borderColor: '#2A3139', borderRadius: 12, borderWidth: 1, marginTop: 18, padding: 16 },
  panelTitle: { color: '#F2EEE7', fontSize: 17, fontWeight: '700' }, muted: { color: '#89909A', fontSize: 12, lineHeight: 18, marginTop: 7 },
  input: { backgroundColor: '#12161A', borderColor: '#303740', borderRadius: 8, borderWidth: 1, color: '#F2EEE7', fontSize: 13, marginTop: 10, paddingHorizontal: 12, paddingVertical: 9 },
  button: { alignSelf: 'flex-start', backgroundColor: '#2d6cdf', borderRadius: 6, marginTop: 12, paddingHorizontal: 14, paddingVertical: 9 }, buttonText: { color: '#ffffff', fontSize: 12, fontWeight: '800' },
  row: { alignItems: 'center', borderBottomColor: '#303740', borderBottomWidth: 1, flexDirection: 'row', gap: 9, paddingVertical: 14 }, copy: { flex: 1 }, title: { color: '#F2EEE7', fontSize: 14, fontWeight: '700' }, meta: { color: '#89909A', fontSize: 11, marginTop: 4 },
  action: { color: '#8bbcff', fontSize: 11, fontWeight: '700' }, disabled: { color: '#59636E' }, remove: { color: '#E69586', fontSize: 11, fontWeight: '700' }, empty: { color: '#89909A', marginTop: 14 }, message: { color: '#92C9A5', marginTop: 14, textAlign: 'center' },
});
