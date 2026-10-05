import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { AdminLogin, AdminShell, adminApiUrl, useAdminSession } from '@/components/admin-shell';

type Category = { id: string; name: string; description: string; enabled: boolean; sortOrder: number; folderIds?: string[] };
type Recording = { id: string; title: string; categoryId: string | null };
type Rabbi = { id: string; name: string };
const empty = { name: '', description: '', enabled: true, sortOrder: '0' };

export default function CategoriesAdmin() {
  const session = useAdminSession();
  const [categories, setCategories] = useState<Category[]>([]);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [rabbis, setRabbis] = useState<Rabbi[]>([]);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const auth = { Authorization: `Bearer ${session.token}` };
  const headers = { ...auth, 'Content-Type': 'application/json' };
  const load = async () => {
    const [categoryResponse, recordingResponse, rabbisResponse] = await Promise.all([
      fetch(adminApiUrl('/api/admin/categories'), { headers: auth }),
      fetch(adminApiUrl('/api/admin/recordings'), { headers: auth }),
      fetch(adminApiUrl('/api/admin/rabbis'), { headers: auth }),
    ]);
    const categoryPayload = await categoryResponse.json() as { categories?: Category[] };
    const recordingPayload = await recordingResponse.json() as { recordings?: Recording[] };
    const rabbisPayload = await rabbisResponse.json() as { rabbis?: Rabbi[] };
    setCategories(categoryPayload.categories || []);
    setRecordings(recordingPayload.recordings || []);
    setRabbis(rabbisPayload.rabbis || []);
  };
  useEffect(() => { if (session.token) void load(); }, [session.token]);
  if (!session.token) return <AdminLogin onLogin={session.setToken} />;

  const save = async () => {
    const response = await fetch(adminApiUrl(editing ? `/api/admin/categories/${editing}` : '/api/admin/categories'), {
      method: editing ? 'PATCH' : 'POST',
      headers,
      body: JSON.stringify({ ...form, sortOrder: Number(form.sortOrder) }),
    });
    const payload = await response.json() as { error?: string };
    setMessage(response.ok ? 'Category saved' : payload.error || 'Unable to save category');
    if (response.ok) { setForm(empty); setEditing(null); void load(); }
  };
  const edit = (category: Category) => {
    setEditing(category.id);
    setForm({ name: category.name, description: category.description, enabled: category.enabled, sortOrder: String(category.sortOrder) });
  };
  const remove = async (id: string) => {
    const response = await fetch(adminApiUrl(`/api/admin/categories/${id}`), { method: 'DELETE', headers });
    setMessage(response.ok ? 'Category deleted' : 'Unable to delete category');
    if (response.ok) void load();
  };
  const assignRecording = async (recordingId: string, categoryId: string | null) => {
    const category = categories.find((item) => item.id === categoryId);
    const response = await fetch(adminApiUrl(`/api/admin/recordings/${recordingId}`), {
      method: 'PATCH', headers, body: JSON.stringify({ categoryId, category: category?.name || null }),
    });
    setMessage(response.ok ? 'Recording category saved' : 'Unable to assign recording');
    if (response.ok) void load();
  };
  const toggleFolder = async (category: Category, folderId: string) => {
    const current = new Set(category.folderIds || []);
    if (current.has(folderId)) current.delete(folderId); else current.add(folderId);
    const response = await fetch(adminApiUrl(`/api/admin/categories/${category.id}`), {
      method: 'PATCH', headers, body: JSON.stringify({ folderIds: [...current] }),
    });
    setMessage(response.ok ? 'Rabbi folder assignment saved' : 'Unable to assign Rabbi folder');
    if (response.ok) void load();
  };

  return <AdminShell token={session.token} title="Category Management">
    <View style={styles.panel}>
      <Text style={styles.panelTitle}>{editing ? 'Edit category' : 'Add category'}</Text>
      <TextInput onChangeText={(name) => setForm((current) => ({ ...current, name }))} placeholder="Category name" placeholderTextColor="#69717B" style={styles.input} value={form.name} />
      <TextInput multiline onChangeText={(description) => setForm((current) => ({ ...current, description }))} placeholder="Description" placeholderTextColor="#69717B" style={[styles.input, styles.textarea]} value={form.description} />
      <TextInput keyboardType="numeric" onChangeText={(sortOrder) => setForm((current) => ({ ...current, sortOrder }))} placeholder="Sort order" placeholderTextColor="#69717B" style={styles.input} value={form.sortOrder} />
      <View style={styles.toggle}><Text style={styles.label}>Active</Text><Switch onValueChange={(enabled) => setForm((current) => ({ ...current, enabled }))} value={form.enabled} trackColor={{ false: '#30486b', true: '#2d6cdf' }} /></View>
      <Pressable onPress={() => void save()} style={styles.primary}><Text style={styles.primaryText}>{editing ? 'Save changes' : 'Add category'}</Text></Pressable>
      {editing && <Pressable onPress={() => { setEditing(null); setForm(empty); }}><Text style={styles.cancel}>Cancel edit</Text></Pressable>}
      {message && <Text style={styles.message}>{message}</Text>}
    </View>
    <View style={styles.panel}>
      <Text style={styles.panelTitle}>Categories ({categories.length})</Text>
      <Text style={styles.muted}>Assign individual shiurim below, or assign a Rabbi folder to apply the category to every recording in that Drive tree unless a recording has its own category override.</Text>
      {categories.map((category) => <View key={category.id} style={styles.row}>
        <View style={styles.copy}><Text style={styles.rowTitle}>{category.name}</Text><Text style={styles.rowMeta}>{category.enabled ? 'Active' : 'Inactive'} · order {category.sortOrder} · {(category.folderIds || []).length} Rabbi folders</Text></View>
        <Pressable onPress={() => edit(category)}><Text style={styles.action}>Edit</Text></Pressable><Pressable onPress={() => void remove(category.id)}><Text style={styles.delete}>Delete</Text></Pressable>
      </View>)}
    </View>
    <View style={styles.panel}>
      <Text style={styles.panelTitle}>Assign Rabbi folders</Text>
      {categories.map((category) => <View key={category.id} style={styles.assignment}>
        <Text style={styles.rowTitle}>{category.name}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.buttons}>
          {rabbis.map((rabbi) => <Pressable key={rabbi.id} onPress={() => void toggleFolder(category, rabbi.id)} style={[styles.button, (category.folderIds || []).includes(rabbi.id) && styles.selected]}><Text style={styles.buttonText}>{rabbi.name}</Text></Pressable>)}
        </ScrollView>
      </View>)}
    </View>
    <View style={styles.panel}>
      <Text style={styles.panelTitle}>Assign individual shiurim</Text>
      {recordings.map((recording) => <View key={recording.id} style={styles.assignment}>
        <Text numberOfLines={1} style={styles.rowTitle}>{recording.title}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.buttons}>
          {categories.map((category) => <Pressable key={category.id} onPress={() => void assignRecording(recording.id, category.id)} style={[styles.button, recording.categoryId === category.id && styles.selected]}><Text style={styles.buttonText}>{category.name}</Text></Pressable>)}
          {recording.categoryId && <Pressable onPress={() => void assignRecording(recording.id, null)}><Text style={styles.clear}>Clear</Text></Pressable>}
        </ScrollView>
      </View>)}
    </View>
  </AdminShell>;
}

const styles = StyleSheet.create({
  panel: { backgroundColor: '#162544', borderColor: '#30486b', borderRadius: 12, borderWidth: 1, marginTop: 18, padding: 16 }, panelTitle: { color: '#F2F7FF', fontSize: 17, fontWeight: '700' }, muted: { color: '#a9bad2', fontSize: 12, lineHeight: 18, marginTop: 7 },
  input: { backgroundColor: '#101a2e', borderColor: '#30486b', borderRadius: 8, borderWidth: 1, color: '#F2F7FF', marginTop: 10, minHeight: 46, paddingHorizontal: 12 }, textarea: { minHeight: 78, paddingTop: 12 },
  toggle: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 }, label: { color: '#c5d6ee', fontSize: 12, fontWeight: '700' }, primary: { alignItems: 'center', backgroundColor: '#2d6cdf', borderRadius: 8, marginTop: 14, padding: 12 }, primaryText: { color: '#ffffff', fontWeight: '800' }, cancel: { color: '#8bbcff', marginTop: 12, textAlign: 'center' }, message: { color: '#92C9A5', marginTop: 12, textAlign: 'center' },
  row: { alignItems: 'center', borderBottomColor: '#30486b', borderBottomWidth: 1, flexDirection: 'row', gap: 12, paddingVertical: 14 }, copy: { flex: 1 }, rowTitle: { color: '#F2F7FF', fontSize: 14, fontWeight: '700' }, rowMeta: { color: '#a9bad2', fontSize: 11, marginTop: 5 }, action: { color: '#8bbcff', fontSize: 12, fontWeight: '700' }, delete: { color: '#ff9f9f', fontSize: 12, fontWeight: '700' },
  assignment: { borderBottomColor: '#30486b', borderBottomWidth: 1, paddingVertical: 14 }, buttons: { gap: 8, marginTop: 10 }, button: { borderColor: '#49678f', borderRadius: 999, borderWidth: 1, paddingHorizontal: 11, paddingVertical: 7 }, selected: { backgroundColor: '#2d6cdf', borderColor: '#2d6cdf' }, buttonText: { color: '#F2F7FF', fontSize: 11, fontWeight: '700' }, clear: { color: '#ff9f9f', fontSize: 11, fontWeight: '700', padding: 8 },
});
