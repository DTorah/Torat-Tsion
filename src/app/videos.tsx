import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { apiUrl } from '@/lib/api';
import { PublicHeader } from '@/components/public-site';

type Video = {
  id: string;
  title: string;
  description: string;
  publishedAt?: string | null;
  channelTitle?: string;
  thumbnailUrl?: string | null;
  watchUrl: string;
  embedUrl: string;
  sourceKey?: string;
  sourceLabel?: string;
};
type VideoSource = { key: string; label: string; url?: string; videos: Video[] };
type VideoPayload = { configured?: boolean; missing?: string[]; videos?: Video[]; sources?: VideoSource[]; error?: string };

function YouTubeEmbed({ video }: { video: Video }) {
  if (Platform.OS !== 'web') {
    return <View style={styles.externalButton}><Text style={styles.externalButtonText}>Inline video playback is available on the web player.</Text></View>;
  }
  return <View style={styles.embedWrap}>{React.createElement('iframe', {
    src: `${video.embedUrl}?rel=0`,
    title: video.title,
    allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share',
    allowFullScreen: true,
    style: { border: 0, height: '100%', width: '100%' },
  })}</View>;
}

function VideoCard({ video, onPlay }: { video: Video; onPlay: () => void }) {
  return <Pressable accessibilityLabel={`Play ${video.title}`} onPress={onPlay} style={styles.videoCard}>
    <View style={styles.thumbnailWrap}>
      {video.thumbnailUrl ? <Image contentFit="cover" source={{ uri: video.thumbnailUrl }} style={styles.thumbnail} /> : <View style={[styles.thumbnail, styles.thumbnailFallback]}><Text style={styles.thumbnailFallbackText}>TORAT TSION</Text></View>}
      <View style={styles.playBadge}><Text style={styles.playIcon}>▶</Text></View>
    </View>
    <View style={styles.videoCardBody}><Text numberOfLines={2} style={styles.videoTitle}>{video.title}</Text>{video.publishedAt ? <Text style={styles.videoMeta}>{new Date(video.publishedAt).toLocaleDateString()}</Text> : null}</View>
  </Pressable>;
}

function VideoPlayerPanel({ video, onClose }: { video: Video; onClose: () => void }) {
  return <View style={styles.playerPanel}>
    <View style={styles.panelHeader}><Text style={styles.panelEyebrow}>NOW PLAYING</Text><Pressable accessibilityLabel="Close video player" onPress={onClose} style={styles.closeButton}><Text style={styles.closeButtonText}>×</Text></Pressable></View>
    <YouTubeEmbed video={video} />
    <Text style={styles.playerTitle}>{video.title}</Text>
    {video.publishedAt ? <Text style={styles.meta}>{new Date(video.publishedAt).toLocaleDateString()}</Text> : null}
    {video.description ? <Text numberOfLines={4} style={styles.body}>{video.description}</Text> : null}
  </View>;
}

export default function VideosScreen() {
  const { video: requestedVideo } = useLocalSearchParams<{ video?: string }>();
  const [payload, setPayload] = useState<VideoPayload | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { width } = useWindowDimensions();
  useEffect(() => {
    fetch(apiUrl('/api/videos'))
      .then(async (response) => {
        const value = await response.json() as VideoPayload;
        if (!response.ok) throw new Error(value.error || 'Unable to load YouTube videos');
        setPayload(value);
        setSelectedVideo(value.videos?.find((item) => item.id === requestedVideo) || value.videos?.[0] || null);
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Unable to load YouTube videos'))
      .finally(() => setLoading(false));
  }, [requestedVideo]);
  const normalizedQuery = query.trim().toLowerCase();
  const sources = useMemo(() => (payload?.sources || []).map((source) => ({
    ...source,
    videos: source.videos.filter((video) => !normalizedQuery || `${video.title} ${video.description} ${video.channelTitle || ''}`.toLowerCase().includes(normalizedQuery)),
  })), [normalizedQuery, payload?.sources]);
  const isNarrow = width < 900;
  return <ScrollView contentContainerStyle={[styles.page, isNarrow && styles.pageNarrow]}>
    <PublicHeader query={query} setQuery={setQuery} />
    <View style={styles.hero}><Text style={styles.eyebrow}>TORAT TSION · YOUTUBE VIDEOS</Text><Text style={styles.title}>Learn by watching.</Text><Text style={styles.body}>Watch real classes from Rabbi Isaac Bakhshi and the Shabbat Shalom channel without leaving Torat Tsion. Choose a class below to play it in the embedded YouTube player.</Text><TextInput accessibilityLabel="Search YouTube videos" onChangeText={setQuery} placeholder="Search videos by title or topic" placeholderTextColor="#7890a3" style={styles.searchInput} value={query} /></View>
    <View style={[styles.contentLayout, isNarrow && styles.contentLayoutNarrow]}>
      <View style={styles.videoContent}>
        {loading ? <Text style={styles.body}>Loading official YouTube classes…</Text> : error ? <Text style={styles.error}>{error}</Text> : !payload?.configured ? <View style={styles.notice}><Text style={styles.noticeTitle}>YouTube playback is not configured</Text><Text style={styles.body}>The backend needs the server-only environment variable {payload?.missing?.join(', ') || 'YOUTUBE_API_KEY'} in Render. No placeholder videos are shown.</Text></View> : null}
        {!loading && !error && payload?.configured && sources.map((source) => <View key={source.key} style={styles.sourceSection}><View style={styles.sectionHeader}><View><Text style={styles.sectionEyebrow}>OFFICIAL SOURCE</Text><Text style={styles.sectionTitle}>{source.label}</Text></View></View>{source.videos.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.videoRow}>{source.videos.map((video) => <VideoCard key={video.id} video={video} onPlay={() => setSelectedVideo(video)} />)}</ScrollView> : <Text style={styles.emptyText}>{normalizedQuery ? 'No matching classes in this source.' : 'No public videos were returned from this source yet.'}</Text>}</View>)}
        {!loading && !error && payload?.configured && !sources.some((source) => source.videos.length > 0) && <Text style={styles.emptyText}>{normalizedQuery ? 'No matching classes were found.' : 'No public videos were returned from either source yet.'}</Text>}
        <View style={styles.notice}><Text style={styles.noticeTitle}>Torat Sion video library</Text><Text style={styles.body}>Videos are presented inside Torat Sion using the configured video metadata and embedded player. Select any thumbnail to continue watching without leaving this site.</Text></View>
      </View>
      {selectedVideo && <VideoPlayerPanel onClose={() => setSelectedVideo(null)} video={selectedVideo} />}
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
  playerPanel: { backgroundColor: '#fff', borderColor: '#b8d7e6', borderRadius: 16, borderWidth: 1, maxWidth: 420, overflow: 'hidden', padding: 18, width: '100%' },
  panelHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  panelEyebrow: { color: '#147d89', fontSize: 11, fontWeight: '800', letterSpacing: 1.4 },
  closeButton: { alignItems: 'center', borderColor: '#b8d7e6', borderRadius: 16, borderWidth: 1, height: 32, justifyContent: 'center', width: 32 },
  closeButtonText: { color: '#123b63', fontSize: 24, lineHeight: 26 },
  embedWrap: { aspectRatio: 16 / 9, backgroundColor: '#102a43', overflow: 'hidden', width: '100%' },
  playerTitle: { color: '#123b63', fontSize: 23, fontWeight: '800', marginTop: 16 },
  meta: { color: '#147d89', fontSize: 13, marginTop: 7 },
  sourceSection: { maxWidth: 1100 },
  sectionHeader: { alignItems: 'flex-end', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  sectionEyebrow: { color: '#147d89', fontSize: 10, fontWeight: '800', letterSpacing: 1.4 },
  sectionTitle: { color: '#102a43', fontSize: 25, fontWeight: '800', marginTop: 5 },
  sourceLink: { color: '#123b63', fontSize: 13, fontWeight: '800', padding: 8 },
  videoRow: { gap: 14, paddingBottom: 5 },
  videoCard: { backgroundColor: '#fff', borderColor: '#d9e7ef', borderRadius: 14, borderWidth: 1, overflow: 'hidden', width: 250 },
  thumbnailWrap: { backgroundColor: '#d9e7ef', height: 141, position: 'relative', width: '100%' },
  thumbnail: { height: '100%', width: '100%' },
  thumbnailFallback: { alignItems: 'center', justifyContent: 'center' },
  thumbnailFallbackText: { color: '#356078', fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  playBadge: { alignItems: 'center', backgroundColor: '#0052CC', borderRadius: 999, height: 44, justifyContent: 'center', left: '50%', position: 'absolute', top: '50%', transform: [{ translateX: -22 }, { translateY: -22 }], width: 44 },
  playIcon: { color: '#fff', fontSize: 15, marginLeft: 2 },
  videoCardBody: { minHeight: 88, padding: 13 },
  videoTitle: { color: '#123b63', fontSize: 15, fontWeight: '800', lineHeight: 20 },
  videoMeta: { color: '#7890a3', fontSize: 12, marginTop: 8 },
  notice: { backgroundColor: '#fff', borderColor: '#d9e7ef', borderRadius: 14, borderWidth: 1, maxWidth: 900, padding: 22 },
  noticeTitle: { color: '#123b63', fontSize: 19, fontWeight: '800' },
  emptyText: { color: '#627d98', fontSize: 14, paddingVertical: 10 },
  error: { color: '#b42318', fontSize: 15 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 16 },
  externalButton: { alignSelf: 'flex-start', backgroundColor: '#123b63', borderRadius: 8, marginTop: 18, paddingHorizontal: 18, paddingVertical: 13 },
  externalButtonText: { color: '#fff', fontWeight: '800' },
  secondaryButton: { borderColor: '#b8d7e6', borderRadius: 8, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 11 },
  secondaryButtonText: { color: '#123b63', fontSize: 12, fontWeight: '800' },
});
