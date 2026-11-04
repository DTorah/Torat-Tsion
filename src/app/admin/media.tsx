import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { AdminLogin, AdminShell, adminApiUrl, useAdminSession } from '@/components/admin-shell';

type Asset = { id: string; name: string; alt?: string; mimeType: string; size?: number; folderId?: string | null; focalX?: number; focalY?: number; updatedAt?: string; url: string };
type Folder = { id: string; name: string };

export default function MediaLibraryPage() {
  const session = useAdminSession();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [query, setQuery] = useState('');
  const [folderId, setFolderId] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const headers = (): { Authorization: string } | undefined => session.token ? { Authorization: `Bearer ${session.token}` } : undefined;
  const load = async () => {
    if (!session.token) return;
    setLoading(true);
    try {
      const response = await fetch(adminApiUrl(`/api/admin/media?q=${encodeURIComponent(query)}&folderId=${encodeURIComponent(folderId)}`), { headers: headers() });
      const payload = await response.json() as { assets?: Asset[]; folders?: Folder[]; error?: string };
      if (!response.ok) throw new Error(payload.error || 'Unable to load media library');
      setAssets(payload.assets || []);
      setFolders(payload.folders || []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to load media library');
    } finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [session.token, query, folderId]);
  const selected = assets.find((asset) => asset.id === selectedId) || null;
  const visibleAssets = useMemo(() => assets, [assets]);

  const upload = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, quality: 0.9 });
    const asset = result.canceled ? null : result.assets[0];
    if (!asset?.uri) return;
    setBusy(true); setMessage(null);
    try {
      const form = new FormData();
      form.append('image', { uri: asset.uri, name: asset.fileName || 'torat-sion-image.jpg', type: asset.mimeType || 'image/jpeg' } as unknown as Blob);
      if (folderId) form.append('folderId', folderId);
      const response = await fetch(adminApiUrl('/api/admin/media'), { method: 'POST', headers: headers(), body: form });
      const payload = await response.json() as { asset?: Asset; error?: string };
      if (!response.ok || !payload.asset) throw new Error(payload.error || 'Unable to upload image');
      setAssets((current) => [payload.asset!, ...current]);
      setSelectedId(payload.asset.id);
      setMessage('Image uploaded and stored persistently.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to upload image');
    } finally { setBusy(false); }
  };
  const update = async (patch: Partial<Asset>) => {
    if (!selected) return;
    setBusy(true);
    try {
      const response = await fetch(adminApiUrl(`/api/admin/media/${encodeURIComponent(selected.id)}`), { method: 'PATCH', headers: { ...headers(), 'Content-Type': 'application/json' }, body: JSON.stringify(patch) });
      const payload = await response.json() as { asset?: Asset; error?: string };
      if (!response.ok || !payload.asset) throw new Error(payload.error || 'Unable to update image');
      setAssets((current) => current.map((item) => item.id === selected.id ? payload.asset! : item));
      setMessage('Media changes saved.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to update image');
    } finally { setBusy(false); }
  };
  const remove = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      const response = await fetch(adminApiUrl(`/api/admin/media/${encodeURIComponent(selected.id)}`), { method: 'DELETE', headers: headers() });
      if (!response.ok) throw new Error('Unable to delete image');
      setAssets((current) => current.filter((item) => item.id !== selected.id));
      setSelectedId(null);
      setMessage('Image deleted.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to delete image'); } finally { setBusy(false); }
  };
  const createFolder = async () => {
    const name = typeof window !== 'undefined' ? window.prompt('Folder name')?.trim() : '';
    if (!name) return;
    const response = await fetch(adminApiUrl('/api/admin/media/folders'), { method: 'POST', headers: { ...headers(), 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
    if (response.ok) { setMessage('Folder created.'); await load(); }
  };

  if (!session.token) return <AdminLogin onLogin={session.setToken} />;
  return <AdminShell token={session.token} title="Media Library"><ScrollView contentContainerStyle={styles.page}>
    <View style={styles.header}><View><Text style={styles.eyebrow}>DESIGN STUDIO / MEDIA</Text><Text style={styles.title}>Media Library</Text><Text style={styles.subtitle}>Persistent image assets for banners, logos, backgrounds, and page content.</Text></View><View style={styles.actions}><Pressable onPress={createFolder} style={styles.secondary}><Text style={styles.secondaryText}>New folder</Text></Pressable><Pressable disabled={busy} onPress={() => void upload()} style={styles.primary}><Text style={styles.primaryText}>{busy ? 'Working…' : 'Upload image'}</Text></Pressable></View></View>
    {message && <Text style={styles.message}>{message}</Text>}
    <View style={styles.filters}><TextInput onChangeText={setQuery} placeholder="Search images" placeholderTextColor="#7f8992" style={styles.input} value={query} /><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.folderRow}><Pressable onPress={() => setFolderId('')} style={[styles.folderChip, !folderId && styles.folderChipActive]}><Text style={styles.folderText}>All files</Text></Pressable>{folders.map((folder) => <Pressable key={folder.id} onPress={() => setFolderId(folder.id)} style={[styles.folderChip, folderId === folder.id && styles.folderChipActive]}><Text style={styles.folderText}>{folder.name}</Text></Pressable>)}</ScrollView></View>
    {loading ? <ActivityIndicator color="#8bbcff" /> : <View style={styles.content}><View style={styles.grid}>{visibleAssets.map((asset) => <Pressable key={asset.id} onPress={() => setSelectedId(asset.id)} style={[styles.card, selectedId === asset.id && styles.cardSelected]}><Image contentFit="cover" source={{ uri: adminApiUrl(asset.url) }} style={styles.thumb} /><Text numberOfLines={1} style={styles.cardName}>{asset.name}</Text><Text style={styles.cardMeta}>{asset.mimeType} · {Math.round((asset.size || 0) / 1024)} KB</Text></Pressable>)}{!visibleAssets.length && <Text style={styles.empty}>No images found. Upload a PNG, JPEG, or WebP image to begin.</Text>}</View>{selected && <View style={styles.inspector}><Text style={styles.inspectorTitle}>Edit image</Text><Image contentFit="contain" source={{ uri: adminApiUrl(selected.url) }} style={styles.preview} /><Text style={styles.label}>Name</Text><TextInput onEndEditing={(event) => void update({ name: event.nativeEvent.text })} style={styles.input} defaultValue={selected.name} /><Text style={styles.label}>Alt text</Text><TextInput onEndEditing={(event) => void update({ alt: event.nativeEvent.text })} style={styles.input} defaultValue={selected.alt || ''} /><Text style={styles.label}>Focal point: {Math.round((selected.focalX || 0.5) * 100)}% / {Math.round((selected.focalY || 0.5) * 100)}%</Text><View style={styles.row}><Pressable onPress={() => void update({ focalX: Math.max(0, (selected.focalX || 0.5) - 0.1) })} style={styles.secondary}><Text style={styles.secondaryText}>← focus</Text></Pressable><Pressable onPress={() => void update({ focalX: Math.min(1, (selected.focalX || 0.5) + 0.1) })} style={styles.secondary}><Text style={styles.secondaryText}>focus →</Text></Pressable><Pressable onPress={() => void update({ focalY: Math.max(0, (selected.focalY || 0.5) - 0.1) })} style={styles.secondary}><Text style={styles.secondaryText}>↑ focus</Text></Pressable><Pressable onPress={() => void update({ focalY: Math.min(1, (selected.focalY || 0.5) + 0.1) })} style={styles.secondary}><Text style={styles.secondaryText}>↓ focus</Text></Pressable></View><Pressable onPress={() => void remove()} style={styles.danger}><Text style={styles.dangerText}>Delete image</Text></Pressable></View>}</View>}
  </ScrollView></AdminShell>;
}

const styles = StyleSheet.create({
  page: { backgroundColor: '#0d1729', minHeight: '100%', padding: 28 },
  header: { alignItems: 'flex-start', flexDirection: 'row', justifyContent: 'space-between', gap: 18 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  eyebrow: { color: '#8bbcff', fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  title: { color: '#f2f7ff', fontSize: 28, fontWeight: '800', marginTop: 6 },
  subtitle: { color: '#a9bad2', fontSize: 13, marginTop: 8 },
  message: { backgroundColor: '#15365b', borderRadius: 8, color: '#c8e0ff', marginTop: 16, padding: 12 },
  primary: { backgroundColor: '#2d6cdf', borderRadius: 8, paddingHorizontal: 15, paddingVertical: 11 },
  primaryText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  secondary: { borderColor: '#49678f', borderRadius: 8, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10 },
  secondaryText: { color: '#c5d6ee', fontSize: 12, fontWeight: '700' },
  filters: { gap: 10, marginVertical: 20 },
  input: { backgroundColor: '#101a2e', borderColor: '#30486b', borderRadius: 7, borderWidth: 1, color: '#f2f7ff', minHeight: 42, paddingHorizontal: 10 },
  folderRow: { gap: 7 },
  folderChip: { borderColor: '#30486b', borderRadius: 16, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8 },
  folderChipActive: { backgroundColor: '#1d3c68', borderColor: '#65a3ff' },
  folderText: { color: '#c5d6ee', fontSize: 12, fontWeight: '700' },
  content: { flexDirection: 'row', flexWrap: 'wrap', gap: 20 },
  grid: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 12, minWidth: 360 },
  card: { backgroundColor: '#162544', borderColor: '#30486b', borderRadius: 10, borderWidth: 1, padding: 8, width: 180 },
  cardSelected: { borderColor: '#65a3ff' },
  thumb: { borderRadius: 7, height: 110, width: '100%' },
  cardName: { color: '#f2f7ff', fontSize: 12, fontWeight: '700', marginTop: 8 },
  cardMeta: { color: '#9eb2ce', fontSize: 10, marginTop: 4 },
  empty: { color: '#a9bad2', padding: 24 },
  inspector: { backgroundColor: '#162544', borderColor: '#4e76ac', borderRadius: 11, borderWidth: 1, padding: 16, width: 300 },
  inspectorTitle: { color: '#f2f7ff', fontSize: 17, fontWeight: '800' },
  preview: { backgroundColor: '#101a2e', borderRadius: 8, height: 160, marginVertical: 12, width: '100%' },
  label: { color: '#8bbcff', fontSize: 11, fontWeight: '800', marginBottom: 6, marginTop: 10 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  danger: { borderColor: '#8b3d4d', borderRadius: 8, borderWidth: 1, marginTop: 18, padding: 10 },
  dangerText: { color: '#ffb2b2', fontSize: 12, fontWeight: '800', textAlign: 'center' },
});
