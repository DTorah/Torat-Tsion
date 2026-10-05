import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { AdminLogin, AdminShell, adminApiUrl, useAdminSession } from '@/components/admin-shell';

type Rabbi = { id: string; name: string; description: string; biography?: string; photoUrl: string | null; featured: boolean; enabled: boolean; sortOrder: number };
type Recording = { id: string; title: string; rabbiId?: string | null; rabbiName?: string | null; sortOrder?: number; durationSeconds?: number | null };
const empty = { name: '', description: '', biography: '', featured: false, enabled: true, sortOrder: '0' };

export default function RabbisAdmin() {
  const session = useAdminSession();
  const [rabbis, setRabbis] = useState<Rabbi[]>([]);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState<string | null>(null);
  const [photo, setPhoto] = useState<{ uri: string; type: string } | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const headers = { Authorization: `Bearer ${session.token}`, 'Content-Type': 'application/json' };
  const load = async () => {
    const [rabbiResponse, recordingResponse] = await Promise.all([
      fetch(adminApiUrl('/api/admin/rabbis'), { headers: { Authorization: `Bearer ${session.token}` } }),
      fetch(adminApiUrl('/api/admin/recordings'), { headers: { Authorization: `Bearer ${session.token}` } }),
    ]);
    const rabbiPayload = await rabbiResponse.json() as { rabbis?: Rabbi[] };
    const recordingPayload = await recordingResponse.json() as { recordings?: Recording[] };
    setRabbis(rabbiPayload.rabbis || []);
    setRecordings(recordingPayload.recordings || []);
  };
  useEffect(() => { if (session.token) void load(); }, [session.token]);
  if (!session.token) return <AdminLogin onLogin={session.setToken} />;

  const editingRabbi = rabbis.find((rabbi) => rabbi.id === editing);
  const assigned = useMemo(() => recordings.filter((recording) => recording.rabbiId === editing).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0) || a.title.localeCompare(b.title)), [editing, recordings]);
  const available = useMemo(() => recordings.filter((recording) => recording.rabbiId !== editing), [editing, recordings]);
  const set = (key: keyof typeof empty, value: string | boolean) => setForm((current) => ({ ...current, [key]: value }));
  const edit = (rabbi: Rabbi) => { setEditing(rabbi.id); setForm({ name: rabbi.name, description: rabbi.description, biography: rabbi.biography || '', featured: rabbi.featured, enabled: rabbi.enabled, sortOrder: String(rabbi.sortOrder) }); setPhoto(null); setMessage(null); };
  const save = async () => {
    const body = { ...form, sortOrder: Number(form.sortOrder) };
    const response = await fetch(adminApiUrl(editing ? `/api/admin/rabbis/${editing}` : '/api/admin/rabbis'), { method: editing ? 'PATCH' : 'POST', headers, body: JSON.stringify(body) });
    const payload = await response.json() as { rabbi?: Rabbi; error?: string };
    if (!response.ok || !payload.rabbi) return setMessage(payload.error || 'Unable to save Rabbi');
    if (photo) {
      const data = new FormData();
      data.append('image', { uri: photo.uri, name: 'rabbi-cover.jpg', type: photo.type } as unknown as Blob);
      const photoResponse = await fetch(adminApiUrl(`/api/admin/rabbis/${payload.rabbi.id}/photo`), { method: 'POST', headers: { Authorization: `Bearer ${session.token}` }, body: data });
      if (!photoResponse.ok) return setMessage('Rabbi saved, but the cover could not be uploaded.');
    }
    setForm(empty); setEditing(null); setPhoto(null); setMessage('Rabbi saved'); void load();
  };
  const choosePhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.85 });
    if (!result.canceled && result.assets[0]?.uri) setPhoto({ uri: result.assets[0].uri, type: result.assets[0].mimeType || 'image/jpeg' });
  };
  const updateRecording = async (recording: Recording, patch: Partial<Recording>) => {
    const response = await fetch(adminApiUrl(`/api/admin/recordings/${recording.id}`), { method: 'PATCH', headers, body: JSON.stringify(patch) });
    if (!response.ok) { setMessage('Unable to update the Rabbi’s shiurim.'); return; }
    void load();
  };
  const move = (index: number, direction: -1 | 1) => {
    const other = assigned[index + direction]; const current = assigned[index];
    if (!other || !current) return;
    void Promise.all([
      updateRecording(current, { sortOrder: other.sortOrder || index + direction }),
      updateRecording(other, { sortOrder: current.sortOrder || index }),
    ]);
  };

  return <AdminShell token={session.token} title="Rabbi Management"><View style={styles.panel}>
    <Text style={styles.panelTitle}>{editing ? 'Edit Rabbi' : 'Add Rabbi'}</Text>
    {editingRabbi?.photoUrl ? <Image source={{ uri: adminApiUrl(editingRabbi.photoUrl) }} style={styles.coverPreview} /> : null}
    {(['name', 'description', 'biography', 'sortOrder'] as const).map((key) => <View key={key}><Text style={styles.label}>{key === 'sortOrder' ? 'Sort order' : key[0].toUpperCase() + key.slice(1)}</Text><TextInput multiline={key === 'description' || key === 'biography'} keyboardType={key === 'sortOrder' ? 'numeric' : 'default'} onChangeText={(value) => set(key, value)} placeholder={key === 'name' ? 'Rabbi name' : `Optional ${key}`} placeholderTextColor="#69717B" style={[styles.input, (key === 'description' || key === 'biography') && styles.textarea]} value={String(form[key])} /></View>)}
    <View style={styles.toggle}><Text style={styles.label}>Active</Text><Switch onValueChange={(value) => set('enabled', value)} value={form.enabled} trackColor={{ false: '#303740', true: '#2d6cdf' }} /></View>
    <View style={styles.toggle}><Text style={styles.label}>Featured</Text><Switch onValueChange={(value) => set('featured', value)} value={form.featured} trackColor={{ false: '#303740', true: '#2d6cdf' }} /></View>
    <Pressable onPress={() => void choosePhoto()} style={styles.secondary}><Text style={styles.secondaryText}>{photo ? 'New cover selected' : editingRabbi?.photoUrl ? 'Replace Rabbi cover' : 'Choose Rabbi cover'}</Text></Pressable>
    {editingRabbi?.photoUrl ? <Pressable onPress={async () => { await fetch(adminApiUrl(`/api/admin/rabbis/${editingRabbi.id}/photo`), { method: 'DELETE', headers: { Authorization: `Bearer ${session.token}` } }); void load(); }}><Text style={styles.delete}>Remove Rabbi cover</Text></Pressable> : null}
    <Pressable onPress={() => void save()} style={styles.primary}><Text style={styles.primaryText}>{editing ? 'Save changes' : 'Add Rabbi'}</Text></Pressable>
    {editing ? <Pressable onPress={() => { setEditing(null); setForm(empty); }}><Text style={styles.cancel}>Cancel edit</Text></Pressable> : null}
  </View>
  {editing ? <View style={styles.panel}><Text style={styles.panelTitle}>Rabbi’s shiurim</Text><Text style={styles.muted}>Choose recordings for this Rabbi and use Up/Down to set their public order. Assigning a recording already associated with another Rabbi reassigns it here.</Text>{assigned.map((recording, index) => <View key={recording.id} style={styles.row}><Text style={styles.rowTitle} numberOfLines={1}>{recording.title}</Text><Pressable disabled={index === 0} onPress={() => move(index, -1)}><Text style={[styles.action, index === 0 && styles.disabled]}>Up</Text></Pressable><Pressable disabled={index === assigned.length - 1} onPress={() => move(index, 1)}><Text style={[styles.action, index === assigned.length - 1 && styles.disabled]}>Down</Text></Pressable><Pressable onPress={() => void updateRecording(recording, { rabbiId: null, rabbiName: null })}><Text style={styles.delete}>Remove</Text></Pressable></View>)}{available.map((recording) => <View key={recording.id} style={styles.row}><Text style={styles.rowTitle} numberOfLines={1}>{recording.title}</Text><Pressable onPress={() => void updateRecording(recording, { rabbiId: editing, rabbiName: editingRabbi?.name, sortOrder: assigned.length })}><Text style={styles.action}>Assign</Text></Pressable></View>)}</View> : null}
  <View style={styles.panel}><Text style={styles.panelTitle}>Drive Rabbis ({rabbis.length})</Text>{rabbis.map((rabbi) => <View key={rabbi.id} style={styles.row}><View style={styles.copy}><Text style={styles.rowTitle}>{rabbi.name}</Text><Text style={styles.rowMeta}>{rabbi.photoUrl ? 'Cover set' : 'Fallback cover'} · {rabbi.enabled ? 'Visible' : 'Hidden'}</Text></View><Pressable onPress={() => edit(rabbi)}><Text style={styles.action}>Manage</Text></Pressable></View>)}</View>
  {message ? <Text style={styles.message}>{message}</Text> : null}
  </AdminShell>;
}

const styles = StyleSheet.create({
  panel: { backgroundColor: '#1B2026', borderColor: '#2A3139', borderRadius: 12, borderWidth: 1, marginTop: 18, padding: 16 }, panelTitle: { color: '#F2EEE7', fontSize: 17, fontWeight: '700' },
  label: { color: '#A7ADB5', fontSize: 12, fontWeight: '700', marginTop: 14 }, input: { backgroundColor: '#101317', borderColor: '#303740', borderRadius: 8, borderWidth: 1, color: '#F2EEE7', minHeight: 46, marginTop: 6, paddingHorizontal: 12 }, textarea: { minHeight: 84, paddingTop: 12 },
  toggle: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }, primary: { alignItems: 'center', backgroundColor: '#2d6cdf', borderRadius: 8, justifyContent: 'center', marginTop: 16, minHeight: 48 }, primaryText: { color: '#ffffff', fontWeight: '800' },
  secondary: { alignItems: 'center', borderColor: '#4A535C', borderRadius: 8, borderWidth: 1, justifyContent: 'center', marginTop: 14, minHeight: 44 }, secondaryText: { color: '#8bbcff', fontWeight: '700' }, coverPreview: { alignSelf: 'center', borderRadius: 12, height: 128, marginTop: 16, width: 128 },
  row: { alignItems: 'center', borderBottomColor: '#303740', borderBottomWidth: 1, flexDirection: 'row', gap: 12, paddingVertical: 12 }, copy: { flex: 1 }, rowTitle: { color: '#F2EEE7', flex: 1, fontSize: 14, fontWeight: '700' }, rowMeta: { color: '#89909A', fontSize: 11, marginTop: 4 }, action: { color: '#8bbcff', fontWeight: '700' }, disabled: { color: '#59636E' }, delete: { color: '#E69586', fontSize: 12, fontWeight: '700', marginTop: 12 }, cancel: { color: '#89909A', marginTop: 14, textAlign: 'center' }, muted: { color: '#89909A', fontSize: 12, marginTop: 7 }, message: { color: '#92C9A5', marginTop: 14, textAlign: 'center' },
});
