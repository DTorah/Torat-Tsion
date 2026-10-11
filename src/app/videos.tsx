import React, { useEffect, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ahavatShalomYouTubeUrl, kolHalashonUrl } from '@/lib/site';
import { apiUrl } from '@/lib/api';

type Video = { id: string; title: string; description: string; publishedAt?: string | null; channelTitle?: string; thumbnailUrl?: string | null; watchUrl: string; embedUrl: string; source: string };

function YouTubeEmbed({ video }: { video: Video }) {
  if (Platform.OS !== 'web') {
    return <Pressable onPress={() => Linking.openURL(video.watchUrl)} style={styles.externalButton}><Text style={styles.externalButtonText}>Open on YouTube</Text></Pressable>;
  }
  return <View style={styles.embedWrap}>{React.createElement('iframe', {
    src: video.embedUrl,
    title: video.title,
    allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share',
    allowFullScreen: true,
    style: { border: 0, height: '100%', width: '100%' },
  })}</View>;
}

export default function VideosScreen() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [configured, setConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    fetch(apiUrl('/api/videos'))
      .then(async (response) => {
        const payload = await response.json() as { videos?: Video[]; configured?: boolean; error?: string };
        if (!response.ok) throw new Error(payload.error || 'Unable to load videos');
        setConfigured(Boolean(payload.configured));
        setVideos(payload.videos || []);
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Unable to load videos'))
      .finally(() => setLoading(false));
  }, []);
  return <ScrollView contentContainerStyle={styles.page}>
    <View style={styles.hero}><Text style={styles.eyebrow}>TORAT TSION VIDEOS</Text><Text style={styles.title}>Learn by watching.</Text><Text style={styles.body}>Official YouTube classes appear here when the server is configured with the verified channel or playlist. Torat Tsion does not download or re-host YouTube content.</Text></View>
    {loading ? <Text style={styles.body}>Loading videos…</Text> : error ? <Text style={styles.error}>{error}</Text> : videos.length ? videos.map((video) => <View key={video.id} style={styles.card}><YouTubeEmbed video={video} /><Text style={styles.cardTitle}>{video.title}</Text><Text style={styles.meta}>{video.channelTitle || 'YouTube'}{video.publishedAt ? ` · ${new Date(video.publishedAt).toLocaleDateString()}` : ''}</Text><Text numberOfLines={3} style={styles.body}>{video.description}</Text><Pressable onPress={() => Linking.openURL(video.watchUrl)} style={styles.externalButton}><Text style={styles.externalButtonText}>Watch on YouTube</Text></Pressable></View>) : <View style={styles.card}><Text style={styles.cardTitle}>{configured ? 'No videos are available yet' : 'YouTube videos are not configured yet'}</Text><Text style={styles.body}>Ask the administrator to configure the verified Ahavat Shalom channel or playlist. No placeholder classes are shown.</Text></View>}
    <View style={styles.card}><Text style={styles.cardTitle}>More Classes by Rabbi Yitzchak Bakhshi</Text><Text style={styles.body}>Explore additional classes on YouTube through the Ahavat Shalom account. Kol Halashon content remains external until an official supported integration is available.</Text><View style={styles.actions}><Pressable onPress={() => Linking.openURL(ahavatShalomYouTubeUrl)} style={styles.externalButton}><Text style={styles.externalButtonText}>Ahavat Shalom on YouTube</Text></Pressable><Pressable onPress={() => Linking.openURL(kolHalashonUrl)} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>Open Kol Halashon</Text></Pressable></View></View>
  </ScrollView>;
}

const styles = StyleSheet.create({
  page: { backgroundColor: '#f7fbfd', flexGrow: 1, gap: 18, padding: 28 },
  hero: { backgroundColor: '#eaf5fb', borderColor: '#cfe6f2', borderRadius: 16, borderWidth: 1, maxWidth: 820, padding: 32 },
  card: { backgroundColor: '#fff', borderColor: '#d9e7ef', borderRadius: 16, borderWidth: 1, maxWidth: 820, padding: 24 },
  eyebrow: { color: '#147d89', fontSize: 12, fontWeight: '800', letterSpacing: 1.4 },
  title: { color: '#102a43', fontSize: 38, fontWeight: '800', marginTop: 12 },
  cardTitle: { color: '#123b63', fontSize: 22, fontWeight: '800', marginTop: 16 },
  body: { color: '#486581', fontSize: 16, lineHeight: 25, marginTop: 14 },
  meta: { color: '#147d89', fontSize: 13, marginTop: 7 },
  error: { color: '#b42318', fontSize: 15 },
  embedWrap: { aspectRatio: 16 / 9, backgroundColor: '#102a43', overflow: 'hidden', width: '100%' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 18 },
  externalButton: { alignSelf: 'flex-start', backgroundColor: '#123b63', borderRadius: 8, marginTop: 18, paddingHorizontal: 18, paddingVertical: 13 },
  externalButtonText: { color: '#fff', fontWeight: '800' },
  secondaryButton: { alignSelf: 'flex-start', backgroundColor: '#fff', borderColor: '#b8d7e6', borderRadius: 8, borderWidth: 1, marginTop: 18, paddingHorizontal: 18, paddingVertical: 13 },
  secondaryButtonText: { color: '#123b63', fontWeight: '800' },
});
