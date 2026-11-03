import { useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { PublicRecordingList } from '@/components/public-site';
import { fetchPublicJson } from '@/lib/public-api-cache';

type Recording = { id: string; name: string; title?: string; streamUrl: string };
type Video = { id: string; title: string; channelTitle?: string; watchUrl: string; thumbnailUrl?: string | null };
export default function SearchPage() {
  const router = useRouter();
  const { q } = useLocalSearchParams<{ q?: string }>();
  const [recordings, setRecordings] = useState<Recording[] | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setRecordings(null);
    setError(null);
    fetchPublicJson<{ results?: Recording[]; videos?: Video[] }>(`/api/search?q=${encodeURIComponent(q || '')}`, 30_000)
      .then((payload) => { setRecordings(payload.results || []); setVideos(payload.videos || []); })
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Unable to search recordings'));
  }, [q]);
  if (recordings === null) return <View style={{ alignItems: 'center', flex: 1, justifyContent: 'center' }}><ActivityIndicator color="#2d6cdf" /></View>;
  if (error) return <View style={{ alignItems: 'center', flex: 1, justifyContent: 'center', padding: 24 }}><Text style={{ color: '#b42318' }}>{error}</Text></View>;
  return <View style={styles.page}><PublicRecordingList title={`Search results${q ? ` for “${q}”` : ''}`} recordings={recordings} />{videos.length > 0 && <View style={styles.videoSection}><Text style={styles.videoHeading}>Video results</Text>{videos.map((video) => <Pressable key={video.id} onPress={() => router.push(`/videos?video=${encodeURIComponent(video.id)}` as never)} style={styles.videoCard}><Text style={styles.videoTitle}>{video.title}</Text><Text style={styles.videoMeta}>Play inside Torat Sion</Text></Pressable>)}</View>}</View>;
}

const styles = StyleSheet.create({
  page: { backgroundColor: '#f4f8ff', flex: 1 },
  videoSection: { alignSelf: 'center', maxWidth: 1240, paddingBottom: 100, paddingHorizontal: 28, width: '100%' },
  videoHeading: { color: '#142950', fontSize: 24, fontWeight: '800', marginBottom: 12 },
  videoCard: { backgroundColor: '#fff', borderColor: '#dfeaf7', borderRadius: 12, borderWidth: 1, marginBottom: 10, padding: 16 },
  videoTitle: { color: '#142950', fontSize: 16, fontWeight: '700' },
  videoMeta: { color: '#2d6cdf', fontSize: 12, marginTop: 6 },
});