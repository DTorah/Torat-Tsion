import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { apiUrl } from '@/lib/api';
import { PublicHeader } from '@/components/public-site';
import { VideoShowcase } from '@/components/video-showcase';

type Video = {
  id: string;
  title: string;
  description: string;
  publishedAt?: string | null;
  channelTitle?: string;
  thumbnailUrl?: string | null;
  embedUrl: string;
  sourceKey?: string;
  sourceLabel?: string;
};
type VideoSource = { key: string; label: string; url?: string; videos: Video[] };
type VideoPayload = { configured?: boolean; missing?: string[]; videos?: Video[]; sources?: VideoSource[]; error?: string };

export default function VideosScreen() {
  const { video: requestedVideo } = useLocalSearchParams<{ video?: string }>();
  const [payload, setPayload] = useState<VideoPayload | null>(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { width } = useWindowDimensions();
  useEffect(() => {
    fetch(apiUrl('/api/videos'))
      .then(async (response) => {
        const value = await response.json() as VideoPayload;
        if (!response.ok) throw new Error(value.error || 'Unable to load classes');
        setPayload(value);
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Unable to load classes'))
      .finally(() => setLoading(false));
  }, [requestedVideo]);
  const normalizedQuery = query.trim().toLowerCase();
  const videos = useMemo(() => [...new Map((payload?.sources || []).flatMap((source) => source.videos).map((video) => [video.id, video])).values()]
    .filter((video) => !normalizedQuery || `${video.title} ${video.description}`.toLowerCase().includes(normalizedQuery))
    .sort((a, b) => {
      const aTime = a.publishedAt ? Date.parse(a.publishedAt) : Number.NaN;
      const bTime = b.publishedAt ? Date.parse(b.publishedAt) : Number.NaN;
      if (Number.isFinite(aTime) && Number.isFinite(bTime)) return bTime - aTime;
      if (Number.isFinite(aTime)) return -1;
      if (Number.isFinite(bTime)) return 1;
      return 0;
    }), [normalizedQuery, payload?.sources]);
  const isNarrow = width < 900;
  return <ScrollView contentContainerStyle={[styles.page, isNarrow && styles.pageNarrow]}>
    <PublicHeader query={query} setQuery={setQuery} />
    <View style={styles.hero}><Text style={styles.eyebrow}>TORAH FARSI · VIDEO LIBRARY</Text><Text style={styles.title}>Learn by watching.</Text><Text style={styles.body}>Browse the complete Torah Farsi class library and play any recording without leaving the site.</Text><TextInput accessibilityLabel="Search classes" onChangeText={setQuery} placeholder="Search videos by title or topic" placeholderTextColor="#7890a3" style={styles.searchInput} value={query} /></View>
    <View style={[styles.contentLayout, isNarrow && styles.contentLayoutNarrow]}>
      <View style={styles.videoContent}>
        {loading ? <Text style={styles.body}>Loading official classes…</Text> : error ? <Text style={styles.error}>{error}</Text> : !payload?.configured ? <View style={styles.notice}><Text style={styles.noticeTitle}>The video library is not configured</Text><Text style={styles.body}>No placeholder videos are shown until the library is configured.</Text></View> : null}
        {!loading && !error && payload?.configured && (videos.length ? <VideoShowcase initialVideoId={requestedVideo} title="All Shiurim" videos={videos} /> : <Text style={styles.emptyText}>{normalizedQuery ? 'No matching classes were found.' : 'No public classes were returned yet.'}</Text>)}
        <View style={styles.notice}><Text style={styles.noticeTitle}>Torah Farsi video library</Text><Text style={styles.body}>Select any thumbnail to continue watching without leaving this site.</Text></View>
      </View>
    </View>
  </ScrollView>;
}

const styles = StyleSheet.create({
  page: { backgroundColor: '#F8F9FA', flexGrow: 1, gap: 22, padding: 28, paddingLeft: Platform.OS === 'web' ? 260 : 28 },
  pageNarrow: { padding: 18 },
  hero: { backgroundColor: '#ffffff', borderColor: '#e5e7eb', borderRadius: 16, borderWidth: 1, maxWidth: 900, padding: 32 },
  eyebrow: { color: '#0052CC', fontSize: 12, fontWeight: '800', letterSpacing: 1.4 },
  title: { color: '#111827', fontSize: 38, fontWeight: '800', marginTop: 12 },
  body: { color: '#4b5563', fontSize: 16, lineHeight: 25, marginTop: 14 },
  searchInput: { backgroundColor: '#fff', borderColor: '#b8d7e6', borderRadius: 10, borderWidth: 1, color: '#102a43', fontSize: 15, marginTop: 22, maxWidth: 560, paddingHorizontal: 15, paddingVertical: 13 },
  contentLayout: { alignItems: 'flex-start', flexDirection: 'row', gap: 22 },
  contentLayoutNarrow: { flexDirection: 'column' },
  videoContent: { flex: 1, minWidth: 0 },
  sourceSection: { maxWidth: 1100 },
  sectionHeader: { alignItems: 'flex-end', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  sectionEyebrow: { color: '#147d89', fontSize: 10, fontWeight: '800', letterSpacing: 1.4 },
  sectionTitle: { color: '#102a43', fontSize: 25, fontWeight: '800', marginTop: 5 },
  notice: { backgroundColor: '#fff', borderColor: '#d9e7ef', borderRadius: 14, borderWidth: 1, maxWidth: 900, padding: 22 },
  noticeTitle: { color: '#123b63', fontSize: 19, fontWeight: '800' },
  emptyText: { color: '#627d98', fontSize: 14, paddingVertical: 10 },
  error: { color: '#b42318', fontSize: 15 },
});
