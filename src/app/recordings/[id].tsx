import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useListener } from '@/components/listener-provider';
import { normalizeRecordingTitle } from '@/lib/recording-title';
import { toListenerRecording } from '@/lib/public-recordings';
import { apiUrl } from '@/lib/api';

type Recording = {
  id: string;
  name: string;
  title?: string;
  streamUrl: string;
  coverUrl?: string | null;
  rabbiName?: string | null;
  category?: string;
  recordedDateLabel?: string | null;
  description?: string;
  shiurStartSeconds?: number | null;
  shiurStartSource?: 'automatic' | 'manual' | null;
  shiurStartConfidence?: number | null;
  shiurSkipEnabled?: boolean;
};

function triggerDownload(recordingId: string, title: string) {
  if (typeof document === 'undefined') return;
  const anchor = document.createElement('a');
  anchor.href = apiUrl(`/api/recordings/${encodeURIComponent(recordingId)}/download`);
  anchor.target = '_blank';
  anchor.rel = 'noopener';
  anchor.download = `${(title || 'torat-tsion-recording').replace(/[^a-z0-9-_]+/gi, '-').toLowerCase()}.mp3`;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
}

export default function RecordingDetailsPage() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { play, isFavorite, toggleFavorite, addToQueue, activeRecording, status, seekTo, player } = useListener();
  const [recording, setRecording] = useState<Recording | null>(null);
  const [related, setRelated] = useState<Recording[]>([]);
  useEffect(() => { fetch(apiUrl(`/api/recording-details/${encodeURIComponent(id || '')}`)).then((response) => response.json()).then((payload: { recording?: Recording; related?: Recording[] }) => { setRecording(payload.recording || null); setRelated(payload.related || []); }).catch(() => setRecording(null)); }, [id]);
  if (!recording) return <View style={styles.loading}><ActivityIndicator color="#2d6cdf" /></View>;
  const title = normalizeRecordingTitle(recording.title || recording.name, recording.recordedDateLabel || '');
  const queuedSet = [toListenerRecording(recording), ...related.map(toListenerRecording)];
  const skipSeconds = typeof recording.shiurStartSeconds === 'number' && recording.shiurStartSeconds > 0 && recording.shiurSkipEnabled !== false ? recording.shiurStartSeconds : null;
  const showSkipButton = skipSeconds !== null && status.currentTime < skipSeconds - 1 && (status.duration <= 0 || status.duration > skipSeconds);
  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.container}><Text style={styles.eyebrow}>RECORDING</Text><Text style={styles.title}>{title}</Text><Text style={styles.meta}>{recording.rabbiName || 'Torat Tsion'}{recording.category ? ` · ${recording.category}` : ''}</Text>{recording.description && <Text style={styles.description}>{recording.description}</Text>}<View style={styles.actions}><Pressable onPress={() => play(toListenerRecording(recording), queuedSet)} style={styles.primary}><Text style={styles.primaryText}>▶  Play recording</Text></Pressable><Pressable onPress={() => toggleFavorite(recording.id)} style={styles.secondary}><Text style={styles.secondaryText}>{isFavorite(recording.id) ? '★ Saved' : '☆ Save'}</Text></Pressable><Pressable onPress={() => addToQueue(toListenerRecording(recording))} style={styles.secondary}><Text style={styles.secondaryText}>＋ Queue</Text></Pressable><Pressable onPress={() => triggerDownload(recording.id, title)} style={styles.secondary}><Text style={styles.secondaryText}>↓ Download</Text></Pressable></View>{showSkipButton && <Pressable accessibilityLabel={`Skip to shiur at ${Math.floor(skipSeconds / 60)}:${String(Math.floor(skipSeconds % 60)).padStart(2, '0')}`} onPress={() => { if (activeRecording?.id === recording.id) { seekTo(skipSeconds); if (!status.playing) player.play(); } else { play(toListenerRecording(recording), queuedSet, skipSeconds); } }} style={styles.skipButton}><Text style={styles.skipButtonText}>{`Skip to Shiur · ${Math.floor(skipSeconds / 60)}:${String(Math.floor(skipSeconds % 60)).padStart(2, '0')}`}</Text></Pressable>}{related.length > 0 && <><Text style={styles.heading}>Related recordings</Text>{related.map((item) => <Pressable key={item.id} onPress={() => play(toListenerRecording(item), related.map(toListenerRecording))} style={styles.related}>  <Text style={styles.relatedTitle}>{normalizeRecordingTitle(item.title || item.name, item.recordedDateLabel || '')}</Text><Text style={styles.relatedMeta}>{item.rabbiName || 'Torat Tsion'}</Text></Pressable>)}</>}</ScrollView></SafeAreaView>;}
const styles = StyleSheet.create({ safe: { backgroundColor: '#f4f8ff', flex: 1 }, loading: { alignItems: 'center', backgroundColor: '#f4f8ff', flex: 1, justifyContent: 'center' }, container: { padding: 24, paddingBottom: 100 }, eyebrow: { color: '#2d6cdf', fontSize: 10, fontWeight: '800', letterSpacing: 1.5 }, title: { color: '#142950', fontSize: 30, fontWeight: '800', marginTop: 10 }, meta: { color: '#2d6cdf', marginTop: 8 }, date: { color: '#5b6e8d', fontSize: 13, marginTop: 6 }, description: { color: '#415678', fontSize: 15, lineHeight: 23, marginTop: 22 }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 26 }, primary: { backgroundColor: '#2d6cdf', borderRadius: 10, paddingHorizontal: 15, paddingVertical: 12 }, primaryText: { color: '#ffffff', fontWeight: '800' }, secondary: { borderColor: '#dfeaf7', borderRadius: 10, borderWidth: 1, backgroundColor: '#ffffff', paddingHorizontal: 15, paddingVertical: 12 }, secondaryText: { color: '#142950', fontWeight: '700' }, skipButton: { backgroundColor: '#edf5ff', borderColor: '#bfd4ff', borderRadius: 999, borderWidth: 1, marginTop: 18, paddingHorizontal: 16, paddingVertical: 10 }, skipButtonText: { color: '#1d4ea8', fontSize: 12, fontWeight: '800', letterSpacing: 0.2 }, heading: { color: '#142950', fontSize: 20, fontWeight: '800', marginTop: 34 }, related: { borderBottomColor: '#dfeaf7', borderBottomWidth: 1, paddingVertical: 14 }, relatedTitle: { color: '#142950', fontWeight: '700' }, relatedMeta: { color: '#5b6e8d', fontSize: 12, marginTop: 4 } });
