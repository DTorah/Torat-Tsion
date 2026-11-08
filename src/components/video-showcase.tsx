import { Image } from 'expo-image';
import React, { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { apiUrl } from '@/lib/api';

export type ShowcaseVideo = {
  id: string;
  title: string;
  description?: string;
  publishedAt?: string | null;
  durationSeconds?: number | null;
  channelTitle?: string;
  thumbnailUrl?: string | null;
  embedUrl: string;
  sourceLabel?: string;
};

type YouTubePlaybackContextValue = {
  activeVideo: ShowcaseVideo | null;
  playVideo: (video: ShowcaseVideo) => void;
  stopVideo: () => void;
};

const YouTubePlaybackContext = createContext<YouTubePlaybackContextValue | null>(null);

export function useYouTubePlayback() {
  const context = useContext(YouTubePlaybackContext);
  if (!context) throw new Error('useYouTubePlayback must be used inside YouTubePlaybackProvider');
  return context;
}

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

export function YouTubePlaybackProvider({ children }: { children: ReactNode }) {
  const [activeVideo, setActiveVideo] = useState<ShowcaseVideo | null>(null);
  const playVideo = (video: ShowcaseVideo) => {
    setActiveVideo(video);
    void fetch(apiUrl('/api/analytics/event'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'video_play', videoId: video.id, path: typeof window !== 'undefined' ? window.location.pathname : '' }) }).catch(() => {});
  };
  return <YouTubePlaybackContext.Provider value={{ activeVideo, playVideo, stopVideo: () => setActiveVideo(null) }}>
    {children}
    <GlobalYouTubePlayer />
  </YouTubePlaybackContext.Provider>;
}

export function InlineYouTubePlayer({ video }: { video: ShowcaseVideo }) {
  return <View style={styles.inlinePlayer}><Text style={styles.playerLoadingText}>Playing in the Torah Farsi player</Text><Text numberOfLines={1} style={styles.inlineTitle}>{video.title}</Text></View>;
}

export function VideoCard({ video, onPlay, playing = false }: { video: ShowcaseVideo; onPlay: () => void; playing?: boolean }) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  return <View style={[styles.card, (hovered || focused) && styles.cardHovered, (hovered || focused) && styles.cardHoverState]}>
    <View style={styles.thumbnailWrap}>
      {playing ? <Pressable accessibilityLabel={`Focus player for ${video.title}`} onPress={onPlay} style={styles.inlinePlayer}><Text style={styles.playerLoadingText}>Playing in the Torah Farsi player</Text><Text numberOfLines={1} style={styles.inlineTitle}>{video.title}</Text></Pressable> : <Pressable accessibilityLabel={`Play ${video.title}`} onBlur={() => setFocused(false)} onFocus={() => setFocused(true)} onHoverIn={() => setHovered(true)} onHoverOut={() => setHovered(false)} onPress={onPlay} style={styles.thumbnailButton}>
        {video.thumbnailUrl ? <Image contentFit="cover" source={{ uri: video.thumbnailUrl }} style={[styles.thumbnail, (hovered || focused) && styles.thumbnailZoom]} /> : <View style={[styles.thumbnail, styles.fallback, (hovered || focused) && styles.thumbnailZoom]}><Text style={styles.fallbackText}>TORAH FARSI</Text></View>}
        <View style={[styles.thumbnailShade, (hovered || focused) && styles.thumbnailShadeVisible]} />
        <View style={[styles.playOverlay, (hovered || focused) && styles.playOverlayVisible]}><Text style={styles.playIcon}>▶</Text></View>
      </Pressable>}
    </View>
    <Text numberOfLines={2} style={styles.title}>{video.title}</Text>
  </View>;
}

export function VideoShelf({ title, videos, onPlay, activeVideoId }: { title: string; videos: ShowcaseVideo[]; onPlay: (video: ShowcaseVideo) => void; activeVideoId?: string | null }) {
  if (!videos.length) return null;
  return <View style={styles.shelfSection}>
    <Text numberOfLines={1} style={styles.shelfTitle}>{title}</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.track}>
      {videos.map((video) => <VideoCard key={video.id} onPlay={() => onPlay(video)} playing={activeVideoId === video.id} video={video} />)}
    </ScrollView>
  </View>;
}

export function VideoShowcase({ title, videos, initialVideoId }: { title: string; videos: ShowcaseVideo[]; initialVideoId?: string }) {
  const { activeVideo, playVideo } = useYouTubePlayback();
  useEffect(() => {
    if (initialVideoId) {
      const requested = videos.find((video) => video.id === initialVideoId);
      if (requested) playVideo(requested);
    }
  }, [initialVideoId, videos, playVideo]);
  return <VideoShelf activeVideoId={activeVideo?.id} onPlay={playVideo} title={title} videos={videos} />;
}

function GlobalYouTubePlayer() {
  const { activeVideo, stopVideo } = useYouTubePlayback();
  const [expanded, setExpanded] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [focused, setFocused] = useState(false);
  const playerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!activeVideo) {
      setExpanded(false);
      setControlsVisible(true);
    }
  }, [activeVideo]);

  if (!activeVideo || Platform.OS !== 'web') return null;
  const enterFullscreen = () => {
    const element = playerRef.current as (HTMLElement & { webkitRequestFullscreen?: () => Promise<void> }) | null;
    if (element?.requestFullscreen) void element.requestFullscreen();
    else if (element?.webkitRequestFullscreen) void element.webkitRequestFullscreen();
  };
  const showControls = controlsVisible || focused;
  return <View style={[styles.globalPlayer, expanded && styles.globalPlayerExpanded]}>
    <View style={styles.globalHeader}>
      <Text numberOfLines={1} style={styles.globalTitle}>{activeVideo.title}</Text>
      <Pressable accessibilityLabel="Close video player" onPress={stopVideo} style={styles.globalClose}><Text style={styles.globalCloseText}>×</Text></Pressable>
    </View>
    <View ref={(node) => { playerRef.current = node as unknown as HTMLElement | null; }} onTouchEnd={() => setControlsVisible(true)} style={styles.globalVideo}>
      <View {...({ onMouseEnter: () => setControlsVisible(true), onMouseLeave: () => { if (!focused) setControlsVisible(false); } } as any)} onFocus={() => { setFocused(true); setControlsVisible(true); }} onBlur={() => setFocused(false)} style={StyleSheet.absoluteFill}>
        <YouTubePlayer video={activeVideo} />
      </View>
      <View pointerEvents={showControls ? 'auto' : 'none'} style={[styles.videoOverlayControls, !showControls && styles.videoOverlayHidden]}>
        <Pressable accessibilityLabel={expanded ? 'Reduce video player' : 'Expand video player area'} onPress={() => setExpanded((value) => !value)} style={styles.videoExpandButton}><Text style={styles.videoExpandIcon}>{expanded ? '↙' : '↗'}</Text></Pressable>
      </View>
    </View>
    <View style={styles.globalControls}>
      <Pressable accessibilityLabel="Full Screen" onPress={enterFullscreen} style={styles.fullscreenButton}><Text style={styles.fullscreenText}>Full Screen</Text></Pressable>
      <Pressable accessibilityLabel="Close video player" onPress={stopVideo} style={styles.controlClose}><Text style={styles.controlCloseText}>Close</Text></Pressable>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  shelfSection: { marginBottom: 28, minWidth: 0 },
  shelfTitle: { color: '#111827', fontSize: 20, fontWeight: '800', marginBottom: 14, maxWidth: '100%' },
  track: { gap: 14, paddingBottom: 8, paddingRight: 20 },
  card: { backgroundColor: '#ffffff', borderRadius: 12, maxWidth: 320, overflow: 'hidden', paddingBottom: 10, width: 300 },
  cardHovered: { shadowColor: '#0f172a', shadowOpacity: 0.16, shadowRadius: 14, transform: [{ scale: 1.015 }] },
  cardHoverState: { backgroundColor: '#f8fafc' },
  thumbnailWrap: { aspectRatio: 16 / 9, backgroundColor: '#dce6ef', overflow: 'hidden', position: 'relative', width: '100%' },
  thumbnailButton: { height: '100%', width: '100%' },
  thumbnail: { height: '100%', width: '100%' },
  thumbnailZoom: { transform: [{ scale: 1.04 }] },
  thumbnailShade: { backgroundColor: '#000000', bottom: 0, left: 0, opacity: 0, position: 'absolute', right: 0, top: 0 },
  thumbnailShadeVisible: { opacity: 0.16 },
  playOverlay: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.82)', borderRadius: 999, height: 48, justifyContent: 'center', left: '50%', opacity: 0, position: 'absolute', top: '50%', transform: [{ translateX: -24 }, { translateY: -24 }], width: 48 },
  playOverlayVisible: { opacity: 1 },
  playIcon: { color: '#8f111b', fontSize: 17, marginLeft: 2 },
  fallback: { alignItems: 'center', justifyContent: 'center' },
  fallbackText: { color: '#356078', fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  title: { color: '#111827', fontSize: 14, fontWeight: '800', lineHeight: 19, marginHorizontal: 12, marginTop: 10 },
  subtitle: { color: '#64748b', fontSize: 11, marginHorizontal: 12, marginTop: 5 },
  playerFrame: { aspectRatio: 16 / 9, backgroundColor: '#000000', overflow: 'hidden', width: '100%' },
  inlinePlayer: { alignItems: 'center', backgroundColor: '#0f172a', height: '100%', justifyContent: 'center', padding: 12, width: '100%' },
  inlineTitle: { color: '#cbd5e1', fontSize: 11, marginTop: 6, maxWidth: '90%' },
  playerLoadingText: { color: '#ffffff', fontSize: 12 },
  globalPlayer: { backgroundColor: '#0b1324', borderColor: '#30486b', borderRadius: 12, borderWidth: 1, bottom: 20, elevation: 12, maxWidth: 640, position: 'fixed' as any, right: 20, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 18, width: 420 as any, zIndex: 1000 },
  globalPlayerExpanded: { width: '92vw' as any },
  globalHeader: { alignItems: 'center', flexDirection: 'row', gap: 8, justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 9 },
  globalTitle: { color: '#f8fafc', flex: 1, fontSize: 12, fontWeight: '700' },
  globalClose: { alignItems: 'center', height: 28, justifyContent: 'center', width: 28 },
  globalCloseText: { color: '#dbeafe', fontSize: 22 },
  globalVideo: { aspectRatio: 16 / 9, backgroundColor: '#000', overflow: 'hidden', position: 'relative', width: '100%' },
  videoOverlayControls: { position: 'absolute', right: 8, top: 8 },
  videoOverlayHidden: { opacity: 0 },
  videoExpandButton: { alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.68)', borderRadius: 4, height: 30, justifyContent: 'center', width: 30 },
  videoExpandIcon: { color: '#fff', fontSize: 18 },
  globalControls: { alignItems: 'center', flexDirection: 'row', gap: 8, justifyContent: 'flex-end', padding: 8 },
  fullscreenButton: { borderColor: '#6f8db6', borderRadius: 6, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6 },
  fullscreenText: { color: '#e5efff', fontSize: 11, fontWeight: '700' },
  controlClose: { paddingHorizontal: 8, paddingVertical: 6 },
  controlCloseText: { color: '#b7c9e6', fontSize: 11 },
  playerError: { alignItems: 'center', backgroundColor: '#0f172a', bottom: 0, justifyContent: 'center', left: 0, padding: 14, position: 'absolute', right: 0, top: 0 },
  playerErrorTitle: { color: '#ffffff', fontSize: 12, fontWeight: '800', textAlign: 'center' },
  playerErrorText: { color: '#cbd5e1', fontSize: 11, marginTop: 5, textAlign: 'center' },
  playerLink: { borderColor: '#93c5fd', borderRadius: 7, borderWidth: 1, marginTop: 9, paddingHorizontal: 9, paddingVertical: 6 },
  playerLinkText: { color: '#bfdbfe', fontSize: 11, fontWeight: '700' },
  playerUnavailable: { alignItems: 'center', aspectRatio: 16 / 9, backgroundColor: '#0f172a', justifyContent: 'center', padding: 24 },
  playerUnavailableText: { color: '#ffffff', textAlign: 'center' },
  modalDescription: { color: '#64748b', fontSize: 13, lineHeight: 19, marginTop: 12 },
});
