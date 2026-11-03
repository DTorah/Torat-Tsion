import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { VideoModal, type ShowcaseVideo } from '@/components/video-showcase';
import { apiUrl } from '@/lib/api';

type Video = ShowcaseVideo & {
  description?: string;
  publishedAt?: string | null;
  channelTitle?: string;
};

type Source = { key: string; label: string; videos: Video[] };
type VideoPayload = { configured?: boolean; sources?: Source[]; error?: string };
type VideoGroup = { label: string; videos: Video[] };

const favoritesKey = 'torat-sion.youtube-favorites';
const parshiyot = ['Bereshit', 'Noach', 'Lech Lecha', 'Vayera', 'Chayei Sarah', 'Toldot', 'Vayetzei', 'Vayishlach', 'Vayeshev', 'Miketz', 'Vayigash', 'Vayechi', 'Shemot', 'Vaera', 'Bo', 'Beshalach', 'Yitro', 'Mishpatim', 'Terumah', 'Tetzaveh', 'Ki Tisa', 'Vayakhel', 'Pekudei', 'Vayikra', 'Tzav', 'Shemini', 'Tazria', 'Metzora', 'Acharei Mot', 'Kedoshim', 'Emor', 'Behar', 'Bechukotai', 'Bamidbar', 'Naso', 'Behaalotcha', 'Shelach', 'Korach', 'Chukat', 'Balak', 'Pinchas', 'Matot', 'Masei', 'Devarim', 'Vaetchanan', 'Eikev', 'Reeh', 'Shoftim', 'Ki Teitzei', 'Ki Tavo', 'Nitzavim', 'Vayeilech', 'Haazinu', 'Vezot Haberakhah'];
const topicMatchers: Array<[string, RegExp]> = [
  ['Halacha', /\b(halacha|halakhah|law)\b/i],
  ['Hashkafa', /\b(hashkafa|worldview|perspective)\b/i],
  ['Mussar', /\b(mussar|character|middot)\b/i],
  ['Emunah', /\b(emunah|faith|bitachon|trust)\b/i],
  ['Tefillah', /\b(tefillah|tefila|prayer)\b/i],
  ['Shabbat', /\b(shabbat|shabbos)\b/i],
  ['Holidays', /\b(holiday|pesach|purim|sukkot|chanukah|rosh hashanah|yom kippur)\b/i],
];

function metadata(video: Video) {
  return `${video.title} ${video.description || ''}`;
}

function findParsha(video: Video) {
  const text = metadata(video);
  return parshiyot.find((parsha) => new RegExp(`\\b${parsha.replace(' ', '[ -]')}\\b`, 'i').test(text)) || null;
}

function findTopic(video: Video) {
  const match = topicMatchers.find(([, pattern]) => pattern.test(metadata(video)));
  return match?.[0] || 'Torah Insights';
}

function seriesName(video: Video) {
  const title = video.title.replace(/\s*(part|episode| שיעור|lesson)\s*[\dא-ת\d]+.*$/i, '').replace(/\s*[-:|]\s*#?\d+\s*$/, '').trim();
  return title.length >= 12 && title !== video.title ? title : null;
}

function uniqueVideos(videos: Video[]) {
  return [...new Map(videos.map((video) => [video.id, video])).values()];
}

function formatPublished(date?: string | null) {
  if (!date) return 'Rabbi Bakhshi';
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? 'Rabbi Bakhshi' : `${parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} · Rabbi Bakhshi`;
}

function scrollToSection(id: string) {
  if (typeof document !== 'undefined') document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function Sidebar({ onSearch }: { onSearch: () => void }) {
  const items = [
    ['home', 'Home'],
    ['new', 'New Shiurim'],
    ['all', 'All Shiurim'],
    ['parsha', 'Parsha'],
    ['topics', 'Topics'],
    ['series', 'Series'],
  ] as const;
  return <View style={[styles.sidebar as import('react-native').ViewStyle]}>
    <Pressable onPress={() => scrollToSection('top')} style={styles.brand}>
      <Image contentFit="contain" source={require('@/assets/images/icon.png')} style={styles.brandLogo} />
      <View><Text style={styles.brandName}>Torat Sion</Text><Text style={styles.brandCaption}>RABBI BAKHSHI</Text></View>
    </Pressable>
    <View style={styles.nav}>{items.map(([id, label], index) => <Pressable key={id} onPress={() => scrollToSection(id)} style={[styles.navItem, index === 0 ? styles.navItemActive : null]}><Text style={styles.navGlyph}>{['⌂', '✦', '▤', '◒', '◈', '▥'][index]}</Text><Text style={styles.navLabel}>{label}</Text></Pressable>)}<Pressable onPress={onSearch} style={styles.navItem}><Text style={styles.navGlyph}>⌕</Text><Text style={styles.navLabel}>Search</Text></Pressable></View>
    <View style={styles.sidebarFooter}><Text style={styles.sidebarFooterTitle}>A home for Torah learning</Text><Text style={styles.sidebarFooterText}>Official classes from Rabbi Bakhshi's YouTube channels.</Text></View>
  </View>;
}

function VideoCard({ video, featured = false, favorite, onFavorite, onPlay }: { video: Video; featured?: boolean; favorite: boolean; onFavorite: () => void; onPlay: () => void }) {
  const parsha = findParsha(video);
  return <View style={[styles.card, featured && styles.cardFeatured]}>
    <Pressable accessibilityLabel={`Play ${video.title}`} onPress={onPlay} style={({ hovered }) => [styles.cardPressable, hovered && styles.cardHovered]}>
      <View style={styles.thumbnailWrap}>{video.thumbnailUrl ? <Image contentFit="cover" source={{ uri: video.thumbnailUrl }} style={styles.thumbnail} /> : <View style={styles.thumbnailFallback}><Text style={styles.thumbnailFallbackText}>TORAT SION</Text></View>}<View style={styles.playCircle}><Text style={styles.playIcon}>▶</Text></View>{parsha && <Text style={styles.badge}>{parsha}</Text>}</View>
      <Text numberOfLines={2} style={styles.cardTitle}>{video.title}</Text>
      <Text numberOfLines={1} style={styles.cardMeta}>{formatPublished(video.publishedAt)}</Text>
    </Pressable>
    <Pressable accessibilityLabel={favorite ? `Remove ${video.title} from favorites` : `Add ${video.title} to favorites`} onPress={onFavorite} style={styles.favoriteButton}><Text style={[styles.favoriteIcon, favorite && styles.favoriteActive]}>{favorite ? '★' : '☆'}</Text></Pressable>
  </View>;
}

function Shelf({ id, title, videos, favorites, onFavorite, onPlay, onViewAll }: { id?: string; title: string; videos: Video[]; favorites: Set<string>; onFavorite: (id: string) => void; onPlay: (video: Video) => void; onViewAll?: () => void }) {
  if (!videos.length) return null;
  return <View nativeID={id} style={styles.shelf}><View style={styles.shelfHeader}><View><Text style={styles.shelfTitle}>{title}</Text><Text style={styles.shelfRule} /></View>{onViewAll && <Pressable onPress={onViewAll}><Text style={styles.viewAll}>View all →</Text></Pressable>}</View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.shelfTrack}>{videos.map((video) => <VideoCard key={video.id} video={video} favorite={favorites.has(video.id)} onFavorite={() => onFavorite(video.id)} onPlay={() => onPlay(video)} />)}</ScrollView></View>;
}

export function ToratSionHome() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Video | null>(null);
  const [featureIndex, setFeatureIndex] = useState(0);
  const [query, setQuery] = useState('');
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const isMobile = width < 820;

  useEffect(() => { AsyncStorage.getItem(favoritesKey).then((value) => { if (value) setFavoriteIds(new Set(JSON.parse(value))); }).catch(() => {}); }, []);
  useEffect(() => { fetch(apiUrl('/api/videos')).then(async (response) => { const payload = await response.json() as VideoPayload; if (!response.ok || payload.configured === false) throw new Error(payload.error || 'YouTube classes are unavailable right now.'); setVideos(uniqueVideos((payload.sources || []).flatMap((source) => source.videos))); }).catch((reason) => setError(reason instanceof Error ? reason.message : 'YouTube classes are unavailable right now.')).finally(() => setLoading(false)); }, []);

  const featured = useMemo(() => videos.slice(0, 5), [videos]);
  useEffect(() => { if (featured.length < 2) return; const timer = setInterval(() => setFeatureIndex((index) => (index + 1) % featured.length), 8000); return () => clearInterval(timer); }, [featured.length]);
  const filtered = useMemo(() => { const normalized = query.trim().toLowerCase(); return normalized ? videos.filter((video) => metadata(video).toLowerCase().includes(normalized) || findTopic(video).toLowerCase().includes(normalized) || Boolean(findParsha(video)?.toLowerCase().includes(normalized))) : videos; }, [query, videos]);
  const latest = filtered.slice(0, 12);
  const trending = filtered.slice(3, 15);
  const parsha = filtered.filter((video) => findParsha(video)).slice(0, 12);
  const topics = filtered.filter((video) => findTopic(video) !== 'Torah Insights').slice(0, 12);
  const seriesGroups = useMemo(() => { const groups = new Map<string, Video[]>(); filtered.forEach((video) => { const name = seriesName(video); if (name) groups.set(name, [...(groups.get(name) || []), video]); }); return [...groups.entries()].filter(([, group]) => group.length > 1).slice(0, 6).map(([label, group]) => ({ label, videos: group })); }, [filtered]);
  const toggleFavorite = (id: string) => setFavoriteIds((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); void AsyncStorage.setItem(favoritesKey, JSON.stringify([...next])); return next; });
  const activeFeature = featured[featureIndex] || videos[0];
  const search = () => scrollToSection('all');

  return <View nativeID="top" style={styles.root}><Sidebar onSearch={search} /><ScrollView style={styles.main} contentContainerStyle={[styles.mainContent, isMobile && styles.mainContentMobile]}>
    <View style={styles.topbar}><View><Text style={styles.context}>TORAT SION · RABBI BAKHSHI</Text><Text style={styles.pageTitle}>Discover Torah that stays with you.</Text></View><View style={styles.searchBox}><Text style={styles.searchIcon}>⌕</Text><TextInput accessibilityLabel="Search Rabbi Bakhshi shiurim" onChangeText={setQuery} onSubmitEditing={search} placeholder="Search shiurim, Parsha, topics..." placeholderTextColor="#8390a3" style={styles.searchInput} value={query} /></View></View>
    {loading ? <View style={styles.loading}><ActivityIndicator color="#1d5fc4" size="large" /><Text style={styles.loadingText}>Gathering Rabbi Bakhshi's latest shiurim…</Text></View> : error ? <View style={styles.errorState}><Text style={styles.errorTitle}>The library is taking a moment</Text><Text style={styles.errorText}>{error}</Text></View> : activeFeature ? <View style={styles.hero}><Image contentFit="cover" source={{ uri: activeFeature.thumbnailUrl || '' }} style={styles.heroImage} /><View style={styles.heroShade} /><View style={styles.heroContent}><Text style={styles.heroEyebrow}>FEATURED SHIUR · RABBI BAKHSHI</Text><Text numberOfLines={2} style={styles.heroTitle}>{activeFeature.title}</Text><Text numberOfLines={2} style={styles.heroDescription}>{activeFeature.description || 'Explore an official Rabbi Bakhshi class from the Torat Sion collection.'}</Text><View style={styles.heroActions}><Pressable onPress={() => setSelected(activeFeature)} style={styles.listenButton}><Text style={styles.listenButtonText}>▶  Listen now</Text></Pressable><Pressable onPress={() => toggleFavorite(activeFeature.id)} style={styles.heroFavorite}><Text style={styles.heroFavoriteText}>{favoriteIds.has(activeFeature.id) ? '★ Saved' : '☆ Save'}</Text></Pressable></View><View style={styles.heroDots}>{featured.map((video, index) => <Pressable key={video.id} accessibilityLabel={`Show featured shiur ${index + 1}`} onPress={() => setFeatureIndex(index)} style={[styles.heroDot, index === featureIndex && styles.heroDotActive]} />)}</View></View></View> : <View style={styles.errorState}><Text style={styles.errorTitle}>No public classes are available yet.</Text></View>}
    {!loading && !error && <><Shelf id="new" title="New Shiurim" videos={latest} favorites={favoriteIds} onFavorite={toggleFavorite} onPlay={setSelected} onViewAll={() => scrollToSection('all')} /><Shelf title="Trending Shiurim" videos={trending} favorites={favoriteIds} onFavorite={toggleFavorite} onPlay={setSelected} /><Shelf id="parsha" title="Shiurim by Parsha" videos={parsha} favorites={favoriteIds} onFavorite={toggleFavorite} onPlay={setSelected} /><Shelf id="topics" title="Shiurim by Topic" videos={topics} favorites={favoriteIds} onFavorite={toggleFavorite} onPlay={setSelected} /><View nativeID="series">{seriesGroups.map((group) => <Shelf key={group.label} title={`Series · ${group.label}`} videos={group.videos} favorites={favoriteIds} onFavorite={toggleFavorite} onPlay={setSelected} />)}</View><Shelf id="all" title={query ? `Search results · ${query}` : 'All Shiurim'} videos={filtered} favorites={favoriteIds} onFavorite={toggleFavorite} onPlay={setSelected} onViewAll={() => setQuery('')} /><Shelf title="Popular Shiurim" videos={filtered.slice(12, 24)} favorites={favoriteIds} onFavorite={toggleFavorite} onPlay={setSelected} /></>}
  </ScrollView><VideoModal video={selected} onClose={() => setSelected(null)} /></View>;
}

const styles: Record<string, any> = StyleSheet.create({
  root: { backgroundColor: '#f7f5f0', flex: 1, flexDirection: 'row' },
  sidebar: { backgroundColor: '#101c35', borderRightColor: '#233252', borderRightWidth: 1, justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 28, width: 238 },
  brand: { alignItems: 'center', flexDirection: 'row', gap: 11, marginBottom: 42, paddingHorizontal: 8 },
  brandLogo: { height: 40, width: 40 },
  brandName: { color: '#fbfaf5', fontSize: 20, fontWeight: '800', letterSpacing: 0.2 },
  brandCaption: { color: '#cda96c', fontSize: 9, fontWeight: '800', letterSpacing: 1.4, marginTop: 3 },
  nav: { gap: 6, flex: 1 },
  navItem: { alignItems: 'center', borderRadius: 12, flexDirection: 'row', gap: 14, paddingHorizontal: 13, paddingVertical: 12 },
  navItemActive: { backgroundColor: '#1e3359' },
  navItemHover: { backgroundColor: '#1a2b4a' },
  navGlyph: { color: '#afbdd2', fontSize: 19, textAlign: 'center', width: 22 },
  navLabel: { color: '#d8e0ec', fontSize: 14, fontWeight: '600' },
  sidebarFooter: { borderColor: '#2d3d5d', borderRadius: 14, borderWidth: 1, padding: 14 },
  sidebarFooterTitle: { color: '#f4eee0', fontSize: 12, fontWeight: '800' },
  sidebarFooterText: { color: '#94a4bd', fontSize: 11, lineHeight: 16, marginTop: 7 },
  main: { flex: 1, minWidth: 0 },
  mainContent: { alignSelf: 'center', maxWidth: 1500, paddingBottom: 90, paddingHorizontal: 52, paddingTop: 38, width: '100%' },
  mainContentMobile: { paddingHorizontal: 18, paddingTop: 22 },
  topbar: { alignItems: 'flex-end', flexDirection: 'row', gap: 24, justifyContent: 'space-between', marginBottom: 30 },
  context: { color: '#2b66bc', fontSize: 11, fontWeight: '800', letterSpacing: 1.7 },
  pageTitle: { color: '#14213d', fontSize: 30, fontWeight: '800', marginTop: 8 },
  searchBox: { alignItems: 'center', backgroundColor: '#fff', borderColor: '#e4e0d7', borderRadius: 13, borderWidth: 1, flexDirection: 'row', maxWidth: 360, paddingHorizontal: 14, width: '33%' },
  searchIcon: { color: '#41648f', fontSize: 22 },
  searchInput: { color: '#172844', flex: 1, fontSize: 13, paddingHorizontal: 10, paddingVertical: 13 },
  hero: { borderRadius: 20, height: 360, marginBottom: 40, overflow: 'hidden', position: 'relative' },
  heroImage: { backgroundColor: '#172844', bottom: 0, left: 0, position: 'absolute', right: 0, top: 0 },
  heroShade: { backgroundColor: 'rgba(7,18,40,0.64)', bottom: 0, left: 0, position: 'absolute', right: 0, top: 0 },
  heroContent: { bottom: 0, left: 0, maxWidth: 690, padding: 38, position: 'absolute' },
  heroEyebrow: { color: '#e3c88f', fontSize: 11, fontWeight: '800', letterSpacing: 1.6 },
  heroTitle: { color: '#fff', fontSize: 35, fontWeight: '800', lineHeight: 43, marginTop: 12 },
  heroDescription: { color: '#d7dfeb', fontSize: 14, lineHeight: 21, marginTop: 10, maxWidth: 590 },
  heroActions: { alignItems: 'center', flexDirection: 'row', gap: 12, marginTop: 20 },
  listenButton: { backgroundColor: '#d1a96b', borderRadius: 10, paddingHorizontal: 19, paddingVertical: 12 },
  listenButtonText: { color: '#17233d', fontSize: 13, fontWeight: '800' },
  heroFavorite: { borderColor: '#c9d4e4', borderRadius: 10, borderWidth: 1, paddingHorizontal: 17, paddingVertical: 11 },
  heroFavoriteText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  heroDots: { flexDirection: 'row', gap: 6, marginTop: 22 },
  heroDot: { backgroundColor: '#9eabc0', borderRadius: 5, height: 7, opacity: 0.6, width: 7 },
  heroDotActive: { backgroundColor: '#e2bd78', opacity: 1, width: 22 },
  shelf: { marginBottom: 37, minWidth: 0 },
  shelfHeader: { alignItems: 'flex-end', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
  shelfTitle: { color: '#172844', fontSize: 21, fontWeight: '800' },
  shelfRule: { backgroundColor: '#d1a96b', height: 2, marginTop: 7, width: 32 },
  viewAll: { color: '#2b66bc', fontSize: 12, fontWeight: '800' },
  shelfTrack: { gap: 15, paddingBottom: 8, paddingRight: 20 },
  card: { backgroundColor: '#fff', borderColor: '#e7e2d9', borderRadius: 14, borderWidth: 1, overflow: 'hidden', position: 'relative', width: 224 },
  cardPressable: { paddingBottom: 12 },
  cardHovered: { backgroundColor: '#fcfbf8', transform: [{ translateY: -3 }] },
  thumbnailWrap: { aspectRatio: 16 / 9, backgroundColor: '#d8e0ea', overflow: 'hidden', position: 'relative' },
  thumbnail: { height: '100%', width: '100%' },
  thumbnailFallback: { alignItems: 'center', backgroundColor: '#20365c', height: '100%', justifyContent: 'center', width: '100%' },
  thumbnailFallbackText: { color: '#e3c88f', fontSize: 11, fontWeight: '800', letterSpacing: 1.4 },
  playCircle: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 24, height: 48, justifyContent: 'center', left: '50%', position: 'absolute', top: '50%', transform: [{ translateX: -24 }, { translateY: -24 }], width: 48 },
  playIcon: { color: '#1d5fc4', fontSize: 16, marginLeft: 2 },
  badge: { backgroundColor: '#172844', bottom: 8, color: '#fff', fontSize: 10, fontWeight: '800', left: 8, paddingHorizontal: 7, paddingVertical: 4, position: 'absolute' },
  cardTitle: { color: '#172844', fontSize: 14, fontWeight: '800', lineHeight: 19, marginHorizontal: 12, marginTop: 11 },
  cardMeta: { color: '#718099', fontSize: 11, marginHorizontal: 12, marginTop: 6 },
  favoriteButton: { position: 'absolute', right: 7, top: 7 },
  favoriteIcon: { color: '#fff', fontSize: 22, textShadowColor: 'rgba(0,0,0,0.45)', textShadowRadius: 3 },
  favoriteActive: { color: '#e5bd75' },
  loading: { alignItems: 'center', backgroundColor: '#fff', borderRadius: 18, justifyContent: 'center', minHeight: 300 },
  loadingText: { color: '#52627a', fontSize: 14, marginTop: 13 },
  errorState: { alignItems: 'center', backgroundColor: '#fff', borderColor: '#e3ddd2', borderRadius: 18, borderWidth: 1, justifyContent: 'center', minHeight: 280, padding: 28 },
  errorTitle: { color: '#172844', fontSize: 21, fontWeight: '800' },
  errorText: { color: '#718099', fontSize: 14, marginTop: 9, textAlign: 'center' },
});
