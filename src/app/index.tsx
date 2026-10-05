import { type AudioSource } from 'expo-audio';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCallback, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { useListener } from '@/components/listener-provider';
import { PublicHome } from '@/components/public-site';
import { SeekBar } from '@/components/seek-bar';
import { apiUrl } from '@/lib/api';
import { normalizeRecordingTitle } from '@/lib/recording-title';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';

type Shiur = {
  id: string;
  title: string;
  speaker: string;
  category: string;
  date: string;
  source: AudioSource;
  coverUrl: string | null;
  coverAsset: number;
  shiurStartSeconds?: number | null;
  shiurSkipEnabled?: boolean;
};

type DriveShiur = {
  id: string;
  name: string;
  mimeType: string;
  size: number | null;
  recordedDateLabel?: string | null;
  streamUrl: string;
  title?: string;
  rabbiName?: string;
  speaker?: string;
  description?: string;
  category?: string;
  featured?: boolean;
  new?: boolean;
  playCount?: number;
  shiurStartSeconds?: number | null;
  shiurSkipEnabled?: boolean;
};

type HomePayload = {
  recordings?: DriveShiur[];
  rabbis?: Array<{ id: string; name: string; description?: string; photoUrl?: string | null; featured?: boolean }>;
  categories?: Array<{ name: string }>;
  featuredShiurim?: DriveShiur[];
  newThisWeek?: DriveShiur[];
  trending?: DriveShiur[];
};

type CoverAssignment = {
  coverUrl: string;
  updatedAt: string;
};

const defaultCategories = ['All'];
const fallbackCover = require('@/assets/shiur-covers/fallback.png');
const toratTsionLogo = require('@/assets/images/icon.png');
function displayCategory(filename: string) {
  const lowerName = filename.toLowerCase();
  return defaultCategories.slice(1).find((category) => lowerName.includes(category.toLowerCase())) ?? 'Torah';
}

function toShiur(recording: DriveShiur, covers: Record<string, CoverAssignment>): Shiur {
  const category = recording.category || displayCategory(recording.name);
  const assignment = covers[recording.id];

  return {
    id: recording.id,
    title: normalizeRecordingTitle(recording.title || recording.name, recording.recordedDateLabel || ''),
    speaker: recording.rabbiName || recording.speaker || 'Torat Tsion',
    category,
    date: '',
    source: apiUrl(recording.streamUrl),
    coverUrl: assignment?.coverUrl ?? null,
    coverAsset: fallbackCover,
    shiurStartSeconds: recording.shiurStartSeconds ?? null,
    shiurSkipEnabled: recording.shiurSkipEnabled ?? false,
  };
}

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
}

function DefaultCover({ style }: { style?: object }) {
  return <View style={[styles.defaultCover, style]}><Image contentFit="contain" source={toratTsionLogo} style={styles.defaultCoverLogo} /><Text style={styles.defaultCoverBrand}>Torat Tsion</Text><Text style={styles.defaultCoverType}>SHIURIM</Text></View>;
}

function Artwork({ shiur, source, large = false, wide = false, onError }: { shiur: Shiur; source: number | { uri: string }; large?: boolean; wide?: boolean; onError?: () => void }) {
  return (
    <View style={[styles.artwork, large && styles.artworkLarge, wide && styles.artworkWide]}>
      {source === fallbackCover ? <DefaultCover style={StyleSheet.absoluteFill} /> : <Image contentFit="cover" onError={onError} source={source} style={StyleSheet.absoluteFill} />}
      <View style={styles.artworkShade} />
    </View>
  );
}

export default function HomeScreen() {
  if (Platform.OS === 'web') return <PublicHome />;
  const router = useRouter();
  const { player, status, activeRecording, favorites: favoriteIds, positions, isFavorite, toggleFavorite, play, playAll, seekTo } = useListener();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [shiurim, setShiurim] = useState<Shiur[]>([]);
  const [categoryNames, setCategoryNames] = useState(defaultCategories);
  const [featuredIds, setFeaturedIds] = useState<string[]>([]);
  const [newIds, setNewIds] = useState<string[]>([]);
  const [trendingIds, setTrendingIds] = useState<string[]>([]);
  const [featuredRabbis, setFeaturedRabbis] = useState<HomePayload['rabbis']>([]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [failedCoverIds, setFailedCoverIds] = useState<string[]>([]);

  const loadShiurim = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const [homeResponse, coversResponse] = await Promise.all([fetch(apiUrl('/api/home')), fetch(apiUrl('/api/covers'))]);
      const payload = (await homeResponse.json()) as HomePayload & { error?: string };
      const coverPayload = (await coversResponse.json()) as Record<string, CoverAssignment>;
      if (!homeResponse.ok) {
        const fallbackResponse = await fetch(apiUrl('/api/recordings'));
        const fallbackPayload = (await fallbackResponse.json()) as { recordings?: DriveShiur[]; error?: string };
        if (!fallbackResponse.ok) throw new Error(fallbackPayload.error ?? payload.error ?? 'Unable to load shiurim');
        setShiurim((fallbackPayload.recordings ?? []).map((recording) => toShiur(recording, coversResponse.ok ? coverPayload : {})));
        return;
      }
      setShiurim((payload.recordings ?? []).map((recording) => toShiur(recording, coversResponse.ok ? coverPayload : {})));
      setCategoryNames(['All', ...(payload.categories ?? []).map((item) => item.name).filter(Boolean)]);
      setFeaturedIds((payload.featuredShiurim ?? []).map((recording) => recording.id));
      setNewIds((payload.newThisWeek ?? []).map((recording) => recording.id));
      setTrendingIds((payload.trending ?? []).map((recording) => recording.id));
      setFeaturedRabbis((payload.rabbis ?? []).filter((rabbi) => rabbi.featured));
      setFailedCoverIds([]);
    } catch {
      setErrorMessage('Shiurim could not be loaded right now.');
    } finally {
      setIsLoading(false);
    }
  };

  useFocusEffect(useCallback(() => {
    loadShiurim();
  }, []));

  const filteredShiurim = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return shiurim.filter((shiur) => {
      const matchesCategory = category === 'All' || shiur.category === category;
      const matchesQuery = !normalizedQuery || `${shiur.title} ${shiur.speaker} ${shiur.category}`.toLowerCase().includes(normalizedQuery);
      return matchesCategory && matchesQuery;
    });
  }, [category, query, shiurim]);

  const byIds = (ids: string[]) => ids.map((id) => shiurim.find((shiur) => shiur.id === id)).filter((shiur): shiur is Shiur => Boolean(shiur));
  const featured = byIds(featuredIds)[0];
  const recent = byIds(newIds).slice(0, 4);
  const trending = byIds(trendingIds).slice(0, 8);
  const favorites = favoriteIds
    .map((id) => shiurim.find((shiur) => shiur.id === id))
    .filter((shiur): shiur is Shiur => Boolean(shiur));
  const recentlyPlayed = Object.keys(positions)
    .sort((a, b) => positions[b] - positions[a])
    .map((id) => shiurim.find((shiur) => shiur.id === id))
    .filter((shiur): shiur is Shiur => Boolean(shiur));
  const activeShiur = shiurim.find((shiur) => shiur.id === activeRecording?.id) ?? null;
  const isWide = width >= 760;

  const coverSource = (shiur: Shiur): number | { uri: string } => {
    if (!shiur.coverUrl || failedCoverIds.includes(shiur.id)) return shiur.coverAsset;
    const coverUrl = apiUrl(shiur.coverUrl);
    return { uri: `${coverUrl}${coverUrl.includes('?') ? '&' : '?'}v=${encodeURIComponent(shiur.coverUrl)}` };
  };

  const markCoverFailed = (shiurId: string) => setFailedCoverIds((current) => current.includes(shiurId) ? current : [...current, shiurId]);

  const togglePlayback = (shiur: Shiur) => {
    play(shiur, filteredShiurim);
  };

  const renderPlayButton = (shiur: Shiur, light = false) => {
    const isActive = activeRecording?.id === shiur.id;
    return (
      <Pressable
        accessibilityLabel={isActive && status.playing ? `Pause ${shiur.title}` : `Play ${shiur.title}`}
        onPress={() => togglePlayback(shiur)}
        style={({ pressed }) => [styles.playButton, light && styles.playButtonLight, pressed && styles.pressed]}>
        <Text style={[styles.playIcon, light && styles.playIconLight]}>{isActive && status.playing ? 'Ⅱ' : '▶'}</Text>
      </Pressable>
    );
  };

  const renderFavoriteButton = (shiur: Shiur) => {
    const favorite = isFavorite(shiur.id);
    return (
      <Pressable
        accessibilityLabel={favorite ? `Remove ${shiur.title} from favorites` : `Add ${shiur.title} to favorites`}
        onPress={() => toggleFavorite(shiur.id)}
        style={({ pressed }) => [styles.favoriteButton, pressed && styles.pressed]}>
        <Text style={[styles.favoriteIcon, favorite && styles.favoriteIconActive]}>{favorite ? '★' : '☆'}</Text>
      </Pressable>
    );
  };
  const renderSkipButton = (shiur: Shiur) => {
    const skipSeconds = shiur.shiurSkipEnabled === false || !Number.isFinite(Number(shiur.shiurStartSeconds)) || Number(shiur.shiurStartSeconds) <= 0 ? null : Number(shiur.shiurStartSeconds);
    if (skipSeconds === null) return null;
    const active = activeRecording?.id === shiur.id;
    return <Pressable accessibilityLabel={`Skip to Shiur at ${formatTime(skipSeconds)}`} onPress={() => { if (active) { seekTo(skipSeconds); if (!status.playing) player.play(); } else play(shiur, filteredShiurim, skipSeconds); }} style={({ pressed }) => [styles.skipButton, pressed && styles.pressed]}><Text style={styles.skipText}>Skip to Shiur</Text></Pressable>;
  };

  const renderShelf = (items: Shiur[]) => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cardRow}>
      {items.map((shiur) => (
        <View key={shiur.id} style={styles.shiurCard}>
          <View>
            <Artwork shiur={shiur} source={coverSource(shiur)} onError={() => markCoverFailed(shiur.id)} />
            <View style={styles.cardFavorite}>{renderFavoriteButton(shiur)}</View>
          </View>
          <Text style={styles.cardCategory}>{shiur.category}</Text>
          <Text style={styles.cardTitle} numberOfLines={4}>{shiur.title}</Text>
          <Text style={styles.cardSpeaker}>{shiur.speaker}</Text>
          <View style={styles.cardFooter}>
            {shiur.date ? <Text style={styles.cardDate}>{shiur.date}</Text> : null}
            {renderSkipButton(shiur)}
            {renderPlayButton(shiur)}
          </View>
        </View>
      ))}
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={[styles.container, { paddingBottom: 190 + insets.bottom }]} showsVerticalScrollIndicator={false}>
        <View style={[styles.content, isWide && styles.contentWide]}>
          <View style={styles.header}>
            <View style={styles.brandLockup}>
              <Image contentFit="contain" source={toratTsionLogo} style={styles.headerLogo} />
              <View><Text style={styles.brand}>Torat Tsion</Text><Text style={styles.brandSub}>A home for Torah listening</Text></View>
            </View>
            <Pressable accessibilityLabel="Open admin dashboard" onPress={() => router.push('/admin' as never)} style={({ pressed }) => [styles.headerActionButton, pressed && styles.pressed]}><Text style={styles.headerAction}>ADMIN</Text></Pressable>
          </View>

          <View style={styles.searchBox}>
            <Text style={styles.searchIcon}>⌕</Text>
            <TextInput
              accessibilityLabel="Search shiurim"
              onChangeText={setQuery}
              placeholder="Search shiurim, speakers, topics"
              placeholderTextColor="#89909A"
              style={styles.searchInput}
              value={query}
            />
            {query.length > 0 && <Pressable accessibilityLabel="Clear search" onPress={() => setQuery('')} style={styles.clearSearch}><Text style={styles.clearSearchText}>×</Text></Pressable>}
          </View>

          {isLoading ? (
            <View style={styles.statePanel}><ActivityIndicator color="#2d6cdf" size="large" /><Text style={styles.stateTitle}>Preparing your shiurim</Text><Text style={styles.stateText}>Your library is on its way.</Text></View>
          ) : errorMessage ? (
            <View style={styles.statePanel}><Text style={styles.stateEyebrow}>TEMPORARILY UNAVAILABLE</Text><Text style={styles.stateTitle}>We could not reach the library</Text><Text style={styles.stateText}>{errorMessage}</Text><Pressable onPress={loadShiurim} style={styles.retryButton}><Text style={styles.retryText}>Try again</Text></Pressable></View>
          ) : shiurim.length === 0 ? (
            <View style={styles.statePanel}><Text style={styles.stateEyebrow}>YOUR LIBRARY</Text><Text style={styles.stateTitle}>No shiurim yet</Text><Text style={styles.stateText}>New shiurim will appear here when they are added.</Text></View>
          ) : (
            <>
              {featured && (
                <View style={styles.featureSection}>
                  <Text style={styles.sectionKicker}>FEATURED SHIURIM</Text>
                  <View style={[styles.featureCard, isWide && styles.featureCardWide]}>
                    <Artwork large shiur={featured} source={coverSource(featured)} wide={isWide} onError={() => markCoverFailed(featured.id)} />
                    <View style={styles.featureInfo}>
                      <View style={styles.featureLabelRow}>
                        <Text style={styles.featureCategory}>{featured.category.toUpperCase()}</Text>
                        {renderFavoriteButton(featured)}
                      </View>
                      <Text style={styles.featureTitle} numberOfLines={5}>{featured.title}</Text>
                      <Text style={styles.featureMeta}>{featured.speaker}</Text>
                      {renderPlayButton(featured, true)}
                    </View>
                  </View>
                </View>
              )}

              {featuredRabbis && featuredRabbis.length > 0 && <><View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Featured Rabbis</Text><Text style={styles.sectionCount}>{featuredRabbis.length}</Text></View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cardRow}>{featuredRabbis.map((rabbi) => <Pressable key={rabbi.id} onPress={() => router.push(`/rabbis/${rabbi.id}` as never)} style={styles.rabbiCard}>{rabbi.photoUrl ? <Image contentFit="cover" source={{ uri: apiUrl(rabbi.photoUrl) }} style={styles.rabbiPhoto} /> : <View style={[styles.rabbiPhoto, styles.rabbiFallback]}><Text style={styles.rabbiInitials}>{rabbi.name.slice(0, 2).toUpperCase()}</Text></View>}<Text style={styles.rabbiName} numberOfLines={1}>{rabbi.name}</Text><Text style={styles.rabbiDescription} numberOfLines={2}>{rabbi.description || 'Explore this Rabbi\'s shiurim'}</Text></Pressable>)}</ScrollView></>}

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
                {categoryNames.map((item) => (
                  <Pressable key={item} onPress={() => setCategory(item)} style={[styles.category, category === item && styles.categoryActive]}>
                    <Text style={[styles.categoryText, category === item && styles.categoryTextActive]}>{item}</Text>
                  </Pressable>
                ))}
              </ScrollView>

              <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Favorites</Text><Text style={styles.sectionCount}>{favorites.length}</Text></View>
              {favorites.length > 0 ? renderShelf(favorites) : <View style={styles.emptyShelf}><Text style={styles.emptyShelfTitle}>Your saved shiurim</Text><Text style={styles.emptyShelfText}>Tap the star on any shiur to keep it close.</Text></View>}

              {recentlyPlayed.length > 0 && <><View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Continue Listening</Text><Text style={styles.sectionCount}>{recentlyPlayed.length}</Text></View>{renderShelf(recentlyPlayed)}</>}

              {recent.length > 0 && <><View style={styles.sectionHeader}><Text style={styles.sectionTitle}>New This Week</Text><Text style={styles.sectionCount}>{recent.length}</Text></View>{renderShelf(recent)}</>}

              {trending.length > 0 && <><View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Trending</Text><Text style={styles.sectionCount}>{trending.length}</Text></View>{renderShelf(trending)}</>}

              <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>All Shiurim</Text><View style={styles.sectionActions}><Text style={styles.sectionCount}>{filteredShiurim.length}</Text><Pressable onPress={() => playAll(filteredShiurim)} style={styles.playAll}><Text style={styles.playAllText}>Play All</Text></Pressable></View></View>
              <View style={styles.allList}>
                {filteredShiurim.map((shiur, index) => <View key={shiur.id} style={styles.listItem}><Text style={styles.listNumber}>{String(index + 1).padStart(2, '0')}</Text><Artwork shiur={shiur} source={coverSource(shiur)} onError={() => markCoverFailed(shiur.id)} /><View style={styles.listInfo}><Text style={styles.cardTitle} numberOfLines={2}>{shiur.title}</Text><Text style={styles.cardSpeaker}>{shiur.speaker}  ·  {shiur.category}</Text></View>{renderFavoriteButton(shiur)}{renderPlayButton(shiur)}</View>)}
                {filteredShiurim.length === 0 && <Text style={styles.noResults}>No shiurim match your search.</Text>}
              </View>
            </>
          )}
        </View>
      </ScrollView>

      {activeRecording && (
        <View style={[styles.nowPlaying, { paddingBottom: insets.bottom + 10 }]}>
          <View style={styles.nowPlayingTop}><View style={styles.nowPlayingIdentity}><View style={styles.miniArtwork}>{activeShiur && coverSource(activeShiur) === fallbackCover ? <DefaultCover style={StyleSheet.absoluteFill} /> : <Image contentFit="cover" onError={() => activeShiur && markCoverFailed(activeShiur.id)} source={activeShiur ? coverSource(activeShiur) : fallbackCover} style={StyleSheet.absoluteFill} />}<View style={styles.miniArtworkShade} /></View><View style={styles.nowPlayingText}><Text style={styles.nowPlayingLabel}>NOW PLAYING</Text><Text style={styles.nowPlayingTitle} numberOfLines={1}>{activeShiur?.title}</Text></View></View>{activeShiur && renderPlayButton(activeShiur, true)}</View>
          <SeekBar currentTime={status.currentTime} duration={status.duration} onSeek={(seconds) => void seekTo(seconds)} style={styles.progressTrack} />
          <View style={styles.timeRow}><Text style={styles.timeText}>{formatTime(status.currentTime)}</Text><Text style={styles.timeText}>{formatTime(status.duration)}</Text></View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#101317' },
  container: { paddingBottom: 184 },
  content: { maxWidth: 1120, paddingHorizontal: 20, paddingTop: 20, width: '100%', alignSelf: 'center' },
  contentWide: { paddingHorizontal: 40, paddingTop: 28 },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  brandLockup: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  headerLogo: { height: 50, width: 50 },
  brandMark: { alignItems: 'center', backgroundColor: '#2d6cdf', borderRadius: 8, height: 42, justifyContent: 'center', marginRight: 11, width: 42 },
  brandMarkText: { color: '#101317', fontSize: 13, fontWeight: '800', letterSpacing: 1 },
  brand: { color: '#F2EEE7', fontSize: 19, fontWeight: '700' },
  brandSub: { color: '#89909A', fontSize: 11, marginTop: 3 },
  headerActionButton: { alignItems: 'center', minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 },
  headerAction: { color: '#2d6cdf', fontSize: 11, fontWeight: '800', letterSpacing: 1.4 },
  searchBox: { alignItems: 'center', backgroundColor: '#1B2026', borderColor: '#2B323A', borderRadius: 10, borderWidth: 1, flexDirection: 'row', height: 50, marginTop: 27, paddingHorizontal: 15 },
  searchIcon: { color: '#2d6cdf', fontSize: 26, lineHeight: 26, marginRight: 10 },
  searchInput: { color: '#F2EEE7', flex: 1, fontSize: 14 },
  clearSearch: { alignItems: 'center', height: 44, justifyContent: 'center', width: 44 },
  clearSearchText: { color: '#A7ADB5', fontSize: 25, lineHeight: 25 },
  categoryRow: { gap: 9, paddingVertical: 20 },
  category: { borderColor: '#303740', borderRadius: 20, borderWidth: 1, paddingHorizontal: 15, paddingVertical: 9 },
  categoryActive: { backgroundColor: '#2d6cdf', borderColor: '#2d6cdf' },
  categoryText: { color: '#9AA1AA', fontSize: 12, fontWeight: '600' },
  categoryTextActive: { color: '#101317' },
  featureSection: { marginTop: 12 },
  sectionKicker: { color: '#2d6cdf', fontSize: 11, fontWeight: '800', letterSpacing: 1.7, marginBottom: 12 },
  featureCard: { backgroundColor: '#20262D', borderColor: '#303841', borderRadius: 16, borderWidth: 1, elevation: 5, overflow: 'hidden', shadowColor: '#000', shadowOffset: { height: 4, width: 0 }, shadowOpacity: 0.22, shadowRadius: 12 },
  featureCardWide: { flexDirection: 'row' },
  artwork: { alignItems: 'center', aspectRatio: 1, backgroundColor: '#536D7A', justifyContent: 'center', overflow: 'hidden', width: 112 },
  defaultCover: { alignItems: 'center', backgroundColor: '#26343A', justifyContent: 'center' },
  defaultCoverLogo: { height: 78, width: 78 },
  defaultCoverBrand: { color: '#F2EEE7', fontSize: 10, fontWeight: '700', marginTop: 8 },
  defaultCoverType: { color: '#9FB3AE', fontSize: 7, fontWeight: '800', letterSpacing: 2, marginTop: 5 },
  artworkLarge: { aspectRatio: 1.35, width: '100%' },
  artworkWide: { width: 330 },
  artworkMark: { color: 'rgba(255,255,255,0.86)', fontSize: 25, fontWeight: '800', letterSpacing: 2 },
  artworkMarkLarge: { fontSize: 52 },
  artworkShade: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.18)' },
  artworkCaption: { bottom: 10, color: 'rgba(255,255,255,0.7)', fontSize: 7, fontWeight: '700', letterSpacing: 1, position: 'absolute' },
  featureInfo: { flex: 1, justifyContent: 'center', padding: 22 },
  featureLabelRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  featureCategory: { color: '#2d6cdf', fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  featureTitle: { color: '#F2EEE7', fontSize: 24, fontWeight: '700', lineHeight: 30, marginTop: 10 },
  featureMeta: { color: '#A7ADB5', fontSize: 12, marginTop: 10 },
  playButton: { alignItems: 'center', backgroundColor: '#2d6cdf', borderRadius: 22, elevation: 2, height: 44, justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 4, width: 44 },
  playButtonLight: { backgroundColor: '#F2EEE7', marginTop: 20 },
  playIcon: { color: '#101317', fontSize: 12, fontWeight: '800' },
  playIconLight: { color: '#101317' },
  pressed: { opacity: 0.7 },
  sectionHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginTop: 32 },
  sectionTitle: { color: '#F2EEE7', fontSize: 20, fontWeight: '700' },
  sectionCount: { color: '#79818B', fontSize: 12 },
  cardRow: { gap: 14, paddingTop: 16 },
  shiurCard: { backgroundColor: '#1B2026', borderColor: '#2A3139', borderRadius: 12, borderWidth: 1, padding: 10, width: 182 },
  cardFavorite: { position: 'absolute', right: 6, top: 6 },
  favoriteButton: { alignItems: 'center', height: 44, justifyContent: 'center', width: 44 },
  favoriteIcon: { color: '#2d6cdf', fontSize: 22, lineHeight: 24 },
  favoriteIconActive: { color: '#2d6cdf' },
  cardCategory: { color: '#2d6cdf', fontSize: 10, fontWeight: '800', letterSpacing: 1, marginTop: 12 },
  cardTitle: { color: '#F2EEE7', fontSize: 14, fontWeight: '600', lineHeight: 19, marginTop: 5 },
  cardSpeaker: { color: '#8D959F', fontSize: 11, marginTop: 5 },
  cardFooter: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginTop: 11 },
  cardDate: { color: '#69717B', fontSize: 10 },
  skipButton: { backgroundColor: '#edf5ff', borderColor: '#bfd4ff', borderRadius: 999, borderWidth: 1, marginLeft: 'auto', marginRight: 8, paddingHorizontal: 8, paddingVertical: 6 },
  skipText: { color: '#1d4ea8', fontSize: 9, fontWeight: '800' },
  cardFooterPlay: { marginTop: 0 },
  allList: { marginTop: 14 },
  emptyShelf: { backgroundColor: '#171C21', borderColor: '#283039', borderRadius: 10, borderWidth: 1, marginTop: 14, paddingHorizontal: 18, paddingVertical: 20 },
  emptyShelfTitle: { color: '#F2EEE7', fontSize: 14, fontWeight: '600' },
  emptyShelfText: { color: '#89909A', fontSize: 12, marginTop: 5 },
  listItem: { alignItems: 'center', backgroundColor: '#171C21', borderColor: '#283039', borderRadius: 10, borderWidth: 1, flexDirection: 'row', minHeight: 84, marginBottom: 8, paddingHorizontal: 10, paddingVertical: 10 },
  listNumber: { color: '#626B75', fontSize: 11, width: 28 },
  listInfo: { flex: 1, marginHorizontal: 13 },
  statePanel: { alignItems: 'center', backgroundColor: '#1B2026', borderRadius: 14, justifyContent: 'center', marginTop: 12, minHeight: 280, padding: 30 },
  stateEyebrow: { color: '#2d6cdf', fontSize: 10, fontWeight: '800', letterSpacing: 1.4 },
  stateTitle: { color: '#F2EEE7', fontSize: 18, fontWeight: '700', marginTop: 14, textAlign: 'center' },
  stateText: { color: '#8D959F', fontSize: 13, lineHeight: 20, marginTop: 8, textAlign: 'center' },
  retryButton: { backgroundColor: '#2d6cdf', borderRadius: 6, marginTop: 18, paddingHorizontal: 18, paddingVertical: 10 },
  retryText: { color: '#101317', fontSize: 12, fontWeight: '800' },
  noResults: { color: '#89909A', paddingVertical: 30, textAlign: 'center' },
  rabbiCard: { backgroundColor: '#1B2026', borderColor: '#2A3139', borderRadius: 12, borderWidth: 1, marginRight: 14, padding: 10, width: 170 },
  rabbiPhoto: { backgroundColor: '#26343A', borderRadius: 8, height: 120, width: '100%' },
  rabbiFallback: { alignItems: 'center', justifyContent: 'center' },
  rabbiInitials: { color: '#2d6cdf', fontSize: 28, fontWeight: '800' },
  rabbiName: { color: '#F2EEE7', fontSize: 14, fontWeight: '700', marginTop: 10 },
  rabbiDescription: { color: '#89909A', fontSize: 11, lineHeight: 16, marginTop: 4 },
  sectionActions: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  playAll: { backgroundColor: '#2d6cdf', borderRadius: 6, paddingHorizontal: 9, paddingVertical: 6 },
  playAllText: { color: '#101317', fontSize: 10, fontWeight: '800' },
  nowPlaying: { backgroundColor: '#242B32', borderTopColor: '#3A424B', borderTopWidth: 1, bottom: 0, elevation: 10, left: 0, paddingBottom: 10, paddingHorizontal: 20, paddingTop: 12, position: 'absolute', right: 0, shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 10 },
  nowPlayingTop: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  nowPlayingIdentity: { alignItems: 'center', flex: 1, flexDirection: 'row', marginRight: 12 },
  miniArtwork: { alignItems: 'center', backgroundColor: '#B76E4A', borderRadius: 5, height: 36, justifyContent: 'center', overflow: 'hidden', width: 36 },
  miniArtworkShade: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.2)' },
  miniArtworkText: { color: '#F2EEE7', fontSize: 10, fontWeight: '800' },
  nowPlayingText: { flex: 1, marginLeft: 10 },
  nowPlayingLabel: { color: '#2d6cdf', fontSize: 9, fontWeight: '800', letterSpacing: 1.2 },
  nowPlayingTitle: { color: '#F2EEE7', fontSize: 13, fontWeight: '600', marginTop: 3 },
  progressTrack: { backgroundColor: '#4B535C', borderRadius: 3, height: 4, marginTop: 12, overflow: 'hidden' },
  progressFill: { backgroundColor: '#2d6cdf', height: 4 },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', paddingBottom: 10, paddingTop: 5 },
  timeText: { color: '#89909A', fontSize: 10 },
});
