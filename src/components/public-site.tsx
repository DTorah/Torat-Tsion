import { Image } from 'expo-image';
import { Link as RouterLink, useLocalSearchParams, usePathname, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';

import { getShiurSkipSeconds, useListener } from '@/components/listener-provider';
import { RangeSlider } from '@/components/slider';
import { normalizeRecordingTitle } from '@/lib/recording-title';
import { fetchPublicJson } from '@/lib/public-api-cache';
import { apiUrl, toListenerRecording } from '@/lib/public-recordings';
import { ToratWelcome } from '@/components/torat-sections';

const Link: any = RouterLink;
const neutralCover = require('@/assets/shiur-covers/fallback.png');
const toratTsionLogo = require('@/assets/images/icon.png');

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

type Recording = { id: string; name: string; title?: string; rabbiId?: string | null; rabbiName?: string | null; category?: string; categoryId?: string | null; description?: string; streamUrl: string; coverUrl?: string | null; createdTime?: string | null; recordedDateLabel?: string | null; durationSeconds?: number | null; shiurStartSeconds?: number | null; shiurSkipEnabled?: boolean };
type DriveFolder = { id: string; name: string; parentId: string };
type Rabbi = { id: string; name: string; description?: string; photoUrl?: string | null; featured?: boolean };
type Category = { id: string; name: string; description?: string };
type CarouselItem = { id: string; kind: string; title: string; subtitle?: string; coverUrl?: string | null; recordingId?: string | null; countdownAt?: string | null; link?: string | null };
type HomePayload = { recordings?: Recording[]; folders?: DriveFolder[]; rabbis?: Rabbi[]; categories?: Category[]; featuredShiurim?: Recording[]; newThisWeek?: Recording[]; trending?: Recording[]; carousel?: CarouselItem[] };
type FolderPayload = { folder?: DriveFolder; recordings?: Recording[]; folders?: DriveFolder[]; error?: string };

function Cover({ recording, large = false, mobile = false }: { recording: Recording; large?: boolean; mobile?: boolean }) {
  const coverStyle = StyleSheet.flatten([styles.cover, large && styles.coverLarge, mobile && styles.coverLargeMobile]);
  return recording.coverUrl ? <Image contentFit="cover" source={{ uri: apiUrl(recording.coverUrl) }} style={coverStyle} /> : <View style={StyleSheet.flatten([coverStyle, styles.coverFallback])}><Image source={neutralCover} style={styles.coverLogo} /><Text style={styles.coverCaption}>Audio recording</Text></View>;
}

function PublicHeader({ query, setQuery }: { query: string; setQuery: (value: string) => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const { activeRecording } = useListener();
  const { width } = useWindowDimensions();
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  const isMobile = hydrated && width < 760;
  const submitSearch = () => {
    const normalizedQuery = query.trim();
    if (normalizedQuery) router.push(`/search?q=${encodeURIComponent(normalizedQuery)}` as never);
  };
  const navItems = [
    { href: '/', label: 'Home' },
    { href: '/explore', label: 'Shiurim' },
    { href: '/videos', label: 'Videos' },
    { href: '/minyanim', label: 'Minyanim' },
    { href: '/zmanim', label: 'Zmanim' },
    { href: '/parsha', label: 'Parsha' },
    { href: '/donate', label: 'Donate' },
    { href: '/search', label: 'Search' },
    { href: '/favorites', label: 'Library' },
    { href: '/rabbis', label: 'Rabbis' },
    { href: '/categories', label: 'Categories' },
    { href: '/collections', label: 'Collections' },
    { href: '/privacy', label: 'Privacy' },
  ] as const;

  return (
    <View style={styles.header}>
      <Link href="/" asChild>
        <Pressable style={styles.brandPressable}>
          <Image accessibilityLabel="Torat Tsion logo" contentFit="contain" source={toratTsionLogo} style={styles.brandLogo} />
          <View style={styles.brandTextWrap}>
            <Text style={styles.logo}>Torat Tsion</Text>
          </View>
        </Pressable>
      </Link>

      <View style={styles.nav}>
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href === '/' && pathname === '/');
          return (
            <Link key={item.href} href={item.href as never} asChild>
              <Pressable style={StyleSheet.flatten([styles.navItem, isActive && styles.navItemActive])}>
                <Text style={[styles.navText, isActive && styles.navTextActive]}>{item.label}</Text>
              </Pressable>
            </Link>
          );
        })}
        {activeRecording && (
          <Pressable onPress={() => router.push('/player' as never)} style={styles.playerLinkButton}>
            <Text style={styles.playerLink}>Now playing</Text>
          </Pressable>
        )}
        <Link href="/admin" asChild>
          <Pressable style={styles.adminLinkButton} accessibilityLabel="Admin sign in">
            <Text style={styles.adminLinkText}>Admin</Text>
          </Pressable>
        </Link>
      </View>

      <View style={[styles.search, isMobile && styles.searchMobile]}>
        <Text style={styles.searchIcon}>⌕</Text>
        <TextInput
          accessibilityLabel="Search shiurim"
          onChangeText={setQuery}
          onSubmitEditing={submitSearch}
          placeholder="Search shiurim"
          placeholderTextColor="#7d8ca3"
          style={styles.searchInput}
          value={query}
        />
        {query.length > 0 && (
          <Pressable accessibilityLabel="Clear search" onPress={() => setQuery('')} style={styles.searchClear}>
            <Text style={styles.searchClearText}>✕</Text>
          </Pressable>
        )}
        <Pressable accessibilityLabel="Search" onPress={submitSearch} style={styles.searchSubmit}>
          <Text style={styles.searchSubmitText}>Search</Text>
        </Pressable>
      </View>
    </View>
  );
}

function SectionTitle({ title, link }: { title: string; link?: string }) {
  return <View style={styles.sectionTitleRow}><Text style={styles.sectionTitle}>{title}</Text>{link && <Link href={link as never}><Text style={styles.viewAll}>View all</Text></Link>}</View>;
}

function RecordingCard({ recording }: { recording: Recording }) {
  const { play, player, activeRecording, status, isFavorite, toggleFavorite, addToQueue } = useListener();
  const active = activeRecording?.id === recording.id;
  const recordingListener = toListenerRecording(recording);
  const skipSeconds = getShiurSkipSeconds(recordingListener);
  const skipToShiur = () => {
    if (skipSeconds === null) return;
    if (active) {
      player.seekTo(skipSeconds);
      if (!status.playing) player.play();
      return;
    }
    play(recordingListener, [recordingListener], skipSeconds);
  };

  return (
    <View style={styles.recordingCard}>
      <Link href={`/recordings/${recording.id}` as never} asChild>
        <Pressable>
          <Cover recording={recording} />
        </Pressable>
      </Link>

      <View style={styles.cardBody}>
        <Text style={styles.cardCategory}>{recording.category || 'Torah'}</Text>
        <Text numberOfLines={4} style={styles.cardTitle}>{normalizeRecordingTitle(recording.title || recording.name, recording.recordedDateLabel || '')}</Text>
        <Text numberOfLines={1} style={styles.cardMeta}>{recording.rabbiName || 'Torat Tsion'}{recording.durationSeconds ? ` · ${formatDuration(recording.durationSeconds)}` : ''}</Text>
        <View style={styles.cardActions}>
          <Pressable
            accessibilityLabel={`${active && status.playing ? 'Pause' : 'Play'} ${normalizeRecordingTitle(recording.title || recording.name, recording.recordedDateLabel || '')}`}
            onPress={() => play(recordingListener, [recordingListener])}
            style={styles.cardPlay}
          >
            <Text style={styles.playIcon}>{active && status.playing ? 'Ⅱ' : '▶'}</Text>
          </Pressable>
          {skipSeconds !== null && <Pressable accessibilityLabel={`Skip to Shiur at ${formatDuration(skipSeconds)}`} onPress={skipToShiur} style={styles.cardSkip}><Text style={styles.cardSkipText}>Skip to Shiur</Text></Pressable>}

          <Pressable accessibilityLabel={isFavorite(recording.id) ? 'Remove from favorites' : 'Add to favorites'} onPress={() => toggleFavorite(recording.id)}>
            <Text style={styles.favorite}>{isFavorite(recording.id) ? '★' : '☆'}</Text>
          </Pressable>

          <Pressable accessibilityLabel="Add to queue" onPress={() => addToQueue(recordingListener)}>
            <Text style={styles.queue}>＋</Text>
          </Pressable>

          <Pressable accessibilityLabel="Download recording" onPress={() => triggerDownload(recording.id, normalizeRecordingTitle(recording.title || recording.name, recording.recordedDateLabel || ''))}>
            <Text style={styles.download}>↓</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function formatDuration(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '';
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
}

function formatMinutesLabel(value: number) {
  const minutes = Math.max(0, Math.round(value));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (remainder === 0) return hours === 1 ? '1 hr' : `${hours} hr`;
  return `${hours === 1 ? '1 hr' : `${hours} hr`} ${remainder} min`;
}

function TimeFrameBuilder({ recordings }: { recordings: Recording[] }) {
  const [minutes, setMinutes] = useState(35);
  const [results, setResults] = useState<Recording[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchMessage, setSearchMessage] = useState<string | null>(null);

  const build = async () => {
    setIsSearching(true);
    setSearchMessage(null);
    try {
      const response = await fetch(apiUrl(`/api/time-frame?minutes=${minutes}`));
      const payload = await response.json() as { recordings?: Recording[]; durationPendingCount?: number; error?: string };
      if (!response.ok) throw new Error(payload.error || 'Unable to find recordings for this time frame');
      const matches = payload.recordings || [];
      setResults(matches);
      if (payload.durationPendingCount) {
        setSearchMessage(`${matches.length ? `${matches.length} matching recordings found. ` : ''}${payload.durationPendingCount} recordings are still being analyzed for duration and will appear after analysis completes.`);
      } else if (!matches.length) {
        setSearchMessage('No recordings found near this length.');
      }
    } catch (reason) {
      setResults([]);
      setSearchMessage(reason instanceof Error ? reason.message : 'Unable to find recordings for this time frame');
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <View style={styles.sessionCard}>
      <Text style={styles.sessionEyebrow}>TIME FRAME</Text>
      <Text style={styles.sessionTitle}>Build My Listening Session</Text>
      <Text style={styles.sessionDescription}>{formatMinutesLabel(minutes)} available</Text>
      <RangeSlider
        value={minutes}
        min={5}
        max={120}
        step={1}
        onChange={setMinutes}
        label="How much time do you have?"
        showValue
        formatter={(value) => formatMinutesLabel(value)}
        trackStyle={styles.timeTrack}
        fillStyle={styles.timeFill}
        thumbStyle={styles.timeThumb}
        labelStyle={styles.sessionSliderLabel}
        valueStyle={styles.sessionSliderValue}
      />
      <Pressable disabled={isSearching} onPress={() => void build()} style={[styles.sessionButton, isSearching && styles.sessionButtonDisabled]}>
        <Text style={styles.sessionButtonText}>{isSearching ? 'Finding recordings…' : 'Find recordings'}</Text>
      </Pressable>
      {results.length > 0 && (
        <>
          <Text style={styles.sessionResult}>Shiurim near {formatMinutesLabel(minutes)}</Text>
          <View style={styles.timeFrameResults}>
            {results.map((recording) => <RecordingCard key={recording.id} recording={recording} />)}
          </View>
        </>
      )}
      {searchMessage && <Text style={styles.sessionHint}>{searchMessage}</Text>}
    </View>
  );
}

function Shelf({ title, recordings, link, prominent = false }: { title: string; recordings: Recording[]; link?: string; prominent?: boolean }) {
  if (!recordings.length) return null;
  return <View style={[styles.section, prominent && styles.featuredSection]}><SectionTitle title={title} link={link} /><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.shelf}>{recordings.map((recording) => <RecordingCard key={recording.id} recording={recording} />)}</ScrollView></View>;
}

function useCountdownLabel(countdownAt?: string | null) {
  const [label, setLabel] = useState<string | null>(null);
  useEffect(() => {
    if (!countdownAt) { setLabel(null); return; }
    const target = new Date(countdownAt).getTime();
    if (Number.isNaN(target)) { setLabel(null); return; }
    const tick = () => {
      const diffMs = target - Date.now();
      if (diffMs <= 0) { setLabel(null); return; }
      const totalMinutes = Math.floor(diffMs / 60000);
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      setLabel(hours > 0 ? `Starts in ${hours}h ${minutes}m` : `Starts in ${minutes}m`);
    };
    tick();
    const interval = setInterval(tick, 30000);
    return () => clearInterval(interval);
  }, [countdownAt]);
  return label;
}

function CarouselCard({ item }: { item: CarouselItem }) {
  const countdown = useCountdownLabel(item.countdownAt);
  const card = <Pressable style={carouselStyles.card}>
    {item.coverUrl ? <Image contentFit="cover" source={{ uri: apiUrl(item.coverUrl) }} style={carouselStyles.cardCover} /> : <View style={[carouselStyles.cardCover, carouselStyles.cardCoverFallback]}><Image source={neutralCover} style={carouselStyles.cardCoverLogo} /></View>}
    {countdown && <View style={carouselStyles.countdownBadge}><Text style={carouselStyles.countdownText}>{countdown}</Text></View>}
    <View style={carouselStyles.cardBody}>
      <Text numberOfLines={2} style={carouselStyles.cardTitle}>{item.title}</Text>
      {Boolean(item.subtitle) && <Text numberOfLines={1} style={carouselStyles.cardSubtitle}>{item.subtitle}</Text>}
    </View>
  </Pressable>;
  return item.link ? <Link href={item.link as never} asChild>{card}</Link> : card;
}

const CAROUSEL_CARD_WIDTH = 224;

function ContentCarousel({ items }: { items: CarouselItem[] }) {
  const scrollRef = useRef<ScrollView>(null);
  const indexRef = useRef(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (!items.length || paused) return;
    const interval = setInterval(() => {
      indexRef.current = (indexRef.current + 1) % items.length;
      scrollRef.current?.scrollTo({ x: indexRef.current * CAROUSEL_CARD_WIDTH, animated: true });
    }, 5000);
    return () => clearInterval(interval);
  }, [items.length, paused]);
  if (!items.length) return null;
  const scrollBy = (direction: 1 | -1) => {
    indexRef.current = Math.max(0, Math.min(items.length - 1, indexRef.current + direction));
    scrollRef.current?.scrollTo({ x: indexRef.current * CAROUSEL_CARD_WIDTH, animated: true });
  };
  return <View style={carouselStyles.section} {...({ onMouseEnter: () => setPaused(true), onMouseLeave: () => setPaused(false) } as object)}>
    <Pressable accessibilityLabel="Previous" onPress={() => scrollBy(-1)} style={[carouselStyles.arrow, carouselStyles.arrowLeft]}><Text style={carouselStyles.arrowText}>‹</Text></Pressable>
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={carouselStyles.track}
      onTouchStart={() => setPaused(true)}
      onScrollBeginDrag={() => setPaused(true)}
      onMomentumScrollEnd={(event) => {
        indexRef.current = Math.round(event.nativeEvent.contentOffset.x / CAROUSEL_CARD_WIDTH);
        setPaused(false);
      }}
    >
      {items.map((item) => <CarouselCard item={item} key={item.id} />)}
    </ScrollView>
    <Pressable accessibilityLabel="Next" onPress={() => scrollBy(1)} style={[carouselStyles.arrow, carouselStyles.arrowRight]}><Text style={carouselStyles.arrowText}>›</Text></Pressable>
  </View>;
}

const carouselStyles = StyleSheet.create({
  section: { alignItems: 'center', flexDirection: 'row', marginTop: 4, position: 'relative' },
  track: { gap: 12, paddingHorizontal: 4, paddingVertical: 4 },
  card: { backgroundColor: '#ffffff', borderColor: '#dfeaf7', borderRadius: 16, borderWidth: 1, overflow: 'hidden', width: 212 },
  cardCover: { backgroundColor: '#dfeaf7', height: 118, width: '100%' },
  cardCoverFallback: { alignItems: 'center', justifyContent: 'center' },
  cardCoverLogo: { height: 40, opacity: 0.5, width: 40 },
  cardBody: { padding: 10 },
  cardTitle: { color: '#142950', fontSize: 13, fontWeight: '700' },
  cardSubtitle: { color: '#5b6e8d', fontSize: 11, marginTop: 4 },
  countdownBadge: { backgroundColor: 'rgba(20,41,80,0.85)', borderRadius: 8, left: 8, paddingHorizontal: 8, paddingVertical: 3, position: 'absolute', top: 8 },
  countdownText: { color: '#ffffff', fontSize: 10, fontWeight: '700' },
  arrow: { alignItems: 'center', backgroundColor: '#ffffff', borderColor: '#dfeaf7', borderRadius: 18, borderWidth: 1, height: 36, justifyContent: 'center', width: 36, zIndex: 2 },
  arrowLeft: { marginRight: -18 },
  arrowRight: { marginLeft: -18 },
  arrowText: { color: '#2d6cdf', fontSize: 18, fontWeight: '800' },
});

function RabbiCard({ rabbi }: { rabbi: Rabbi }) {
  return <Link href={`/rabbis/${rabbi.id}` as never} asChild><Pressable style={styles.rabbiCard}>{rabbi.photoUrl ? <Image contentFit="cover" source={{ uri: apiUrl(rabbi.photoUrl) }} style={styles.rabbiPhoto} /> : <View style={[styles.rabbiPhoto, styles.rabbiFallback]}><Text style={styles.rabbiInitials}>{rabbi.name.slice(0, 2).toUpperCase()}</Text></View>}<Text numberOfLines={1} style={styles.rabbiName}>{rabbi.name}</Text><Text numberOfLines={2} style={styles.rabbiDescription}>{rabbi.description || 'Explore this Rabbi\'s shiurim'}</Text></Pressable></Link>;
}

function FolderCard({ folder, onPress }: { folder: DriveFolder; onPress: () => void }) {
  return <Pressable accessibilityLabel={`Open Rabbi profile ${folder.name}`} onPress={onPress} style={folderStyles.folderCard}><Text style={folderStyles.folderIcon}>◉</Text><Text numberOfLines={2} style={folderStyles.folderName}>{folder.name}</Text><Text style={folderStyles.folderDescription}>Rabbi profile · recordings</Text></Pressable>;
}

function FolderSection({ folders, onOpen }: { folders: DriveFolder[]; onOpen: (folder: DriveFolder) => void }) {
  if (!folders.length) return null;
  return <View style={styles.section}><SectionTitle title="Recordings" /><View style={folderStyles.folderGrid}>{folders.map((folder) => <FolderCard key={folder.id} folder={folder} onPress={() => onOpen(folder)} />)}</View></View>;
}

function PublicFolderView({ folderId }: { folderId: string }) {
  const router = useRouter();
  const [payload, setPayload] = useState<FolderPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { setPayload(null); setError(null); fetch(apiUrl(`/api/recordings/folder/${encodeURIComponent(folderId)}`)).then(async (response) => { const value = await response.json() as FolderPayload; if (!response.ok) throw new Error(value.error || 'Unable to load the folder'); setPayload(value); }).catch((reason) => setError(reason instanceof Error ? reason.message : 'Unable to load the folder')); }, [folderId]);
  const openFolder = (folder: DriveFolder) => router.push(`/?folder=${encodeURIComponent(folder.id)}` as never);
  return <ScrollView style={styles.page} contentContainerStyle={styles.pageContent}><View style={styles.shell}><PublicHeader query="" setQuery={() => {}} /><Pressable accessibilityLabel="Back to recordings" onPress={() => router.back()} style={folderStyles.backButton}><Text style={folderStyles.backText}>← Back</Text></Pressable>{!payload && !error && <View style={styles.state}><ActivityIndicator color="#2d6cdf" size="large" /></View>}{error && <View style={styles.state}><Text style={styles.stateTitle}>The folder is unavailable</Text><Text style={styles.stateText}>{error}</Text></View>}{payload && <><Text style={styles.pageEyebrow}>RECORDINGS</Text><Text style={styles.pageTitle}>{payload.folder?.name || 'Folder'}</Text>{Boolean(payload.folders?.length) && <View style={styles.section}><SectionTitle title="Folders" /><View style={folderStyles.folderGrid}>{payload.folders?.map((folder) => <FolderCard key={folder.id} folder={folder} onPress={() => openFolder(folder)} />)}</View></View>}<View style={styles.section}><SectionTitle title="Recordings" /><View style={styles.recordingGrid}>{(payload.recordings || []).map((recording) => <RecordingCard key={recording.id} recording={recording} />)}</View>{!payload.recordings?.length && !payload.folders?.length && <Text style={styles.stateText}>This folder is empty.</Text>}</View></>}</View></ScrollView>;
}

const folderStyles = StyleSheet.create({ backButton: { marginTop: 28 }, backText: { color: '#1d4ea8', fontSize: 14, fontWeight: '700' }, folderGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 18 }, folderCard: { backgroundColor: '#ffffff', borderColor: '#dfeaf7', borderRadius: 16, borderWidth: 1, minHeight: 118, padding: 16, width: 220 }, folderIcon: { color: '#2d6cdf', fontSize: 22, fontWeight: '800' }, folderName: { color: '#142950', fontSize: 18, fontWeight: '700', marginTop: 12 }, folderDescription: { color: '#6a7e9b', fontSize: 12, marginTop: 6 } });

export function PublicHome() {
  const [payload, setPayload] = useState<HomePayload | null>(null);
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [lazyError, setLazyError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { positions } = useListener();
  const { width } = useWindowDimensions();
  const [hydrated, setHydrated] = useState(false);
  const fullHomeRequested = useRef(false);
  const folderParam = useLocalSearchParams<{ folder?: string }>().folder;
  const folderId = Array.isArray(folderParam) ? folderParam[0] : folderParam;
  useEffect(() => setHydrated(true), []);
  useEffect(() => { if (folderId) return; fetchPublicJson<HomePayload>('/api/home?summary=1').then(setPayload).catch((reason) => setError(reason instanceof Error ? reason.message : 'Unable to load the library')).finally(() => setLoading(false)); }, [folderId]);
  const router = useRouter();
  const loadRemainingHome = () => {
    if (fullHomeRequested.current) return;
    fullHomeRequested.current = true;
    fetchPublicJson<HomePayload>('/api/home').then(setPayload).catch((reason) => {
      fullHomeRequested.current = false;
      setLazyError(reason instanceof Error ? reason.message : 'Unable to load additional recordings');
    });
  };
  const recordings = payload?.recordings || [];
  const continueListening = useMemo(() => Object.keys(positions).sort((a, b) => positions[b] - positions[a]).map((id) => recordings.find((recording) => recording.id === id)).filter((recording): recording is Recording => Boolean(recording)), [positions, recordings]);
  const featuredShiurim = payload?.featuredShiurim || [];
  if (folderId) return <PublicFolderView folderId={folderId} />;
  const isNarrow = hydrated && width < 600;
  return <ScrollView style={styles.page} contentContainerStyle={styles.pageContent} scrollEventThrottle={500} onScroll={({ nativeEvent }) => {
    const { contentOffset, contentSize, layoutMeasurement } = nativeEvent;
    if (contentOffset.y + layoutMeasurement.height >= contentSize.height - 500) loadRemainingHome();
  }}><View style={[styles.shell, isNarrow && styles.shellMobile]}>
    <PublicHeader query={query} setQuery={setQuery} />
    <ToratWelcome />
    {loading ? <View style={styles.state}><ActivityIndicator color="#2d6cdf" size="large" /><Text style={styles.stateText}>Loading the library</Text></View> : error ? <View style={styles.state}><Text style={styles.stateTitle}>The library is unavailable</Text><Text style={styles.stateText}>{error}</Text></View> : <>
      <Shelf title="Featured Shiurim" recordings={featuredShiurim} prominent />

      {/* TOP: content carousel — live/upcoming when curated by Admin, otherwise recently added */}
      {Boolean(payload?.carousel?.length) && <View style={styles.section}><SectionTitle title="Live & Recent" /><ContentCarousel items={payload?.carousel || []} /></View>}

      {/* MIDDLE: Rabbis, then Time Frame */}
      {Boolean(payload?.rabbis?.length) ? <View style={styles.section}><SectionTitle title="Rabbis" link="/rabbis" /><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.shelf}>{(payload?.rabbis || []).map((rabbi) => <RabbiCard key={rabbi.id} rabbi={rabbi} />)}</ScrollView></View> : <FolderSection folders={payload?.folders || []} onOpen={(folder) => router.push(`/?folder=${encodeURIComponent(folder.id)}` as never)} />}
      <TimeFrameBuilder recordings={recordings} />
      <View style={styles.section}><SectionTitle title="Explore Categories" link="/categories" /><View style={styles.categoryGrid}>{(payload?.categories || []).map((category) => <Link key={category.id} href={`/categories/${category.id}`} asChild><Pressable style={styles.categoryCard}><Text style={styles.categoryName}>{category.name}</Text><Text numberOfLines={2} style={styles.categoryDescription}>{category.description || 'Browse shiurim'}</Text></Pressable></Link>)}</View></View>
      <Shelf title="Continue Listening" recordings={continueListening} />
      <Shelf title="New This Week" recordings={payload?.newThisWeek || []} />
      <Shelf title="Trending" recordings={payload?.trending || []} />
      {lazyError && <View style={styles.state}><Text style={styles.stateText}>{lazyError}</Text><Pressable onPress={() => { fullHomeRequested.current = false; setLazyError(null); loadRemainingHome(); }}><Text style={{ color: '#1d4ea8', fontWeight: '700' }}>Load recordings</Text></Pressable></View>}

    </>}
  </View></ScrollView>;
}

export function PublicRecordingList({ title, description, recordings }: { title: string; description?: string; recordings: Recording[] }) {
  return <ScrollView style={styles.page} contentContainerStyle={styles.pageContent}><View style={styles.shell}><PublicHeader query="" setQuery={() => {}} /><Text style={styles.pageEyebrow}>Torat Tsion</Text><Text style={styles.pageTitle}>{title}</Text>{description && <Text style={styles.pageDescription}>{description}</Text>}<View style={styles.recordingGrid}>{recordings.map((recording) => <RecordingCard key={recording.id} recording={recording} />)}</View>{!recordings.length && <Text style={styles.stateText}>No recordings found.</Text>}</View></ScrollView>;
}

export function PublicDirectory({ title, description, items, kind }: { title: string; description: string; items: Array<Rabbi | Category>; kind: 'rabbi' | 'category' | 'collection' }) {
  return <ScrollView style={styles.page} contentContainerStyle={styles.pageContent}><View style={styles.shell}><PublicHeader query="" setQuery={() => {}} /><Text style={styles.pageEyebrow}>SHIVTI</Text><Text style={styles.pageTitle}>{title}</Text><Text style={styles.pageDescription}>{description}</Text>{kind === 'rabbi' ? <View style={styles.rabbiGrid}>{items.map((item) => <RabbiCard key={item.id} rabbi={item as Rabbi} />)}</View> : <View style={styles.categoryGrid}>{items.map((item) => <Link key={item.id} href={(kind === 'category' ? `/categories/${item.id}` : `/collections/${item.id}`) as never} asChild><Pressable style={styles.categoryCard}><Text style={styles.categoryName}>{item.name}</Text><Text numberOfLines={3} style={styles.categoryDescription}>{item.description || (kind === 'category' ? 'Browse shiurim in this category' : 'Listen to this collection')}</Text></Pressable></Link>)}</View>}</View></ScrollView>;
}

export function PublicPrivacyPolicy() {
  const [query, setQuery] = useState('');
  return <ScrollView style={styles.page} contentContainerStyle={styles.pageContent}><View style={styles.shell}>
    <PublicHeader query={query} setQuery={setQuery} />
    <View style={styles.privacyHero}>
      <Text style={styles.pageEyebrow}>SHIVTI</Text>
      <Text style={styles.pageTitle}>Privacy Policy</Text>
      <Text style={styles.pageDescription}>Last updated: October 1, 2026</Text>
    </View>
    <View style={styles.privacyCard}>
      <Text style={styles.privacyLead}>Torat Tsion is a Torah listening service. This policy explains how the Torat Tsion website and Android app handle information when you listen to recordings or use the optional Admin tools.</Text>

      <PrivacySection title="Information Torat Tsion uses">
        <Text style={styles.privacyText}>Public listening does not require an account. Torat Tsion does not ask public listeners for a name, email address, phone number, or payment information.</Text>
        <Text style={styles.privacyText}>The app stores your favorites, playlists, recently played recording IDs, listening positions, and playback-rate preference locally on your device or browser. This information stays in your local app or browser storage and is not sent to Torat Tsion as part of normal listening.</Text>
      </PrivacySection>

      <PrivacySection title="Audio recordings and playback">
        <Text style={styles.privacyText}>Torah recordings and folder information are provided from the Torat Tsion recordings library hosted in Google Drive. When you play or download a recording, Torat Tsion's backend retrieves and streams the selected audio to your device. Audio streaming supports byte-range requests so playback can seek efficiently.</Text>
        <Text style={styles.privacyText}>The backend may record an aggregate play count for a recording. This count is associated with the recording, not with a public listener account or profile.</Text>
      </PrivacySection>

      <PrivacySection title="Admin access">
        <Text style={styles.privacyText}>Admin tools are limited to authorized content managers. An Admin username and password are used only to authenticate access to Admin functions. On the web, Torat Tsion uses a signed, time-limited Admin session cookie and browser session storage to keep an authorized Admin signed in while navigating Admin pages.</Text>
        <Text style={styles.privacyText}>Admin-created content settings, including recording metadata, categories, Featured selections, Carousel items, and uploaded Rabbi or recording covers, are retained by the backend so they can be shown in the service.</Text>
      </PrivacySection>

      <PrivacySection title="Cookies and local storage">
        <Text style={styles.privacyText}>Public listening features use local device or browser storage for the preferences listed above. The public site does not use advertising cookies. Admin sessions use a necessary authentication cookie and browser session storage; signing out or closing the applicable session removes access, and the server-issued session expires automatically.</Text>
      </PrivacySection>

      <PrivacySection title="Analytics and advertising">
        <Text style={styles.privacyText}>The current Torat Tsion application code does not include advertising networks, behavioral advertising, or third-party analytics SDKs. Torat Tsion does not sell personal information.</Text>
      </PrivacySection>

      <PrivacySection title="Third-party services">
        <Text style={styles.privacyText}>Torat Tsion uses Google Drive as the source for recordings and Render to host the backend that serves the application's API and audio streams. These providers may process technical connection information necessary to deliver their services under their own policies.</Text>
      </PrivacySection>

      <PrivacySection title="Data security, retention, and deletion">
        <Text style={styles.privacyText}>Torat Tsion keeps Google Drive service-account credentials on the server only; they are not included in the public website or Android app. Local listening preferences remain until you clear app data, browser site data, or uninstall the app. Admin session access expires automatically. Admin content and covers are retained until an authorized Admin changes or removes them, subject to the backend's configured storage lifecycle.</Text>
      </PrivacySection>

      <PrivacySection title="Children's privacy">
        <Text style={styles.privacyText}>Torat Tsion is not directed at collecting personal information from children. Because public listening does not require a public account or personal information, Torat Tsion does not knowingly collect personal information from children through normal use of the service.</Text>
      </PrivacySection>

      <PrivacySection title="Changes to this policy">
        <Text style={styles.privacyText}>Torat Tsion may update this Privacy Policy when the service or applicable requirements change. The current version will be posted on this page with an updated effective date.</Text>
      </PrivacySection>

      <PrivacySection title="Contact">
        <Text style={styles.privacyText}>For privacy questions or requests, use the Torat Tsion project support channel on GitHub.</Text>
        <Link href="https://github.com/DTorah/Darchei-Torah/issues" asChild><Pressable accessibilityLabel="Contact Torat Tsion privacy support on GitHub" style={styles.privacyContact}><Text style={styles.privacyContactText}>Open Torat Tsion support on GitHub</Text></Pressable></Link>
      </PrivacySection>
    </View>
  </View></ScrollView>;
}

function PrivacySection({ title, children }: { title: string; children: ReactNode }) {
  return <View style={styles.privacySection}><Text style={styles.privacyHeading}>{title}</Text>{children}</View>;
}

const styles = StyleSheet.create({
  page: { backgroundColor: '#f4f8ff', flex: 1 },
  pageContent: { paddingBottom: 100 },
  shell: { alignSelf: 'center', maxWidth: 1240, paddingHorizontal: 28, width: '100%' },
  shellMobile: { paddingHorizontal: 18 },
  privacyHero: { marginTop: 38, maxWidth: 800 },
  privacyCard: { backgroundColor: '#ffffff', borderColor: '#dfeaf7', borderRadius: 20, borderWidth: 1, marginTop: 22, maxWidth: 920, padding: 26 },
  privacyLead: { color: '#415678', fontSize: 16, lineHeight: 25 },
  privacySection: { borderTopColor: '#e7f0fc', borderTopWidth: 1, marginTop: 24, paddingTop: 24 },
  privacyHeading: { color: '#142950', fontSize: 18, fontWeight: '800', marginBottom: 9 },
  privacyText: { color: '#415678', fontSize: 14, lineHeight: 23, marginTop: 8 },
  privacyContact: { alignSelf: 'flex-start', backgroundColor: '#eaf3ff', borderRadius: 999, marginTop: 14, paddingHorizontal: 14, paddingVertical: 10 },
  privacyContactText: { color: '#1d4ea8', fontSize: 13, fontWeight: '800' },
  sessionCard: { backgroundColor: '#ffffff', borderColor: '#dfeaf7', borderRadius: 18, borderWidth: 1, marginTop: 24, padding: 18 },
  sessionEyebrow: { color: '#2d6cdf', fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  sessionTitle: { color: '#142950', fontSize: 22, fontWeight: '800', marginTop: 6 },
  sessionDescription: { color: '#5b6e8d', fontSize: 14, marginTop: 5 },
  sessionOptions: { gap: 7, paddingVertical: 14 },
  sessionOption: { backgroundColor: '#f4f8ff', borderColor: '#dfeaf7', borderRadius: 10, borderWidth: 1, paddingHorizontal: 11, paddingVertical: 8 },
  sessionOptionActive: { backgroundColor: '#2d6cdf', borderColor: '#2d6cdf' },
  sessionOptionText: { color: '#1d4ea8', fontSize: 12, fontWeight: '700' },
  sessionOptionTextActive: { color: '#ffffff' },
  sessionButton: { alignItems: 'center', backgroundColor: '#142950', borderRadius: 10, minHeight: 44, justifyContent: 'center', paddingHorizontal: 16 },
  sessionButtonDisabled: { opacity: 0.65 },
  sessionButtonText: { color: '#ffffff', fontSize: 13, fontWeight: '800' },
  sessionResult: { color: '#2d6cdf', fontSize: 13, fontWeight: '700', marginTop: 14 },
  sessionList: { marginTop: 8 },
  timeFrameResults: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 12 },
  sessionItem: { color: '#415678', fontSize: 12, marginTop: 5 },
  sessionPlay: { alignSelf: 'flex-start', borderColor: '#cfe0ff', borderRadius: 10, borderWidth: 1, marginTop: 12, paddingHorizontal: 14, paddingVertical: 9 },
  sessionPlayText: { color: '#1d4ea8', fontSize: 12, fontWeight: '800' },
  sessionHint: { color: '#7d8ca3', fontSize: 12, marginTop: 12 },
  sessionSliderLabel: { color: '#142950', fontSize: 12, fontWeight: '700' },
  sessionSliderValue: { color: '#2d6cdf', fontSize: 13, fontWeight: '800' },
  timeTrack: { backgroundColor: '#dfeaf7', borderRadius: 999, height: 16, marginTop: 12 },
  timeFill: { backgroundColor: '#2d6cdf', borderRadius: 999 },
  timeThumb: { backgroundColor: '#ffffff', borderColor: '#2d6cdf', borderWidth: 3 },
  header: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderBottomColor: '#dfeaf7',
    borderBottomWidth: 1,
    borderRadius: 18,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginTop: 18,
    minHeight: 92,
    paddingHorizontal: 18,
    paddingVertical: 16,
    shadowColor: '#7a9bc4',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
  },
  brandPressable: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  brandLogo: { borderRadius: 14, height: 52, width: 52 },
  brandTextWrap: { alignItems: 'flex-start', flexDirection: 'row', flexWrap: 'wrap' },
  logo: { color: '#142950', fontSize: 22, fontWeight: '800', letterSpacing: 0.2 },
  tagline: { color: '#7d8ca3', fontSize: 11, marginTop: 2 },
  nav: { alignItems: 'center', flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginHorizontal: 8 },
  navItem: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  navItemActive: { backgroundColor: '#eaf3ff' },
  navText: { color: '#415678', fontSize: 13, fontWeight: '600' },
  navTextActive: { color: '#1d4ea8', fontWeight: '700' },
  playerLinkButton: { borderColor: '#cfe0ff', borderRadius: 999, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8 },
  playerLink: { color: '#1d4ea8', fontSize: 12, fontWeight: '700' },
  adminLinkButton: { paddingHorizontal: 12, paddingVertical: 8 },
  adminLinkText: { color: '#8598b8', fontSize: 12, fontWeight: '700' },
  search: { alignItems: 'center', backgroundColor: '#eef4fd', borderRadius: 999, flexDirection: 'row', height: 46, paddingHorizontal: 16, width: 240 },
  searchMobile: { flexBasis: '100%', width: '100%' },
  searchIcon: { color: '#7d8ca3', fontSize: 18, marginRight: 8 },
  searchInput: { color: '#142950', flex: 1, fontSize: 13, outlineStyle: 'none' as never },
  searchClear: { alignItems: 'center', backgroundColor: '#dbe6f6', borderRadius: 999, height: 20, justifyContent: 'center', marginRight: 6, width: 20 },
  searchClearText: { color: '#5b6e8d', fontSize: 11, fontWeight: '700' },
  searchSubmit: { backgroundColor: '#2d6cdf', borderRadius: 999, marginLeft: 6, paddingHorizontal: 14, paddingVertical: 8 },
  searchSubmitText: { color: '#ffffff', fontSize: 11, fontWeight: '800' },
  hero: {
    backgroundColor: '#edf5ff',
    borderColor: '#dfeaf7',
    borderRadius: 28,
    borderWidth: 1,
    flexDirection: 'row',
    marginTop: 32,
    minHeight: 250,
    overflow: 'hidden',
    shadowColor: '#7a9bc4',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
  },
  heroCompact: { minHeight: 240 },
  featuredPlay: { alignSelf: 'flex-start', backgroundColor: '#142950', borderRadius: 10, marginTop: 14, paddingHorizontal: 14, paddingVertical: 10 },
  featuredPlayText: { color: '#ffffff', fontSize: 12, fontWeight: '800' },
  heroMobile: { flexDirection: 'column' },
  cover: { backgroundColor: '#dfeaf7', height: 154, width: 154 },
  coverLarge: { height: '100%', minHeight: 250, width: '34%' },
  coverLargeMobile: { minHeight: 210, width: '100%' },
  coverFallback: { alignItems: 'center', backgroundColor: '#edf5ff', justifyContent: 'center' },
  coverLogo: { height: 52, width: 52 },
  coverMark: { color: '#2d6cdf', fontFamily: 'serif', fontSize: 44, fontWeight: '700' },
  coverCaption: { color: '#1f3f75', fontSize: 10, marginTop: 8 },
  heroCopy: { flex: 1, justifyContent: 'center', padding: 38 },
  heroCopyMobile: { padding: 24 },
  heroTitle: { color: '#142950', fontSize: 31, fontWeight: '800', lineHeight: 37, marginTop: 12 },
  heroTitleMobile: { fontSize: 27, lineHeight: 33 },
  eyebrow: { color: '#2d6cdf', fontSize: 11, fontWeight: '800', letterSpacing: 1.7 },
  heroMeta: { color: '#4c688d', fontSize: 14, marginTop: 12 },
  heroDescription: { color: '#415678', fontSize: 15, lineHeight: 23, marginTop: 16, maxWidth: 540 },
  heroAction: { marginTop: 20 },
  section: { marginTop: 42 },
  featuredSection: { backgroundColor: '#eaf3ff', borderColor: '#c9dcf6', borderRadius: 22, borderWidth: 1, marginTop: 28, padding: 18 },
  sectionTitleRow: { alignItems: 'baseline', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  sectionTitle: { color: '#142950', fontSize: 25, fontWeight: '800' },
  viewAll: { color: '#2d6cdf', fontSize: 12, fontWeight: '700' },
  shelf: { gap: 16, paddingVertical: 6 },
  recordingCard: {
    backgroundColor: '#ffffff',
    borderColor: '#dfeaf7',
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    width: 220,
    shadowColor: '#b9cfe8',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
  },
  cardBody: { minHeight: 138, padding: 14 },
  cardCategory: { color: '#2d6cdf', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  cardTitle: { color: '#142950', fontSize: 17, fontWeight: '700', lineHeight: 21, marginTop: 7 },
  cardMeta: { color: '#6a7e9b', fontSize: 12, marginTop: 6 },
  cardDate: { color: '#6a7e9b', fontSize: 11, marginTop: 5 },
  cardSkip: { backgroundColor: '#edf5ff', borderColor: '#bfd4ff', borderRadius: 999, borderWidth: 1, paddingHorizontal: 9, paddingVertical: 7 },
  cardSkipText: { color: '#1d4ea8', fontSize: 10, fontWeight: '800' },
  cardActions: { alignItems: 'center', flexDirection: 'row', gap: 14 },
  cardPlay: { alignItems: 'center', backgroundColor: '#2d6cdf', borderRadius: 999, height: 36, justifyContent: 'center', marginTop: 10, width: 36 },
  favorite: { color: '#2d6cdf', fontSize: 22, marginTop: 9 },
  queue: { color: '#4c688d', fontSize: 22, marginTop: 8 },
  download: { color: '#1d4ea8', fontSize: 20, marginTop: 8 },
  playIcon: { color: '#ffffff', fontSize: 11, fontWeight: '800' },
  rabbiCard: {
    backgroundColor: '#ffffff',
    borderColor: '#dfeaf7',
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    width: 210,
    shadowColor: '#b9cfe8',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
  },
  rabbiPhoto: { backgroundColor: '#dfeaf7', height: 142, width: '100%' },
  rabbiFallback: { alignItems: 'center', justifyContent: 'center' },
  rabbiInitials: { color: '#2d6cdf', fontSize: 38, fontWeight: '800' },
  rabbiName: { color: '#142950', fontSize: 18, fontWeight: '700', marginTop: 11 },
  rabbiDescription: { color: '#6a7e9b', fontSize: 12, lineHeight: 17, marginTop: 4 },
  rabbiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 18 },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 18 },
  categoryCard: { backgroundColor: '#ffffff', borderColor: '#dfeaf7', borderLeftColor: '#2d6cdf', borderLeftWidth: 3, borderRadius: 16, borderWidth: 1, minHeight: 88, padding: 16, width: 220 },
  categoryName: { color: '#142950', fontSize: 18, fontWeight: '700' },
  categoryDescription: { color: '#5b6e8d', fontSize: 12, marginTop: 8 },
  recordingGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 28 },
  pageEyebrow: { color: '#2d6cdf', fontSize: 11, fontWeight: '800', letterSpacing: 1.7, marginTop: 44 },
  pageTitle: { color: '#142950', fontSize: 42, fontWeight: '800', marginTop: 8 },
  pageDescription: { color: '#5b6e8d', fontSize: 15, lineHeight: 23, marginTop: 12, maxWidth: 650 },
  state: { alignItems: 'center', minHeight: 360, justifyContent: 'center' },
  stateTitle: { color: '#142950', fontSize: 24, fontWeight: '800', marginTop: 15 },
  stateText: { color: '#5b6e8d', fontSize: 14, marginTop: 12, textAlign: 'center' },
});