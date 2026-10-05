import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AdminLogin, AdminShell, adminApiUrl, useAdminSession } from '@/components/admin-shell';

type Recording = { id: string; title: string; featured?: boolean; sortOrder?: number };

export default function FeaturedAdmin() {
  const session = useAdminSession();
  const [items, setItems] = useState<Recording[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const headers = { Authorization: `Bearer ${session.token}`, 'Content-Type': 'application/json' };
  const load = async () => {
    const response = await fetch(adminApiUrl('/api/admin/recordings'), { headers: { Authorization: `Bearer ${session.token}` } });
    const payload = await response.json() as { recordings?: Recording[] };
    setItems(payload.recordings || []);
  };
  useEffect(() => { if (session.token) void load(); }, [session.token]);
  const featured = useMemo(() => items.filter((item) => item.featured).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0) || a.title.localeCompare(b.title)), [items]);
  const available = useMemo(() => items.filter((item) => !item.featured).sort((a, b) => a.title.localeCompare(b.title)), [items]);
  if (!session.token) return <AdminLogin onLogin={session.setToken} />;

  const update = async (item: Recording, patch: Partial<Recording>) => {
    const response = await fetch(adminApiUrl(`/api/admin/recordings/${item.id}`), { method: 'PATCH', headers, body: JSON.stringify(patch) });
    setMessage(response.ok ? 'Featured selection saved' : 'Unable to save featured selection');
    if (response.ok) void load();
  };
  const move = async (index: number, direction: -1 | 1) => {
    const item = featured[index]; const other = featured[index + direction];
    if (!item || !other) return;
    await Promise.all([
      update(item, { sortOrder: other.sortOrder ?? index + direction }),
      update(other, { sortOrder: item.sortOrder ?? index }),
    ]);
  };

  const row = (item: Recording, index?: number) => <View key={item.id} style={styles.row}><View style={styles.copy}><Text style={styles.title} numberOfLines={1}>{item.title}</Text><Text style={styles.meta}>{item.featured ? `Selected · order ${(index ?? 0) + 1}` : 'Available'}</Text></View>{item.featured ? <><Pressable disabled={!index} onPress={() => void move(index!, -1)}><Text style={[styles.action, !index && styles.disabled]}>Up</Text></Pressable><Pressable disabled={index === featured.length - 1} onPress={() => void move(index!, 1)}><Text style={[styles.action, index === featured.length - 1 && styles.disabled]}>Down</Text></Pressable><Pressable onPress={() => void update(item, { featured: false })}><Text style={styles.remove}>Remove</Text></Pressable></> : <Pressable onPress={() => void update(item, { featured: true, sortOrder: featured.length })} style={styles.button}><Text style={styles.buttonText}>Select</Text></Pressable>}</View>;
  return <AdminShell token={session.token} title="Featured Content"><View style={styles.panel}><Text style={styles.panelTitle}>Featured recordings</Text><Text style={styles.muted}>Only selected recordings appear in Featured on the public home page. Reorder applies only to the selected list.</Text>{featured.length ? featured.map((item, index) => row(item, index)) : <Text style={styles.empty}>No recordings are featured yet.</Text>}</View><View style={styles.panel}><Text style={styles.panelTitle}>Available recordings</Text>{available.map((item) => row(item))}</View>{message ? <Text style={styles.message}>{message}</Text> : null}</AdminShell>;
}

const styles = StyleSheet.create({
  panel: { backgroundColor: '#1B2026', borderColor: '#2A3139', borderRadius: 12, borderWidth: 1, marginTop: 18, padding: 16 }, panelTitle: { color: '#F2EEE7', fontSize: 17, fontWeight: '700' }, muted: { color: '#89909A', fontSize: 12, lineHeight: 18, marginTop: 7 },
  row: { alignItems: 'center', borderBottomColor: '#303740', borderBottomWidth: 1, flexDirection: 'row', gap: 9, paddingVertical: 14 }, copy: { flex: 1 }, title: { color: '#F2EEE7', fontSize: 14, fontWeight: '700' }, meta: { color: '#89909A', fontSize: 11, marginTop: 4 },
  button: { backgroundColor: '#2d6cdf', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 7 }, buttonText: { color: '#ffffff', fontSize: 11, fontWeight: '800' }, action: { color: '#8bbcff', fontSize: 11, fontWeight: '700' }, disabled: { color: '#59636E' }, remove: { color: '#E69586', fontSize: 11, fontWeight: '700' }, empty: { color: '#89909A', marginTop: 14 }, message: { color: '#92C9A5', marginTop: 14, textAlign: 'center' },
});
