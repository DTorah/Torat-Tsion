import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

import { getShiurSkipSeconds, useListener, type ListenerRecording } from '@/components/listener-provider';
import { apiUrl } from '@/lib/api';
import { normalizeRecordingTitle } from '@/lib/recording-title';

type Rabbi = { id: string; name: string; description: string; biography: string; photoUrl: string | null };
type Folder = { id: string; name: string };
type Recording = { id: string; title: string; name: string; category?: string; streamUrl: string; coverUrl?: string | null; rabbiName?: string | null; recordedDateLabel?: string | null; shiurStartSeconds?: number | null; shiurSkipEnabled?: boolean; folderPath?: Folder[] };
type FolderPayload = { folder?: Folder; recordings?: Recording[]; folders?: Folder[]; error?: string };

export default function RabbiProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { status, player, activeRecording, play } = useListener();
  const [rabbi, setRabbi] = useState<Rabbi | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Breadcrumb of folders below the Rabbi root. Preserves Drive's own ordering at every level.
  const [stack, setStack] = useState<Folder[]>([]);
  const [level, setLevel] = useState<FolderPayload | null>(null);
  const [levelLoading, setLevelLoading] = useState(true);
  const [levelError, setLevelError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(apiUrl(`/api/rabbis/${encodeURIComponent(id || '')}`))
      .then(async (response) => {
        const payload = await response.json() as { rabbi?: Rabbi; error?: string };
        if (!response.ok || !payload.rabbi) throw new Error(payload.error || 'Rabbi not found');
        setRabbi(payload.rabbi);
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Unable to load profile'))
      .finally(() => setLoading(false));
    setStack([]);
  }, [id]);

  const currentFolderId = stack.length ? stack[stack.length - 1].id : id;
  useEffect(() => {
    if (!currentFolderId) return;
    setLevelLoading(true);
    setLevelError(null);
    fetch(apiUrl(`/api/recordings/folder/${encodeURIComponent(currentFolderId)}`))
      .then(async (response) => {
        const payload = await response.json() as FolderPayload;
        if (!response.ok) throw new Error(payload.error || 'Unable to load this folder');
        setLevel(payload);
      })
      .catch((reason) => setLevelError(reason instanceof Error ? reason.message : 'Unable to load this folder'))
      .finally(() => setLevelLoading(false));
  }, [currentFolderId]);

  const toListenerRecording = (recording: Recording): ListenerRecording => ({
    id: recording.id,
    title: normalizeRecordingTitle(recording.title || recording.name),
    speaker: recording.rabbiName || rabbi?.name || 'Torat Tsion',
    category: recording.category || 'Torah',
    source: apiUrl(recording.streamUrl),
    coverUrl: recording.coverUrl ? apiUrl(recording.coverUrl) : null,
    coverAsset: require('@/assets/shiur-covers/fallback.png'),
    shiurStartSeconds: recording.shiurStartSeconds,
    shiurSkipEnabled: recording.shiurSkipEnabled,
  });

  if (loading) return <View style={styles.loading}><ActivityIndicator color="#2d6cdf" /></View>;
  if (error || !rabbi) return <View style={styles.loading}><Text style={styles.error}>{error || 'Rabbi not found'}</Text></View>;

  const childFolders = level?.folders || [];
  const recordings = level?.recordings || [];
  // If this level has subfolders, only the folders are shown — recordings are never flattened onto the Rabbi page.
  const showFolders = childFolders.length > 0;

  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.container}>
    <Pressable onPress={() => (stack.length ? setStack(stack.slice(0, -1)) : router.back())}><Text style={styles.back}>‹ {stack.length ? stack[stack.length - 1].name : 'Back'}</Text></Pressable>
    {!stack.length && <>
      {rabbi.photoUrl ? <Image source={{ uri: apiUrl(rabbi.photoUrl) }} style={styles.photo} /> : <View style={styles.photo}><Text style={styles.initials}>{rabbi.name.slice(0, 2).toUpperCase()}</Text></View>}
      <Text style={styles.eyebrow}>RABBI PROFILE</Text><Text style={styles.title}>{rabbi.name}</Text>
      <Text style={styles.description}>{rabbi.description}</Text>
      {rabbi.biography ? <Text style={styles.body}>{rabbi.biography}</Text> : null}
    </>}
    {stack.length > 0 && <Text style={styles.title}>{stack[stack.length - 1].name}</Text>}

    {levelLoading && <View style={styles.loadingInline}><ActivityIndicator color="#2d6cdf" /></View>}
    {levelError && <Text style={styles.error}>{levelError}</Text>}

    {!levelLoading && !levelError && showFolders && <>
      <Text style={styles.heading}>{childFolders.length} {childFolders.length === 1 ? 'Folder' : 'Folders'}</Text>
      <View style={styles.folderGrid}>
        {childFolders.map((folder) => (
          <Pressable key={folder.id} onPress={() => setStack([...stack, folder])} style={styles.folderCard}>
            <Text style={styles.folderIcon}>◉</Text>
            <Text numberOfLines={2} style={styles.folderName}>{folder.name}</Text>
          </Pressable>
        ))}
      </View>
    </>}

    {!levelLoading && !levelError && !showFolders && <>
      <Text style={styles.heading}>{recordings.length} {recordings.length === 1 ? 'Shiur' : 'Shiurim'}</Text>
      {recordings.map((recording) => {
        const listenerRecording = toListenerRecording(recording);
        const active = activeRecording?.id === recording.id;
        const skipSeconds = getShiurSkipSeconds(listenerRecording);
        return <View key={recording.id} style={styles.recording}>
          <View style={styles.recordingCopy}><Text style={styles.recordingTitle}>{normalizeRecordingTitle(recording.title || recording.name, recording.recordedDateLabel || '')}</Text><Text style={styles.recordingMeta}>{recording.category || 'Torah'}</Text></View>
          {skipSeconds !== null && <Pressable onPress={() => { if (active) { player.seekTo(skipSeconds); if (!status.playing) player.play(); } else play(listenerRecording, recordings.map(toListenerRecording), skipSeconds); }} style={styles.skip}><Text style={styles.skipText}>Skip to Shiur</Text></Pressable>}
          <Pressable accessibilityLabel={`${active && status.playing ? 'Pause' : 'Play'} ${normalizeRecordingTitle(recording.title || recording.name, recording.recordedDateLabel || '')}`} onPress={() => play(listenerRecording, recordings.map(toListenerRecording))} style={styles.play}><Text style={styles.playText}>{active && status.playing ? 'Ⅱ' : '▶'}</Text></Pressable>
        </View>;
      })}
      {!recordings.length && <Text style={styles.body}>No recordings are available yet.</Text>}
    </>}
  </ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { backgroundColor: '#f4f8ff', flex: 1 }, loading: { alignItems: 'center', backgroundColor: '#f4f8ff', flex: 1, justifyContent: 'center', padding: 24 },
  loadingInline: { alignItems: 'center', padding: 24 },
  container: { padding: 22, paddingBottom: 48 }, back: { color: '#1d4ea8', fontSize: 14, fontWeight: '700', marginBottom: 20 },
  photo: { alignItems: 'center', alignSelf: 'center', backgroundColor: '#dfeaf7', borderRadius: 100, height: 148, justifyContent: 'center', overflow: 'hidden', width: 148 },
  initials: { color: '#2d6cdf', fontSize: 42, fontWeight: '800' }, eyebrow: { color: '#2d6cdf', fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginTop: 22 },
  title: { color: '#142950', fontSize: 30, fontWeight: '800', marginTop: 8 }, description: { color: '#415678', fontSize: 15, lineHeight: 23, marginTop: 10 },
  heading: { color: '#142950', fontSize: 20, fontWeight: '800', marginTop: 28 }, body: { color: '#5b6e8d', fontSize: 14, lineHeight: 22, marginTop: 12 },
  folderGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 14 },
  folderCard: { backgroundColor: '#ffffff', borderColor: '#dfeaf7', borderRadius: 16, borderWidth: 1, minHeight: 100, padding: 16, width: 200 },
  folderIcon: { color: '#2d6cdf', fontSize: 20, fontWeight: '800' },
  folderName: { color: '#142950', fontSize: 15, fontWeight: '700', marginTop: 10 },
  recording: { alignItems: 'center', backgroundColor: '#ffffff', borderColor: '#dfeaf7', borderRadius: 12, borderWidth: 1, flexDirection: 'row', marginTop: 8, padding: 13 },
  recordingCopy: { flex: 1 }, recordingTitle: { color: '#142950', fontSize: 14, fontWeight: '700' }, recordingMeta: { color: '#5b6e8d', fontSize: 11, marginTop: 5 },
  skip: { backgroundColor: '#edf5ff', borderColor: '#bfd4ff', borderRadius: 999, borderWidth: 1, marginRight: 8, paddingHorizontal: 9, paddingVertical: 7 }, skipText: { color: '#1d4ea8', fontSize: 10, fontWeight: '800' },
  play: { alignItems: 'center', backgroundColor: '#2d6cdf', borderRadius: 20, height: 40, justifyContent: 'center', width: 40 }, playText: { color: '#ffffff', fontWeight: '800' }, error: { color: '#b42318', textAlign: 'center' },
});
