import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { InlineYouTubePlayer, type ShowcaseVideo, useYouTubePlayback } from '@/components/video-showcase';
import { apiUrl } from '@/lib/api';
import { editorAttributes, editorElementId } from '@/lib/editor-elements';

type Video = ShowcaseVideo & {
  description?: string;
  publishedAt?: string | null;
  durationSeconds?: number | null;
  channelTitle?: string;
  sourceKey?: string;
  liveStatus?: 'live' | 'upcoming' | 'archived' | 'none';
  isLive?: boolean;
  isUpcoming?: boolean;
};

type Source = { key: string; label: string; videos: Video[] };
type VideoPayload = { configured?: boolean; sources?: Source[]; error?: string };
type BuilderSection = { id: string; type: string; title: string; subtitle?: string; description?: string; enabled?: boolean; background?: string; textColor?: string; source?: string; visibleCount?: number; videoIds?: string[]; banner?: { videoId?: string; title?: string; description?: string; buttonText?: string; buttonLink?: string } };
type BuilderDocument = { design?: { background?: string; text?: string; header?: { title?: string; subtitle?: string; links?: Array<{ id: string; label: string; href: string }> }; footer?: { title?: string; subtitle?: string; links?: Array<{ id: string; label: string; href: string }> } }; sections?: BuilderSection[] };

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
const parshaAliases: Record<string, RegExp> = {
  Bereshit: /(?:bereshit|bereishit|genesis|בראשית)/i,
  Noach: /(?:noach|noah|נח)/i,
  'Lech Lecha': /(?:lech[ -]?lecha|לך[ -]?לך)/i,
  Vayera: /(?:vayera|va.?yera|וירא)/i,
  'Chayei Sarah': /(?:chayei[ -]?sarah|חיי[ -]?שרה)/i,
  Toldot: /(?:toldot|toldos|תולדות)/i,
  Vayetzei: /(?:vayetzei|vaye.?tzei|ויצא)/i,
  Vayishlach: /(?:vayishlach|וישלח)/i,
  Vayeshev: /(?:vayeshev|וישב)/i,
  Miketz: /(?:miketz|מקץ)/i,
  Vayigash: /(?:vayigash|ויגש)/i,
  Vayechi: /(?:vayechi|ויחי)/i,
  Shemot: /(?:shemot|shemos|exodus|שמות)/i,
  Vaera: /(?:vaera|va.?eira|וארא)/i,
  Bo: /(?:\bbo\b|בא)/i,
  Beshalach: /(?:beshalach|בשלח)/i,
  Yitro: /(?:yitro|יתרו)/i,
  Mishpatim: /(?:mishpatim|משפטים)/i,
  Terumah: /(?:terumah|תרומה)/i,
  Tetzaveh: /(?:tetzaveh|תצוה)/i,
  'Ki Tisa': /(?:ki[ -]?tisa|כי[ -]?תשא)/i,
  Vayakhel: /(?:vayakhel|ויקהל)/i,
  Pekudei: /(?:pekudei|פקודי)/i,
  Vayikra: /(?:vayikra|leviticus|ויקרא)/i,
  Tzav: /(?:\btzav\b|צו)/i,
  Shemini: /(?:shemini|שמיני)/i,
  Tazria: /(?:tazria|תזריע)/i,
  Metzora: /(?:metzora|מצורע)/i,
  'Acharei Mot': /(?:acharei[ -]?mot|אחרי[ -]מות)/i,
  Kedoshim: /(?:kedoshim|קדושים)/i,
  Emor: /(?:\bemor\b|אמור)/i,
  Behar: /(?:behar|בהר)/i,
  Bechukotai: /(?:bechukotai|בחוקותי)/i,
  Bamidbar: /(?:bamidbar|numbers|במדבר)/i,
  Naso: /(?:\bnaso\b|נשא)/i,
  Devarim: /(?:devarim|deuteronomy|דברים)/i,
  Vaetchanan: /(?:vaetchanan|ואתחנן)/i,
  Eikev: /(?:eikev|עקב)/i,
  Reeh: /(?:\breeh\b|ראה)/i,
  Shoftim: /(?:shoftim|שופטים)/i,
  'Ki Teitzei': /(?:ki[ -]?teitzei|כי[ -]תצא)/i,
  'Ki Tavo': /(?:ki[ -]?tavo|כי[ -]תבוא)/i,
  Nitzavim: /(?:nitzavim|ניצבים)/i,
  Vayeilech: /(?:vayeilech|וילך)/i,
  Haazinu: /(?:haazinu|האזינו)/i,
};

function metadata(video: Video) {
  return `${video.title} ${video.description || ''}`;
}

function findParsha(video: Video) {
  const text = metadata(video);
  return parshiyot.find((parsha) => (parshaAliases[parsha] || new RegExp(`\\b${parsha.replace(' ', '[ -]')}\\b`, 'i')).test(text)) || null;
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

function sortVideos(videos: Video[]) {
  return [...videos].sort((a, b) => {
    const aTime = a.publishedAt ? Date.parse(a.publishedAt) : Number.NaN;
    const bTime = b.publishedAt ? Date.parse(b.publishedAt) : Number.NaN;
    if (Number.isFinite(aTime) && Number.isFinite(bTime)) return bTime - aTime;
    if (Number.isFinite(aTime)) return -1;
    if (Number.isFinite(bTime)) return 1;
    return 0;
  });
}

function formatPublished(date?: string | null) {
  if (!date) return 'Rabbi Bakhshi';
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? 'Rabbi Bakhshi' : `${parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} · Rabbi Bakhshi`;
}

function formatDuration(seconds?: number | null) {
  if (!seconds || seconds <= 0) return null;
  const minutes = Math.floor(seconds / 60);
  const remaining = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${minutes}:${remaining}`;
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
    ['favorites', 'Favorites'],
    ['recent', 'Recently Played'],
  ] as const;
  return <View style={[styles.sidebar as import('react-native').ViewStyle]}>
    <Pressable onPress={() => scrollToSection('top')} style={styles.brand}>
      <Image contentFit="contain" source={require('@/assets/images/icon.png')} style={styles.brandLogo} />
      <View><Text style={styles.brandName}>Torat Sion</Text><Text style={styles.brandCaption}>RABBI BAKHSHI</Text></View>
    </Pressable>
    <View style={styles.nav}>{items.map(([id, label], index) => <Pressable key={id} onPress={() => scrollToSection(id)} style={[styles.navItem, index === 0 ? styles.navItemActive : null]}><Text style={styles.navGlyph}>{['⌂', '✦', '▤', '◒', '◈', '▥', '★', '◷'][index]}</Text><Text style={styles.navLabel}>{label}</Text></Pressable>)}<Pressable onPress={onSearch} style={styles.navItem}><Text style={styles.navGlyph}>⌕</Text><Text style={styles.navLabel}>Search</Text></Pressable></View>
    <View style={styles.sidebarFooter}><Text style={styles.sidebarFooterTitle}>A home for Torah learning</Text><Text style={styles.sidebarFooterText}>Official classes from the Torat Sion library.</Text></View>
  </View>;
}

function VideoCard({ video, featured = false, favorite, onFavorite, onPlay, playing, cardWidth }: { video: Video; featured?: boolean; favorite: boolean; onFavorite: () => void; onPlay: () => void; playing: boolean; cardWidth: number }) {
  const parsha = findParsha(video);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const showAffordance = hovered || focused;
  return <View {...editorAttributes({ id: editorElementId('home', 'video-card', video.id), kind: 'video-card', label: `video card ${video.title}`, page: 'home' })} style={[styles.card, { width: cardWidth }, featured && styles.cardFeatured]}>
    <View style={[styles.cardPressable, { width: cardWidth }]}>
      <View style={styles.thumbnailWrap}>{playing ? <InlineYouTubePlayer video={video} /> : <Pressable accessibilityLabel={`Play ${video.title}`} onBlur={() => setFocused(false)} onFocus={() => setFocused(true)} onHoverIn={() => setHovered(true)} onHoverOut={() => setHovered(false)} onPress={onPlay} style={styles.thumbnailButton}>{video.thumbnailUrl ? <Image contentFit="cover" source={{ uri: video.thumbnailUrl }} style={[styles.thumbnail, showAffordance && styles.thumbnailZoom]} /> : <View style={[styles.thumbnailFallback, showAffordance && styles.thumbnailZoom]}><Text style={styles.thumbnailFallbackText}>TORAT SION</Text></View>}<View style={[styles.thumbnailShade, showAffordance && styles.thumbnailShadeVisible]} /><View style={[styles.playCircle, showAffordance && styles.playCircleVisible]}><Text style={styles.playIcon}>▶</Text></View></Pressable>}{video.isLive && <View style={styles.liveBadge}><Text style={styles.liveBadgeText}>LIVE</Text></View>}{video.isUpcoming && <View style={styles.liveBadge}><Text style={styles.liveBadgeText}>UPCOMING</Text></View>}{parsha && <Text style={styles.badge}>{parsha}</Text>}</View>
      <Text numberOfLines={2} style={styles.cardTitle}>{video.title}</Text>
      <Text numberOfLines={1} style={styles.cardMeta}>{formatPublished(video.publishedAt)}{formatDuration(video.durationSeconds) ? ` · ${formatDuration(video.durationSeconds)}` : ''}</Text>
    </View>
    <Pressable accessibilityLabel={favorite ? `Remove ${video.title} from favorites` : `Add ${video.title} to favorites`} onPress={onFavorite} style={styles.favoriteButton}><Text style={[styles.favoriteIcon, favorite && styles.favoriteActive]}>{favorite ? '★' : '☆'}</Text></Pressable>
  </View>;
}

function Shelf({ id, title, videos, favorites, activeVideoId, onFavorite, onPlay, onViewAll }: { id?: string; title: string; videos: Video[]; favorites: Set<string>; activeVideoId: string | null; onFavorite: (id: string) => void; onPlay: (video: Video) => void; onViewAll?: () => void }) {
  if (!videos.length) return null;
  const { width } = useWindowDimensions();
  const cardWidth = width < 600 ? 260 : width < 1000 ? 280 : 320;
  return <View {...editorAttributes({ id: editorElementId('home', 'shelf', id || title), kind: 'shelf', label: `${title} shelf`, page: 'home' })} nativeID={id} style={styles.shelf}><View style={styles.shelfHeader}><View><Text {...editorAttributes({ id: editorElementId('home', 'text', `${id || title}-title`), kind: 'text', label: `${title} heading`, page: 'home' })} style={styles.shelfTitle}>{title}</Text><Text style={styles.shelfRule} /></View>{onViewAll && <Pressable {...editorAttributes({ id: editorElementId('home', 'link', `${id || title}-view-all`), kind: 'link', label: `${title} view all link`, page: 'home' })} onPress={onViewAll}><Text style={styles.viewAll}>View all →</Text></Pressable>}</View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.shelfTrack}>{videos.map((video) => <VideoCard key={video.id} cardWidth={cardWidth} playing={activeVideoId === video.id} video={video} favorite={favorites.has(video.id)} onFavorite={() => onFavorite(video.id)} onPlay={() => onPlay(video)} />)}</ScrollView></View>;
}

function AllShiurimGrid({ videos, favorites, activeVideoId, onFavorite, onPlay }: { videos: Video[]; favorites: Set<string>; activeVideoId: string | null; onFavorite: (id: string) => void; onPlay: (video: Video) => void }) {
  const { width } = useWindowDimensions();
  const [parshaFilter, setParshaFilter] = useState('');
  const [topicFilter, setTopicFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [visibleCount, setVisibleCount] = useState(16);
  const columns = width >= 1100 ? 4 : width >= 700 ? 3 : width >= 460 ? 2 : 1;
  const gap = 14;
  const cardWidth = Math.max(220, Math.floor((Math.min(width - 44, 1280) - gap * (columns - 1)) / columns));
  const filtered = videos.filter((video) => (!parshaFilter || findParsha(video) === parshaFilter) && (!topicFilter || findTopic(video) === topicFilter) && (!dateFilter || Boolean(video.publishedAt && video.publishedAt.slice(0, 10) === dateFilter)));
  const options = (values: string[]) => values.filter((value, index) => values.indexOf(value) === index).slice(0, 12);
  return <View nativeID="all" style={styles.library}><View style={styles.shelfHeader}><View><Text style={styles.shelfTitle}>All Shiurim</Text><Text style={styles.shelfRule} /></View><Text style={styles.libraryCount}>{filtered.length.toLocaleString()} classes</Text></View><View style={styles.filterRow}><TextInput accessibilityLabel="Filter by date" onChangeText={setDateFilter} placeholder="Date YYYY-MM-DD" placeholderTextColor="#8390a3" style={styles.filterInput} value={dateFilter} />{options(parshiyot).slice(0, 6).map((value) => <Pressable key={value} onPress={() => setParshaFilter(parshaFilter === value ? '' : value)} style={[styles.filterChip, parshaFilter === value && styles.filterChipActive]}><Text style={styles.filterChipText}>{value}</Text></Pressable>)}{options(topicMatchers.map(([value]) => value)).map((value) => <Pressable key={value} onPress={() => setTopicFilter(topicFilter === value ? '' : value)} style={[styles.filterChip, topicFilter === value && styles.filterChipActive]}><Text style={styles.filterChipText}>{value}</Text></Pressable>)}</View>{filtered.length ? <View style={[styles.libraryGrid, { gap }]}>{filtered.slice(0, visibleCount).map((video) => <VideoCard key={video.id} cardWidth={cardWidth} playing={activeVideoId === video.id} video={video} favorite={favorites.has(video.id)} onFavorite={() => onFavorite(video.id)} onPlay={() => onPlay(video)} />)}</View> : <Text style={styles.emptyLibrary}>No classes match these filters.</Text>}{visibleCount < filtered.length && <Pressable onPress={() => setVisibleCount((count) => count + 16)} style={styles.loadMore}><Text style={styles.loadMoreText}>Load more classes</Text></Pressable>}</View>;
}

export function ToratSionHome() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [videos, setVideos] = useState<Video[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [builder, setBuilder] = useState<BuilderDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [featureIndex, setFeatureIndex] = useState(0);
  const [query, setQuery] = useState('');
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const isMobile = width < 820;
  const { activeVideo, playVideo: playSharedVideo } = useYouTubePlayback();

  useEffect(() => { Promise.all([AsyncStorage.getItem(favoritesKey), AsyncStorage.getItem('torat-sion.youtube-recent')]).then(([favorites, recent]) => { if (favorites) setFavoriteIds(new Set(JSON.parse(favorites))); if (recent) setRecentIds(JSON.parse(recent)); }).catch(() => {}); }, []);
  useEffect(() => { fetch(apiUrl('/api/videos')).then(async (response) => { const payload = await response.json() as VideoPayload; if (!response.ok || payload.configured === false) throw new Error(payload.error || 'Classes are unavailable right now.'); setSources(payload.sources || []); setVideos(sortVideos(uniqueVideos((payload.sources || []).flatMap((source) => source.videos)))); }).catch((reason) => setError(reason instanceof Error ? reason.message : 'Classes are unavailable right now.')).finally(() => setLoading(false)); fetch(apiUrl('/api/home-builder')).then((response) => response.ok ? response.json() as Promise<BuilderDocument> : null).then(setBuilder).catch(() => setBuilder(null)); }, []);

  const featured = useMemo(() => videos.slice(0, 5), [videos]);
  useEffect(() => { if (featured.length < 2) return; const timer = setInterval(() => setFeatureIndex((index) => (index + 1) % featured.length), 8000); return () => clearInterval(timer); }, [featured.length]);
  const filtered = useMemo(() => { const normalized = query.trim().toLowerCase(); return normalized ? videos.filter((video) => metadata(video).toLowerCase().includes(normalized) || findTopic(video).toLowerCase().includes(normalized) || Boolean(findParsha(video)?.toLowerCase().includes(normalized))) : videos; }, [query, videos]);
  const latest = filtered;
  const trending = filtered.slice(3);
  const parsha = filtered.filter((video) => findParsha(video));
  const topics = filtered.filter((video) => findTopic(video) !== 'Torah Insights');
  const shabbatVideos = sortVideos((sources.find((source) => source.key === 'shabbat-shalom')?.videos || []).filter((video) => !query.trim() || metadata(video).toLowerCase().includes(query.trim().toLowerCase())));
  const liveVideos = sortVideos(filtered.filter((video) => video.isLive || video.isUpcoming));
  const seriesGroups = useMemo(() => { const groups = new Map<string, Video[]>(); filtered.forEach((video) => { const name = seriesName(video); if (name) groups.set(name, [...(groups.get(name) || []), video]); }); return [...groups.entries()].filter(([, group]) => group.length > 1).slice(0, 6).map(([label, group]) => ({ label, videos: group })); }, [filtered]);
  const toggleFavorite = (id: string) => setFavoriteIds((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); void AsyncStorage.setItem(favoritesKey, JSON.stringify([...next])); return next; });
  const playVideo = (video: Video) => { playSharedVideo(video); setRecentIds((current) => { const next = [video.id, ...current.filter((id) => id !== video.id)].slice(0, 12); void AsyncStorage.setItem('torat-sion.youtube-recent', JSON.stringify(next)); return next; }); };
  const activeFeature = featured[featureIndex] || videos[0];
  const search = () => scrollToSection('all');
  const customSections = (builder?.sections || []).filter((section) => section.enabled !== false);
  const renderCustomSection = (section: BuilderSection) => {
    if (section.type === 'video-shelf' || section.type === 'keyword-shelf') {
      const selected = section.videoIds?.map((id) => videos.find((video) => video.id === id)).filter((video): video is Video => Boolean(video)) || [];
      const sectionVideos = selected.length ? selected : section.source === 'shabbat-shalom' ? shabbatVideos : filtered;
      return <Shelf key={section.id} activeVideoId={activeVideo?.id || null} title={section.title} videos={sectionVideos.slice(0, section.visibleCount || sectionVideos.length)} favorites={favoriteIds} onFavorite={toggleFavorite} onPlay={playVideo} />;
    }
    const bannerVideo = section.banner?.videoId ? videos.find((video) => video.id === section.banner?.videoId) : null;
    return <View key={section.id} style={[styles.customSection, { backgroundColor: section.background || '#fff' }]}>{bannerVideo?.thumbnailUrl ? <Image contentFit="cover" source={{ uri: bannerVideo.thumbnailUrl }} style={styles.customSectionImage} /> : null}<Text style={[styles.customSectionTitle, { color: section.textColor || builder?.design?.text || '#172844' }]}>{section.banner?.title || section.title}</Text>{section.subtitle || section.banner?.description || section.description ? <Text style={styles.customSectionSubtitle}>{section.subtitle || section.banner?.description || section.description}</Text> : null}{section.banner?.buttonText && (bannerVideo || videos[0]) ? <Pressable onPress={() => section.banner?.buttonLink ? router.push(section.banner.buttonLink as never) : playVideo(bannerVideo || videos[0])} style={styles.customSectionButton}><Text style={styles.customSectionButtonText}>{section.banner.buttonText}</Text></Pressable> : null}</View>;
  };

  return <View nativeID="top" style={[styles.root, { backgroundColor: builder?.design?.background || '#f7f5f0' }]}><Sidebar onSearch={search} /><ScrollView style={styles.main} contentContainerStyle={[styles.mainContent, isMobile && styles.mainContentMobile]}><View style={styles.builderHeader}><Text style={styles.builderHeaderTitle}>{builder?.design?.header?.title || 'Torat Sion'}</Text>{builder?.design?.header?.subtitle ? <Text style={styles.builderHeaderSubtitle}>{builder.design.header.subtitle}</Text> : null}<View style={styles.builderHeaderLinks}>{(builder?.design?.header?.links || []).map((link) => <Pressable key={link.id} accessibilityRole="link" onPress={() => router.push(link.href as never)}><Text style={styles.builderHeaderLink}>{link.label}</Text></Pressable>)}</View></View>
    <View style={styles.topbar}><View><Text style={styles.context}>TORAT SION · RABBI BAKHSHI</Text><Text style={styles.pageTitle}>Discover Torah that stays with you.</Text></View><View style={styles.searchBox}><Text style={styles.searchIcon}>⌕</Text><TextInput accessibilityLabel="Search Rabbi Bakhshi shiurim" onChangeText={setQuery} onSubmitEditing={search} placeholder="Search shiurim, Parsha, topics..." placeholderTextColor="#8390a3" style={styles.searchInput} value={query} /></View></View>
    {loading ? <View style={styles.loading}><ActivityIndicator color="#1d5fc4" size="large" /><Text style={styles.loadingText}>Gathering Rabbi Bakhshi's latest shiurim…</Text></View> : error ? <View style={styles.errorState}><Text style={styles.errorTitle}>The library is taking a moment</Text><Text style={styles.errorText}>{error}</Text></View> : activeFeature ? <View style={styles.hero}><Image contentFit="cover" source={{ uri: activeFeature.thumbnailUrl || '' }} style={styles.heroImage} /><View style={styles.heroShade} /><View style={styles.heroContent}><Text style={styles.heroEyebrow}>FEATURED SHIUR · RABBI BAKHSHI</Text><Text numberOfLines={2} style={styles.heroTitle}>{activeFeature.title}</Text><Text numberOfLines={2} style={styles.heroDescription}>{activeFeature.description || 'Explore an official Rabbi Bakhshi class from the Torat Sion collection.'}</Text><View style={styles.heroActions}><Pressable onPress={() => playVideo(activeFeature)} style={styles.listenButton}><Text style={styles.listenButtonText}>▶      Play Shiur</Text></Pressable><Pressable onPress={() => toggleFavorite(activeFeature.id)} style={styles.heroFavorite}><Text style={styles.heroFavoriteText}>{favoriteIds.has(activeFeature.id) ? '★ Saved' : '☆ Save'}</Text></Pressable></View><View style={styles.heroDots}>{featured.map((video, index) => <Pressable key={video.id} accessibilityLabel={`Show featured shiur ${index + 1}`} onPress={() => setFeatureIndex(index)} style={[styles.heroDot, index === featureIndex && styles.heroDotActive]} />)}</View></View></View> : <View style={styles.errorState}><Text style={styles.errorTitle}>No public classes are available yet.</Text></View>}
    {!loading && !error && <>{customSections.map(renderCustomSection)}<Shelf id="new" activeVideoId={activeVideo?.id || null} title="New Shiurim" videos={latest} favorites={favoriteIds} onFavorite={toggleFavorite} onPlay={playVideo} onViewAll={() => scrollToSection('all')} /><Shelf id="live" activeVideoId={activeVideo?.id || null} title="Live & Upcoming Broadcasts" videos={liveVideos} favorites={favoriteIds} onFavorite={toggleFavorite} onPlay={playVideo} /><Shelf id="shabbat-shalom" activeVideoId={activeVideo?.id || null} title="Shabbat Shalom Classes" videos={shabbatVideos} favorites={favoriteIds} onFavorite={toggleFavorite} onPlay={playVideo} onViewAll={() => scrollToSection('all')} /><Shelf id="recent" activeVideoId={activeVideo?.id || null} title="Continue Listening" videos={recentIds.map((id) => videos.find((video) => video.id === id)).filter((video): video is Video => Boolean(video))} favorites={favoriteIds} onFavorite={toggleFavorite} onPlay={playVideo} /><Shelf title="Trending Shiurim" activeVideoId={activeVideo?.id || null} videos={trending} favorites={favoriteIds} onFavorite={toggleFavorite} onPlay={playVideo} /><Shelf id="parsha" activeVideoId={activeVideo?.id || null} title="Shiurim by Parsha" videos={parsha} favorites={favoriteIds} onFavorite={toggleFavorite} onPlay={playVideo} /><Shelf id="topics" activeVideoId={activeVideo?.id || null} title="Explore Torah Topics" videos={topics} favorites={favoriteIds} onFavorite={toggleFavorite} onPlay={playVideo} /><View nativeID="series">{seriesGroups.map((group) => <Shelf key={group.label} activeVideoId={activeVideo?.id || null} title={`Series · ${group.label}`} videos={group.videos} favorites={favoriteIds} onFavorite={toggleFavorite} onPlay={playVideo} />)}</View><Shelf id="favorites" activeVideoId={activeVideo?.id || null} title="Favorites" videos={filtered.filter((video) => favoriteIds.has(video.id))} favorites={favoriteIds} onFavorite={toggleFavorite} onPlay={playVideo} /><AllShiurimGrid videos={filtered} favorites={favoriteIds} activeVideoId={activeVideo?.id || null} onFavorite={toggleFavorite} onPlay={playVideo} /></>}<View style={styles.builderFooter}><Text style={styles.builderFooterTitle}>{builder?.design?.footer?.title || 'Torat Sion'}</Text>{builder?.design?.footer?.subtitle ? <Text style={styles.builderFooterSubtitle}>{builder.design.footer.subtitle}</Text> : null}</View>
  </ScrollView></View>;
}

const styles: Record<string, any> = StyleSheet.create({
  root: { backgroundColor: '#f7f5f0', flex: 1, flexDirection: 'row' },
  builderHeader: { backgroundColor: '#ffffff', borderRadius: 12, marginBottom: 18, padding: 18 },
  builderHeaderTitle: { color: '#172844', fontSize: 20, fontWeight: '800' },
  builderHeaderSubtitle: { color: '#667085', marginTop: 4 },
  builderHeaderLinks: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 10 },
  builderHeaderLink: { color: '#0052CC', fontWeight: '700' },
  builderFooter: { borderTopColor: '#d9e2ef', borderTopWidth: 1, marginTop: 32, paddingVertical: 28 },
  builderFooterTitle: { color: '#172844', fontSize: 18, fontWeight: '800' },
  builderFooterSubtitle: { color: '#667085', marginTop: 5 },
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
  thumbnailButton: { height: '100%', width: '100%' },
  thumbnail: { height: '100%', width: '100%' },
  thumbnailZoom: { transform: [{ scale: 1.035 }] },
  thumbnailShade: { backgroundColor: '#000', bottom: 0, left: 0, opacity: 0, position: 'absolute', right: 0, top: 0 },
  thumbnailShadeVisible: { opacity: 0.18 },
  thumbnailFallback: { alignItems: 'center', backgroundColor: '#20365c', height: '100%', justifyContent: 'center', width: '100%' },
  thumbnailFallbackText: { color: '#e3c88f', fontSize: 11, fontWeight: '800', letterSpacing: 1.4 },
  playCircle: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 24, height: 48, justifyContent: 'center', left: '50%', opacity: 0, position: 'absolute', top: '50%', transform: [{ translateX: -24 }, { translateY: -24 }], width: 48 },
  playCircleVisible: { opacity: 1 },
  playIcon: { color: '#1d5fc4', fontSize: 16, marginLeft: 2 },
  badge: { backgroundColor: '#172844', bottom: 8, color: '#fff', fontSize: 10, fontWeight: '800', left: 8, paddingHorizontal: 7, paddingVertical: 4, position: 'absolute' },
  liveBadge: { backgroundColor: '#d52d3f', borderRadius: 4, left: 8, paddingHorizontal: 7, paddingVertical: 4, position: 'absolute', top: 8 },
  liveBadgeText: { color: '#fff', fontSize: 10, fontWeight: '900', letterSpacing: 0.6 },
  cardTitle: { color: '#172844', fontSize: 14, fontWeight: '800', lineHeight: 19, marginHorizontal: 12, marginTop: 11 },
  cardMeta: { color: '#718099', fontSize: 11, marginHorizontal: 12, marginTop: 6 },
  dedicatedLink: { marginHorizontal: 12, marginTop: 8 },
  dedicatedLinkText: { color: '#2b66bc', fontSize: 11, fontWeight: '700' },
  favoriteButton: { position: 'absolute', right: 7, top: 7 },
  favoriteIcon: { color: '#fff', fontSize: 22, textShadowColor: 'rgba(0,0,0,0.45)', textShadowRadius: 3 },
  favoriteActive: { color: '#e5bd75' },
  loading: { alignItems: 'center', backgroundColor: '#fff', borderRadius: 18, justifyContent: 'center', minHeight: 300 },
  loadingText: { color: '#52627a', fontSize: 14, marginTop: 13 },
  errorState: { alignItems: 'center', backgroundColor: '#fff', borderColor: '#e3ddd2', borderRadius: 18, borderWidth: 1, justifyContent: 'center', minHeight: 280, padding: 28 },
  errorTitle: { color: '#172844', fontSize: 21, fontWeight: '800' },
  errorText: { color: '#718099', fontSize: 14, marginTop: 9, textAlign: 'center' },
  customSection: { borderRadius: 16, marginBottom: 24, padding: 22 },
  customSectionImage: { borderRadius: 12, height: 190, marginBottom: 14, width: '100%' },
  customSectionTitle: { fontSize: 22, fontWeight: '800' },
  customSectionSubtitle: { color: '#718099', fontSize: 14, marginTop: 8 },
  customSectionButton: { alignSelf: 'flex-start', backgroundColor: '#0052CC', borderRadius: 8, marginTop: 14, paddingHorizontal: 14, paddingVertical: 9 },
  customSectionButtonText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  library: { marginBottom: 32, marginTop: 26 },
  libraryCount: { color: '#718099', fontSize: 13 },
  filterRow: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 14, marginTop: 12 },
  filterInput: { backgroundColor: '#fff', borderColor: '#d8e0ea', borderRadius: 8, borderWidth: 1, color: '#172844', minHeight: 36, paddingHorizontal: 10, width: 130 },
  filterChip: { backgroundColor: '#fff', borderColor: '#d8e0ea', borderRadius: 16, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 7 },
  filterChipActive: { backgroundColor: '#dbeaff', borderColor: '#0052CC' },
  filterChipText: { color: '#52627a', fontSize: 11, fontWeight: '700' },
  libraryGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  emptyLibrary: { color: '#718099', paddingVertical: 20 },
  loadMore: { alignSelf: 'center', backgroundColor: '#0052CC', borderRadius: 10, marginTop: 20, paddingHorizontal: 18, paddingVertical: 11 },
  loadMoreText: { color: '#fff', fontSize: 13, fontWeight: '800' },
});
