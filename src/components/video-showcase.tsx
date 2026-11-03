import { Image } from 'expo-image';
import React, { useEffect, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

export type ShowcaseVideo = {
  id: string;
  title: string;
  description?: string;
  publishedAt?: string | null;
  channelTitle?: string;
  thumbnailUrl?: string | null;
  embedUrl: string;
  sourceLabel?: string;
};

function YouTubePlayer({ video }: { video: ShowcaseVideo }) {
  if (Platform.OS !== 'web') {
    return <View style={styles.playerUnavailable}><Text style={styles.playerUnavailableText}>Video playback is available in the web player.</Text></View>;
  }
  return <View style={styles.playerFrame}>{React.createElement('iframe', {
    src: `${video.embedUrl}?autoplay=1&rel=0`,
    title: video.title,
    allow: 'autoplay; encrypted-media; picture-in-picture',
    allowFullScreen: true,
    style: { border: 0, height: '100%', width: '100%' },
  })}</View>;
}

export function VideoModal({ video, onClose }: { video: ShowcaseVideo | null; onClose: () => void }) {
  return <Modal animationType="fade" onRequestClose={onClose} transparent visible={Boolean(video)}>
    <View style={styles.modalBackdrop}>
      <Pressable accessibilityLabel="Close video player" onPress={onClose} style={styles.modalDismiss} />
      {video && <View accessibilityViewIsModal style={styles.modalCard}>
        <View style={styles.modalHeader}>
          <Text numberOfLines={1} style={styles.modalTitle}>{video.title}</Text>
          <Pressable accessibilityLabel="Close video player" onPress={onClose} style={styles.closeButton}><Text style={styles.closeText}>×</Text></Pressable>
        </View>
        <YouTubePlayer video={video} />
        {video.description ? <Text numberOfLines={3} style={styles.modalDescription}>{video.description}</Text> : null}
      </View>}
    </View>
  </Modal>;
}

export function VideoCard({ video, onPlay }: { video: ShowcaseVideo; onPlay: () => void }) {
  const [hovered, setHovered] = useState(false);
  return <Pressable accessibilityLabel={`Play ${video.title}`} onHoverIn={() => setHovered(true)} onHoverOut={() => setHovered(false)} onPress={onPlay} style={[styles.card, hovered && styles.cardHovered, hovered && styles.cardHoverState]}>
    <View style={styles.thumbnailWrap}>
      {video.thumbnailUrl ? <Image contentFit="cover" source={{ uri: video.thumbnailUrl }} style={styles.thumbnail} /> : <View style={[styles.thumbnail, styles.fallback]}><Text style={styles.fallbackText}>TORAT TSION</Text></View>}
      <View style={[styles.thumbnailShade, hovered && styles.thumbnailShadeVisible]} />
      <View style={styles.playOverlay}><Text style={styles.playIcon}>▶</Text></View>
    </View>
    <Text numberOfLines={2} style={styles.title}>{video.title}</Text>
    {video.sourceLabel ? <Text numberOfLines={1} style={styles.subtitle}>{video.sourceLabel}</Text> : null}
  </Pressable>;
}

export function VideoShelf({ title, videos, onPlay }: { title: string; videos: ShowcaseVideo[]; onPlay: (video: ShowcaseVideo) => void }) {
  if (!videos.length) return null;
  return <View style={styles.shelfSection}>
    <Text numberOfLines={1} style={styles.shelfTitle}>{title}</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.track}>
      {videos.map((video) => <VideoCard key={video.id} onPlay={() => onPlay(video)} video={video} />)}
    </ScrollView>
  </View>;
}

export function VideoShowcase({ title, videos, initialVideoId }: { title: string; videos: ShowcaseVideo[]; initialVideoId?: string }) {
  const [selectedVideo, setSelectedVideo] = useState<ShowcaseVideo | null>(null);
  useEffect(() => {
    if (initialVideoId) setSelectedVideo(videos.find((video) => video.id === initialVideoId) || null);
  }, [initialVideoId, videos]);
  return <>
    <VideoShelf onPlay={setSelectedVideo} title={title} videos={videos} />
    <VideoModal onClose={() => setSelectedVideo(null)} video={selectedVideo} />
  </>;
}

const styles = StyleSheet.create({
  shelfSection: { marginBottom: 28, minWidth: 0 },
  shelfTitle: { color: '#111827', fontSize: 20, fontWeight: '800', marginBottom: 14, maxWidth: '100%' },
  track: { gap: 14, paddingBottom: 8, paddingRight: 20 },
  card: { backgroundColor: '#ffffff', borderRadius: 12, maxWidth: 250, overflow: 'hidden', paddingBottom: 10, width: 236 },
  cardHovered: { shadowColor: '#0f172a', shadowOpacity: 0.16, shadowRadius: 14, transform: [{ scale: 1.015 }] },
  cardHoverState: { backgroundColor: '#f8fafc' },
  thumbnailWrap: { aspectRatio: 16 / 9, backgroundColor: '#dce6ef', overflow: 'hidden', position: 'relative', width: '100%' },
  thumbnail: { height: '100%', width: '100%' },
  thumbnailShade: { backgroundColor: '#000000', bottom: 0, left: 0, opacity: 0, position: 'absolute', right: 0, top: 0 },
  thumbnailShadeVisible: { opacity: 0.16 },
  playOverlay: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.82)', borderRadius: 999, height: 48, justifyContent: 'center', left: '50%', opacity: 0.88, position: 'absolute', top: '50%', transform: [{ translateX: -24 }, { translateY: -24 }], width: 48 },
  playIcon: { color: '#0052CC', fontSize: 17, marginLeft: 2 },
  fallback: { alignItems: 'center', justifyContent: 'center' },
  fallbackText: { color: '#356078', fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  title: { color: '#111827', fontSize: 14, fontWeight: '800', lineHeight: 19, marginHorizontal: 12, marginTop: 10 },
  subtitle: { color: '#64748b', fontSize: 11, marginHorizontal: 12, marginTop: 5 },
  modalBackdrop: { alignItems: 'center', backgroundColor: 'rgba(15,23,42,0.72)', flex: 1, justifyContent: 'center', padding: 18 },
  modalDismiss: StyleSheet.absoluteFill,
  modalCard: { backgroundColor: '#ffffff', borderRadius: 16, maxWidth: 860, overflow: 'hidden', padding: 16, width: '100%' },
  modalHeader: { alignItems: 'center', flexDirection: 'row', gap: 12, justifyContent: 'space-between', marginBottom: 12 },
  modalTitle: { color: '#111827', flex: 1, fontSize: 17, fontWeight: '800' },
  closeButton: { alignItems: 'center', borderRadius: 999, height: 36, justifyContent: 'center', width: 36 },
  closeText: { color: '#334155', fontSize: 28, fontWeight: '300', lineHeight: 30 },
  playerFrame: { aspectRatio: 16 / 9, backgroundColor: '#000000', overflow: 'hidden', width: '100%' },
  playerUnavailable: { alignItems: 'center', aspectRatio: 16 / 9, backgroundColor: '#0f172a', justifyContent: 'center', padding: 24 },
  playerUnavailableText: { color: '#ffffff', textAlign: 'center' },
  modalDescription: { color: '#64748b', fontSize: 13, lineHeight: 19, marginTop: 12 },
});
