import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { apiUrl } from '@/lib/api';

const fallbackCover = require('@/assets/shiur-covers/fallback.png');
// TODO: Replace the fallback artwork with the official Torat Tsion logo asset when available.

type Shiur = { id: string; name: string; mimeType: string; createdTime: string | null };
type Cover = { coverUrl: string; fileName: string; mimeType: string; updatedAt: string };

function DefaultCover({ style }: { style?: object }) {
  return <View style={[styles.defaultCover, style]}><Text style={styles.defaultCoverMark}>S</Text><Text style={styles.defaultCoverBrand}>Torat Tsion</Text><Text style={styles.defaultCoverType}>SHIURIM</Text></View>;
}

export default function CoverAdminScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [shiurim, setShiurim] = useState<Shiur[]>([]);
  const [covers, setCovers] = useState<Record<string, Cover>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<string | null>(null);
  const [previewMimeType, setPreviewMimeType] = useState('image/jpeg');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const [recordingsResponse, coversResponse] = await Promise.all([
        fetch(apiUrl('/api/recordings')),
        fetch(apiUrl('/api/covers'), { headers: sessionToken ? { Authorization: `Bearer ${sessionToken}` } : undefined }),
      ]);
      const recordings = (await recordingsResponse.json()) as { recordings?: Shiur[]; error?: string };
      const coverMap = (await coversResponse.json()) as Record<string, Cover>;
      if (!recordingsResponse.ok) throw new Error(recordings.error ?? 'Unable to load Shiurim');
      if (!coversResponse.ok) throw new Error('Unable to load cover assignments');
      setShiurim(recordings.recordings ?? []);
      setCovers(coverMap);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to load cover manager');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { if (sessionToken) loadData(); }, [sessionToken]);

  const filteredShiurim = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return shiurim.filter((shiur) => !normalized || shiur.name.toLowerCase().includes(normalized));
  }, [query, shiurim]);
  const selectedShiur = shiurim.find((shiur) => shiur.id === selectedId) ?? null;
  const selectedCover = selectedId ? covers[selectedId] : null;

  const chooseCover = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (result.canceled || !result.assets[0]?.uri) return;
    const asset = result.assets[0];
    setPreviewUri(asset.uri);
    setPreviewData(asset.uri);
    setPreviewMimeType(asset.mimeType ?? 'image/jpeg');
    setMessage(null);
    setErrorMessage(null);
  };

  const saveCover = async () => {
    if (!selectedId || !previewData) return;
    setIsSaving(true);
    setMessage(null);
    setErrorMessage(null);
    try {
      const response = await fetch(apiUrl(`/api/covers/${encodeURIComponent(selectedId)}`), {
        method: 'POST',
        headers: sessionToken ? { Authorization: `Bearer ${sessionToken}` } : undefined,
        body: (() => { const form = new FormData(); form.append('image', { uri: previewData, name: previewUri?.split('/').pop() ?? 'cover.jpg', type: previewMimeType } as unknown as Blob); return form; })(),
      });
      const payload = (await response.json()) as { cover?: Cover; error?: string };
      if (!response.ok || !payload.cover) throw new Error(payload.error ?? 'Unable to save cover');
      setCovers((current) => ({ ...current, [selectedId]: payload.cover! }));
      setPreviewData(null);
      setPreviewUri(null);
      setMessage('Cover saved');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to save cover');
    } finally {
      setIsSaving(false);
    }
  };

  const removeCover = async (coverId = selectedId) => {
    if (!coverId) return;
    setIsSaving(true);
    setMessage(null);
    setErrorMessage(null);
    try {
      const response = await fetch(apiUrl(`/api/covers/${encodeURIComponent(coverId)}`), { method: 'DELETE', headers: sessionToken ? { Authorization: `Bearer ${sessionToken}` } : undefined });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? 'Unable to remove cover');
      setCovers((current) => { const next = { ...current }; delete next[coverId]; return next; });
      setPreviewData(null);
      setPreviewUri(null);
      setMessage('Default cover restored');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to remove cover');
    } finally {
      setIsSaving(false);
    }
  };

  const login = async () => {
    setIsLoggingIn(true);
    setErrorMessage(null);
    try {
      const response = await fetch(apiUrl('/api/admin/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const payload = (await response.json()) as { sessionToken?: string; error?: string };
      if (!response.ok || !payload.sessionToken) throw new Error(payload.error ?? 'Unable to sign in');
      setSessionToken(payload.sessionToken);
      setPassword('');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to sign in');
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Stack.Screen options={{ title: 'Shiur Covers', headerShown: false }} />
      <ScrollView contentContainerStyle={[styles.container, { paddingBottom: 36 + insets.bottom }]} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Pressable accessibilityLabel="Back" onPress={() => router.back()} style={styles.backButton}><Text style={styles.backText}>‹</Text></Pressable>
          <View style={styles.headerCopy}><Text style={styles.eyebrow}>TORAT TSION / ADMIN</Text><Text style={styles.title}>Shiur Cover Manager</Text><Text style={styles.subtitle}>Choose the cover shown for each Shiur.</Text></View>
        </View>
        {!sessionToken ? <View style={styles.loginPanel}><Text style={styles.stateTitle}>Admin sign in</Text><Text style={styles.stateText}>Use your server-configured admin credentials to manage Shiur artwork.</Text><TextInput autoCapitalize="none" autoCorrect={false} onChangeText={setUsername} placeholder="Username" placeholderTextColor="#7F8992" style={styles.input} value={username} /><TextInput autoCapitalize="none" onChangeText={setPassword} placeholder="Password" placeholderTextColor="#7F8992" secureTextEntry style={styles.input} value={password} /><Pressable disabled={isLoggingIn} onPress={login} style={({ pressed }) => [styles.primaryButton, isLoggingIn && styles.disabled, pressed && styles.pressed]}><Text style={styles.primaryText}>{isLoggingIn ? 'Signing in...' : 'Sign in'}</Text></Pressable>{errorMessage && <Text style={styles.error}>{errorMessage}</Text>}</View> : isLoading ? <View style={styles.state}><ActivityIndicator color="#2d6cdf" size="large" /><Text style={styles.stateText}>Loading Shiurim...</Text></View> : errorMessage && !selectedShiur ? <View style={styles.state}><Text style={styles.stateTitle}>Could not load Shiurim</Text><Text style={styles.stateText}>{errorMessage}</Text><Pressable onPress={loadData} style={styles.primaryButton}><Text style={styles.primaryText}>Try again</Text></Pressable></View> : !selectedShiur ? (
          <>
            <TextInput accessibilityLabel="Search Shiurim" onChangeText={setQuery} placeholder="Search Shiurim" placeholderTextColor="#7F8992" style={styles.search} value={query} />
            <Text style={styles.listLabel}>{filteredShiurim.length} Shiurim</Text>
            <View style={styles.list}>{filteredShiurim.map((shiur) => <View key={shiur.id} style={styles.listItem}>{covers[shiur.id] ? <Image contentFit="cover" source={{ uri: apiUrl(covers[shiur.id].coverUrl) }} style={styles.listArtwork} /> : <DefaultCover style={styles.listArtwork} />}<View style={styles.listCopy}><Text style={styles.listTitle} numberOfLines={2}>{shiur.name}</Text><Text style={styles.listMeta}>{covers[shiur.id] ? 'Custom cover' : 'Default cover'}</Text></View><View style={styles.rowActions}><Pressable onPress={() => { setSelectedId(shiur.id); setPreviewUri(null); setPreviewData(null); setMessage(null); setErrorMessage(null); }} style={({ pressed }) => [styles.rowButton, pressed && styles.pressed]}><Text style={styles.rowButtonText}>Choose</Text></Pressable>{covers[shiur.id] && <Pressable onPress={() => Alert.alert('Remove cover?', 'This Shiur will use the default Torat Tsion cover.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: () => removeCover(shiur.id) }])} style={({ pressed }) => [styles.rowButton, styles.removeRowButton, pressed && styles.pressed]}><Text style={styles.removeRowText}>Remove</Text></Pressable>}</View></View>)}</View>
          </>
        ) : (
          <>
            <Pressable onPress={() => { setSelectedId(null); setPreviewUri(null); setPreviewData(null); setMessage(null); setErrorMessage(null); }} style={styles.changeShiur}><Text style={styles.changeShiurText}>‹ All Shiurim</Text></Pressable>
            <Text style={styles.selectedTitle}>{selectedShiur.name}</Text>
            <Text style={styles.selectedMeta}>{selectedCover ? `Current cover: ${selectedCover.fileName}` : 'Using the default Torat Tsion cover'}</Text>
            {previewUri ? <Image contentFit="cover" source={{ uri: previewUri }} style={styles.preview} /> : selectedCover?.coverUrl ? <Image contentFit="cover" source={{ uri: apiUrl(selectedCover.coverUrl) }} style={styles.preview} /> : <DefaultCover style={styles.preview} />}
            <Pressable onPress={chooseCover} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}><Text style={styles.primaryText}>Choose Cover</Text></Pressable>
            {previewData && <Text style={styles.previewLabel}>New image ready to save</Text>}
            <View style={styles.actions}>{<Pressable disabled={!previewData || isSaving} onPress={saveCover} style={({ pressed }) => [styles.saveButton, (!previewData || isSaving) && styles.disabled, pressed && styles.pressed]}><Text style={styles.saveText}>{isSaving ? 'Saving...' : 'Save Cover'}</Text></Pressable>}<Pressable disabled={!selectedCover || isSaving} onPress={() => Alert.alert('Remove cover?', 'This Shiur will use the default Torat Tsion cover.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: removeCover }])} style={({ pressed }) => [styles.secondaryButton, (!selectedCover || isSaving) && styles.disabled, pressed && styles.pressed]}><Text style={styles.secondaryText}>Remove Cover</Text></Pressable></View>
            {message && <Text style={styles.success}>{message}</Text>}
            {errorMessage && <Text style={styles.error}>{errorMessage}</Text>}
            <Text style={styles.authNote}>Signed admin sessions protect cover changes. Sessions expire automatically.</Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#101317' },
  container: { paddingHorizontal: 20, paddingTop: 22 },
  header: { alignItems: 'center', flexDirection: 'row', marginBottom: 28 },
  backButton: { alignItems: 'center', height: 48, justifyContent: 'center', marginRight: 10, width: 48 },
  backText: { color: '#F2EEE7', fontSize: 38, fontWeight: '300', lineHeight: 42 },
  headerCopy: { flex: 1 },
  eyebrow: { color: '#2d6cdf', fontSize: 10, fontWeight: '800', letterSpacing: 1.7 },
  title: { color: '#F2EEE7', fontSize: 28, fontWeight: '700', marginTop: 5 },
  subtitle: { color: '#89909A', fontSize: 13, marginTop: 5 },
  search: { backgroundColor: '#1B2026', borderColor: '#303740', borderRadius: 10, borderWidth: 1, color: '#F2EEE7', fontSize: 15, height: 52, paddingHorizontal: 16 },
  listLabel: { color: '#89909A', fontSize: 12, marginBottom: 10, marginTop: 22 },
  list: { gap: 9 },
  listItem: { alignItems: 'center', backgroundColor: '#1B2026', borderColor: '#2A3139', borderRadius: 12, borderWidth: 1, flexDirection: 'row', minHeight: 78, padding: 10 },
  listArtwork: { backgroundColor: '#2A3139', borderRadius: 8, height: 56, width: 56 },
  listCopy: { flex: 1, marginHorizontal: 13 },
  rowActions: { alignItems: 'flex-end', gap: 4 },
  rowButton: { alignItems: 'center', backgroundColor: '#2d6cdf', borderRadius: 7, justifyContent: 'center', minHeight: 44, minWidth: 64, paddingHorizontal: 8 },
  rowButtonText: { color: '#101317', fontSize: 11, fontWeight: '800' },
  removeRowButton: { backgroundColor: 'transparent', borderColor: '#4A535C', borderWidth: 1 },
  removeRowText: { color: '#2d6cdf', fontSize: 11, fontWeight: '700' },
  listTitle: { color: '#F2EEE7', fontSize: 14, fontWeight: '600', lineHeight: 19 },
  listMeta: { color: '#2d6cdf', fontSize: 11, marginTop: 5 },
  chevron: { color: '#89909A', fontSize: 27, paddingHorizontal: 6 },
  changeShiur: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' },
  changeShiurText: { color: '#2d6cdf', fontSize: 14, fontWeight: '600' },
  selectedTitle: { color: '#F2EEE7', fontSize: 21, fontWeight: '700', marginTop: 12 },
  selectedMeta: { color: '#89909A', fontSize: 12, marginTop: 7 },
  preview: { alignSelf: 'center', backgroundColor: '#1B2026', borderColor: '#303740', borderRadius: 16, borderWidth: 1, height: 280, marginVertical: 24, width: 280 },
  loginPanel: { backgroundColor: '#1B2026', borderColor: '#2A3139', borderRadius: 14, borderWidth: 1, padding: 20 },
  input: { backgroundColor: '#101317', borderColor: '#303740', borderRadius: 9, borderWidth: 1, color: '#F2EEE7', fontSize: 15, height: 50, marginTop: 12, paddingHorizontal: 14 },
  defaultCover: { alignItems: 'center', backgroundColor: '#26343A', justifyContent: 'center' },
  defaultCoverMark: { color: '#2d6cdf', fontSize: 30, fontWeight: '800', letterSpacing: 2 },
  defaultCoverBrand: { color: '#F2EEE7', fontSize: 10, fontWeight: '700', marginTop: 8 },
  defaultCoverType: { color: '#9FB3AE', fontSize: 7, fontWeight: '800', letterSpacing: 2, marginTop: 5 },
  primaryButton: { alignItems: 'center', backgroundColor: '#2d6cdf', borderRadius: 10, minHeight: 48, justifyContent: 'center', paddingHorizontal: 20 },
  primaryText: { color: '#101317', fontSize: 14, fontWeight: '800' },
  previewLabel: { color: '#2d6cdf', fontSize: 12, marginTop: 12, textAlign: 'center' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  saveButton: { alignItems: 'center', backgroundColor: '#F2EEE7', borderRadius: 10, flex: 1, justifyContent: 'center', minHeight: 48 },
  saveText: { color: '#101317', fontSize: 13, fontWeight: '800' },
  secondaryButton: { alignItems: 'center', borderColor: '#4A535C', borderRadius: 10, borderWidth: 1, flex: 1, justifyContent: 'center', minHeight: 48 },
  secondaryText: { color: '#2d6cdf', fontSize: 13, fontWeight: '700' },
  disabled: { opacity: 0.4 },
  state: { alignItems: 'center', backgroundColor: '#1B2026', borderRadius: 14, justifyContent: 'center', minHeight: 250, padding: 28 },
  stateTitle: { color: '#F2EEE7', fontSize: 18, fontWeight: '700' },
  stateText: { color: '#89909A', fontSize: 13, marginTop: 10, textAlign: 'center' },
  success: { color: '#92C9A5', fontSize: 13, marginTop: 18, textAlign: 'center' },
  error: { color: '#E69586', fontSize: 13, marginTop: 18, textAlign: 'center' },
  authNote: { color: '#69717B', fontSize: 11, lineHeight: 16, marginTop: 25, textAlign: 'center' },
  pressed: { opacity: 0.7 },
});
