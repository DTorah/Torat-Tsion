import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AdminLogin, AdminShell, adminApiUrl, useAdminSession } from '@/components/admin-shell';

type Item = {
  id: string;
  title: string;
  description?: string;
  rabbiId?: string | null;
  categoryId?: string | null;
  category?: string | null;
  rabbiName?: string | null;
  durationSeconds?: number | null;
  coverUrl?: string | null;
  visible?: boolean;
  featured?: boolean;
  trending?: boolean;
  new?: boolean;
  sortOrder?: number;
  shiurStartSeconds?: number | null;
  shiurStartSource?: 'automatic' | 'manual' | null;
  shiurStartConfidence?: number | null;
  shiurSkipEnabled?: boolean;
};

type Option = { id: string; name: string };

function formatShiurStart(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return 'Not set';
  const total = Math.max(0, Math.floor(value));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export default function RecordingsAdmin() {
  const router = useRouter();
  const session = useAdminSession();
  const [items, setItems] = useState<Item[]>([]);
  const [rabbis, setRabbis] = useState<Option[]>([]);
  const [categories, setCategories] = useState<Option[]>([]);
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState({ rabbi: '', category: '', visibility: 'all', featured: 'all', new: 'all' });
  const [editing, setEditing] = useState<Item | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = async () => {
    const headers = { Authorization: `Bearer ${session.token}` };
    const [recordingsResponse, rabbisResponse, contentResponse] = await Promise.all([
      fetch(adminApiUrl('/api/admin/recordings'), { headers }),
      fetch(adminApiUrl('/api/admin/rabbis'), { headers }),
      fetch(adminApiUrl('/api/admin/content'), { headers }),
    ]);
    const recordings = await recordingsResponse.json() as { recordings?: Item[] };
    const rabbiPayload = await rabbisResponse.json() as { rabbis?: Option[] };
    const content = await contentResponse.json() as { content?: { rabbis?: Option[]; categories?: Option[] } };
    setItems(recordings.recordings || []);
    setRabbis(rabbiPayload.rabbis || []);
    setCategories(content.content?.categories || []);
  };

  useEffect(() => { if (session.token) void load(); }, [session.token]);

  const filtered = useMemo(() => items.filter((item) => {
    const text = query.trim().toLowerCase();
    return (!text || item.title.toLowerCase().includes(text))
      && (!filters.rabbi || item.rabbiId === filters.rabbi)
      && (!filters.category || item.categoryId === filters.category)
      && (filters.visibility === 'all' || (filters.visibility === 'visible') === (item.visible !== false))
      && (filters.featured === 'all' || (filters.featured === 'yes') === Boolean(item.featured))
      && (filters.new === 'all' || (filters.new === 'yes') === Boolean(item.new));
  }), [items, query, filters]);

  if (!session.token) return <AdminLogin onLogin={session.setToken} />;

  const save = async () => {
    if (!editing) return;
    await saveEditing(editing);
  };

  const saveEditing = async (item: Item) => {
    const body = {
      ...item,
      shiurStartSeconds: item.shiurStartSeconds === null || item.shiurStartSeconds === undefined ? null : Number(item.shiurStartSeconds),
      shiurStartConfidence: item.shiurStartConfidence === null || item.shiurStartConfidence === undefined ? null : Number(item.shiurStartConfidence),
    };
    const response = await fetch(adminApiUrl(`/api/admin/recordings/${item.id}`), {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${session.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const payload = await response.json() as { error?: string };
    setMessage(response.ok ? 'Recording saved' : payload.error || 'Unable to save recording');
    if (response.ok) { setEditing(null); void load(); }
  };

  const update = (key: keyof Item, value: string | boolean | number | null) => setEditing((current) => current ? { ...current, [key]: value } : current);

  const reAnalyze = async (id: string) => {
    const response = await fetch(adminApiUrl(`/api/admin/recordings/${id}/analyze-shiur-start`), {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.token}`, 'Content-Type': 'application/json' },
    });
    const payload = await response.json() as { error?: string; detected?: { startSeconds?: number }; recording?: Item };
    if (!response.ok) {
      setMessage(payload.error || 'Unable to analyze shiur start');
      return;
    }
    if (payload.recording) setEditing(payload.recording);
    setMessage(payload.detected?.startSeconds ? `Shiur start detected at ${formatShiurStart(payload.detected.startSeconds)}` : 'Speech-start analysis finished.');
    void load();
  };

  return (
    <AdminShell token={session.token} title="Recording Management">
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Google Drive recordings</Text>
        <Text style={styles.muted}>Audio files remain in Drive. This screen edits metadata only.</Text>
        <TextInput onChangeText={setQuery} placeholder="Search by title" placeholderTextColor="#69717B" style={styles.input} value={query} />
        <View style={styles.filters}>
          <Filter label="Rabbi" value={filters.rabbi} options={rabbis} onChange={(rabbi) => setFilters((current) => ({ ...current, rabbi }))} />
          <Filter label="Category" value={filters.category} options={categories} onChange={(category) => setFilters((current) => ({ ...current, category }))} />
          <Filter label="Visibility" value={filters.visibility} options={[{ id: 'all', name: 'All' }, { id: 'visible', name: 'Visible' }, { id: 'hidden', name: 'Hidden' }]} onChange={(visibility) => setFilters((current) => ({ ...current, visibility }))} />
          <Filter label="Featured" value={filters.featured} options={[{ id: 'all', name: 'All' }, { id: 'yes', name: 'Yes' }, { id: 'no', name: 'No' }]} onChange={(featured) => setFilters((current) => ({ ...current, featured }))} />
          <Filter label="New" value={filters.new} options={[{ id: 'all', name: 'All' }, { id: 'yes', name: 'Yes' }, { id: 'no', name: 'No' }]} onChange={(value) => setFilters((current) => ({ ...current, new: value }))} />
        </View>
      </View>

      {filtered.map((item) => (
        <View key={item.id} style={styles.row}>
          <View style={styles.copy}>
            <Text style={styles.rowTitle} numberOfLines={1}>{item.title}</Text>
            <Text style={styles.meta}>{item.rabbiName || 'Unassigned Rabbi'} · {item.durationSeconds ? `${Math.round(item.durationSeconds / 60)} min` : 'Duration unavailable'} · {item.coverUrl ? 'Cover set' : 'Fallback cover'}</Text>
            <Text style={styles.meta}>{item.visible === false ? 'Hidden' : 'Visible'} · {item.featured ? 'Featured' : 'Standard'} · {item.trending ? 'Trending' : 'Not trending'}</Text>
          </View>
          <Pressable onPress={() => setEditing({ ...item })}><Text style={styles.action}>Edit</Text></Pressable>
        </View>
      ))}

      <Text style={styles.meta}>{filtered.length} matching recordings</Text>

      {editing && (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Edit metadata</Text>
          <Editor label="Title" value={editing.title} onChange={(value) => update('title', value)} />
          <Editor label="Description" value={editing.description || ''} onChange={(value) => update('description', value)} multiline />
          <Filter label="Rabbi" value={editing.rabbiId || ''} options={[{ id: '', name: 'Unassigned' }, ...rabbis]} onChange={(value) => update('rabbiId', value || null)} />
          <Filter label="Category" value={editing.categoryId || ''} options={[{ id: '', name: 'Unassigned' }, ...categories]} onChange={(value) => update('categoryId', value || null)} />
          <Editor label="Sort order" value={String(editing.sortOrder || 0)} onChange={(value) => update('sortOrder', Number(value) || 0)} />

          <View style={styles.skipSection}>
            <Text style={styles.panelTitle}>Shiur Start</Text>
            <Text style={styles.meta}>{editing.shiurStartSeconds ? `Detected start: ${formatShiurStart(editing.shiurStartSeconds)}` : 'Detected start: Not set'}</Text>
            <Text style={styles.meta}>{editing.shiurStartConfidence ? `Confidence: ${Math.round((editing.shiurStartConfidence || 0) * 100)}%` : 'Confidence: Not available'}</Text>
            <TextInput
              keyboardType="numeric"
              onChangeText={(value) => update('shiurStartSeconds', value === '' ? null : Number(value))}
              placeholder="Shiur start in seconds"
              placeholderTextColor="#69717B"
              style={styles.input}
              value={editing.shiurStartSeconds === null || editing.shiurStartSeconds === undefined ? '' : String(editing.shiurStartSeconds)}
            />
            <View style={styles.buttonRow}>
              <Pressable onPress={() => { const next = { ...editing, shiurStartSource: 'manual' as const, shiurSkipEnabled: true }; setEditing(next); void saveEditing(next); }} style={styles.primary}><Text style={styles.primaryText}>Accept</Text></Pressable>
              <Pressable onPress={() => { update('shiurStartSource', 'manual'); update('shiurSkipEnabled', true); }} style={styles.secondary}><Text style={styles.secondaryText}>Edit Timestamp</Text></Pressable>
              <Pressable onPress={() => { const next = { ...editing, shiurSkipEnabled: false }; setEditing(next); void saveEditing(next); }} style={styles.secondary}><Text style={styles.secondaryText}>Disable Skip</Text></Pressable>
              <Pressable onPress={() => void reAnalyze(editing.id)} style={styles.secondary}><Text style={styles.secondaryText}>{editing.shiurStartSeconds ? 'Re-analyze' : 'Analyze'}</Text></Pressable>
            </View>
          </View>

          <Toggle label="Visible" value={editing.visible !== false} onChange={(value) => update('visible', value)} />
          <Toggle label="Featured" value={Boolean(editing.featured)} onChange={(value) => update('featured', value)} />
          <Toggle label="Trending" value={Boolean(editing.trending)} onChange={(value) => update('trending', value)} />
          <Toggle label="New" value={Boolean(editing.new)} onChange={(value) => update('new', value)} />

          <Pressable onPress={() => void save()} style={styles.primary}><Text style={styles.primaryText}>Save metadata</Text></Pressable>
          <Pressable onPress={() => router.push('/admin/covers')} style={styles.coverLink}><Text style={styles.action}>Open Cover Manager</Text></Pressable>
          <Pressable onPress={() => setEditing(null)}><Text style={styles.cancel}>Cancel</Text></Pressable>
        </View>
      )}

      {message && <Text style={styles.message}>{message}</Text>}
    </AdminShell>
  );
}

function Editor({ label, value, onChange, multiline = false }: { label: string; value: string; onChange: (value: string) => void; multiline?: boolean }) {
  return (
    <>
      <Text style={styles.label}>{label}</Text>
      <TextInput multiline={multiline} onChangeText={onChange} style={[styles.input, multiline && styles.textarea]} value={value} />
    </>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  return (
    <View style={styles.toggle}>
      <Text style={styles.label}>{label}</Text>
      <Switch onValueChange={onChange} value={value} trackColor={{ false: '#303740', true: '#2d6cdf' }} />
    </View>
  );
}

function Filter({ label, value, options, onChange }: { label: string; value: string; options: Option[]; onChange: (value: string) => void }) {
  return (
    <View style={styles.filter}>
      <Text style={styles.label}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.options}>
        {options.map((option) => (
          <Pressable key={option.id} onPress={() => onChange(option.id)} style={[styles.option, value === option.id && styles.selected]}>
            <Text style={styles.optionText}>{option.name}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { backgroundColor: '#1B2026', borderColor: '#2A3139', borderRadius: 12, borderWidth: 1, marginTop: 18, padding: 16 },
  panelTitle: { color: '#F2EEE7', fontSize: 17, fontWeight: '700' },
  muted: { color: '#89909A', fontSize: 12, lineHeight: 18, marginTop: 7 },
  input: { backgroundColor: '#101317', borderColor: '#303740', borderRadius: 8, borderWidth: 1, color: '#F2EEE7', fontSize: 14, marginTop: 8, padding: 10 },
  textarea: { minHeight: 84, textAlignVertical: 'top' },
  label: { color: '#C7CED6', fontSize: 12, fontWeight: '700', marginTop: 14 },
  toggle: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 },
  filter: { marginTop: 14 },
  filters: { gap: 8 },
  options: { gap: 8, paddingRight: 6 },
  option: { backgroundColor: '#101317', borderColor: '#303740', borderRadius: 999, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8 },
  selected: { backgroundColor: '#2d6cdf', borderColor: '#2d6cdf' },
  optionText: { color: '#F2EEE7', fontSize: 12, fontWeight: '700' },
  row: { alignItems: 'center', backgroundColor: '#141A1F', borderColor: '#2A3139', borderRadius: 10, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, padding: 12 },
  copy: { flex: 1 },
  rowTitle: { color: '#F2EEE7', fontSize: 14, fontWeight: '700' },
  meta: { color: '#8F98A3', fontSize: 12, marginTop: 5 },
  action: { color: '#2d6cdf', fontWeight: '700' },
  primary: { backgroundColor: '#2d6cdf', borderRadius: 8, marginTop: 18, paddingHorizontal: 12, paddingVertical: 10 },
  primaryText: { color: '#ffffff', fontWeight: '800' },
  secondary: { backgroundColor: '#ffffff', borderColor: '#dfeaf7', borderRadius: 8, borderWidth: 1, marginTop: 10, paddingHorizontal: 12, paddingVertical: 10 },
  secondaryText: { color: '#142950', fontWeight: '700' },
  skipSection: { backgroundColor: '#101317', borderColor: '#303740', borderRadius: 10, borderWidth: 1, marginTop: 18, padding: 14 },
  buttonRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  coverLink: { marginTop: 10 },
  cancel: { color: '#F3B5A5', marginTop: 10, textAlign: 'center' },
  message: { color: '#A8E1C5', fontSize: 12, marginTop: 12 },
});
