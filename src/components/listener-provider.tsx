import { useAudioPlayer, useAudioPlayerStatus, type AudioSource } from 'expo-audio';
import { usePathname, useRouter } from 'expo-router';
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import { readStored, listenerStorageKeys, writeStored } from '@/lib/listener-storage';

export type ListenerRecording = {
  id: string;
  title: string;
  speaker: string;
  category: string;
  source: AudioSource;
  coverUrl: string | null;
  coverAsset: number;
  date?: string;
  description?: string;
  durationSeconds?: number | null;
  shiurStartSeconds?: number | null;
  shiurStartSource?: 'automatic' | 'manual' | null;
  shiurStartConfidence?: number | null;
  shiurSkipEnabled?: boolean;
};
export const PLAYBACK_RATES = [0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2];
export function getShiurSkipSeconds(recording: Partial<ListenerRecording> | null | undefined) {
  if (!recording || recording.shiurSkipEnabled === false) return null;
  const seconds = Number(recording.shiurStartSeconds);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  return seconds;
}

type Playlist = { id: string; name: string; recordingIds: string[] };
export type RepeatMode = 'off' | 'all' | 'one';
type ListenerContextValue = {
  player: ReturnType<typeof useAudioPlayer>;
  status: ReturnType<typeof useAudioPlayerStatus>;
  activeRecording: ListenerRecording | null;
  queue: ListenerRecording[];
  favorites: string[];
  positions: Record<string, number>;
  playlists: Playlist[];
  recent: string[];
  playbackRate: number;
  repeatMode: RepeatMode;
  toggleFavorite: (id: string) => void;
  isFavorite: (id: string) => boolean;
  play: (recording: ListenerRecording, queue?: ListenerRecording[], startAtSeconds?: number) => void;
  playAll: (recordings: ListenerRecording[], shuffle?: boolean) => void;
  next: () => void;
  previous: () => void;
  toggleShuffle: () => void;
  shuffle: boolean;
  savePosition: () => void;
  createPlaylist: (name: string) => void;
  renamePlaylist: (id: string, name: string) => void;
  deletePlaylist: (id: string) => void;
  addToPlaylist: (playlistId: string, recordingId: string) => void;
  removeFromPlaylist: (playlistId: string, recordingId: string) => void;
  reorderPlaylist: (playlistId: string, recordingIds: string[]) => void;
  openFullPlayer: () => void;
  seekTo: (seconds: number) => void;
  addToQueue: (recording: ListenerRecording) => void;
  removeFromQueue: (id: string) => void;
  clearQueue: () => void;
  setPlaybackRate: (rate: number) => void;
  setRepeatMode: (mode: RepeatMode) => void;
};

const ListenerContext = createContext<ListenerContextValue | null>(null);

export function ListenerProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(Platform.OS !== 'web');
  useEffect(() => {
    if (Platform.OS === 'web') setReady(true);
  }, []);
  if (!ready) return <ListenerContext.Provider value={bootstrapValue}>{children}</ListenerContext.Provider>;
  return <ListenerRuntime>{children}</ListenerRuntime>;
}

const bootstrapPlayer = {
  play: () => {},
  pause: () => {},
  seekTo: (_seconds: number) => {},
  replace: (_source: AudioSource) => {},
  setPlaybackRate: (_rate: number) => {},
} as ReturnType<typeof useAudioPlayer>;
const bootstrapStatus = {
  didJustFinish: false,
  currentTime: 0,
  duration: 0,
  playing: false,
} as ReturnType<typeof useAudioPlayerStatus>;
const bootstrapValue: ListenerContextValue = {
  player: bootstrapPlayer,
  status: bootstrapStatus,
  activeRecording: null,
  queue: [],
  favorites: [],
  positions: {},
  playlists: [],
  recent: [],
  playbackRate: 1,
  repeatMode: 'off',
  toggleFavorite: () => {},
  isFavorite: () => false,
  play: () => {},
  playAll: () => {},
  next: () => {},
  previous: () => {},
  toggleShuffle: () => {},
  shuffle: false,
  savePosition: () => {},
  createPlaylist: () => {},
  renamePlaylist: () => {},
  deletePlaylist: () => {},
  addToPlaylist: () => {},
  removeFromPlaylist: () => {},
  reorderPlaylist: () => {},
  openFullPlayer: () => {},
  seekTo: () => {},
  addToQueue: () => {},
  removeFromQueue: () => {},
  clearQueue: () => {},
  setPlaybackRate: () => {},
  setRepeatMode: () => {},
};

function ListenerRuntime({ children }: { children: ReactNode }) {
  const player = useAudioPlayer(null);
  const status = useAudioPlayerStatus(player);
  const router = useRouter();
  const pathname = usePathname();
  const [activeRecording, setActiveRecording] = useState<ListenerRecording | null>(null);
  const [queue, setQueue] = useState<ListenerRecording[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [positions, setPositions] = useState<Record<string, number>>({});
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const [playbackRate, setPlaybackRateState] = useState(1);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('off');
  const [shuffle, setShuffle] = useState(false);
  const hydrated = useRef(false);
  const restorePending = useRef<string | null>(null);
  const startPending = useRef<{ id: string; seconds: number } | null>(null);

  useEffect(() => {
    Promise.all([
      readStored(listenerStorageKeys.favorites, [] as string[]),
      readStored(listenerStorageKeys.positions, {} as Record<string, number>),
      readStored(listenerStorageKeys.playlists, [] as Playlist[]),
      readStored(listenerStorageKeys.recent, [] as string[]),
      readStored(listenerStorageKeys.playbackRate, 1),
    ]).then(([storedFavorites, storedPositions, storedPlaylists, storedRecent, storedRate]) => {
      setFavorites(storedFavorites);
      setPositions(storedPositions);
      setPlaylists(storedPlaylists);
      setRecent(storedRecent);
      setPlaybackRateState(Number(storedRate) || 1);
      hydrated.current = true;
    });
  }, []);

  useEffect(() => { if (hydrated.current) void writeStored(listenerStorageKeys.favorites, favorites); }, [favorites]);
  useEffect(() => { if (hydrated.current) void writeStored(listenerStorageKeys.positions, positions); }, [positions]);
  useEffect(() => { if (hydrated.current) void writeStored(listenerStorageKeys.playlists, playlists); }, [playlists]);
  useEffect(() => { if (hydrated.current) void writeStored(listenerStorageKeys.recent, recent); }, [recent]);
  useEffect(() => { if (hydrated.current) void writeStored(listenerStorageKeys.playbackRate, playbackRate); }, [playbackRate]);
  useEffect(() => { player.setPlaybackRate(playbackRate, 'high'); }, [player, playbackRate]);

  useEffect(() => {
    if (status.didJustFinish) {
      if (repeatMode === 'one' && activeRecording) {
        player.seekTo(0);
        player.play();
        return;
      }
      if (activeRecording) setPositions((current) => { const nextPositions = { ...current }; delete nextPositions[activeRecording.id]; return nextPositions; });
      if (repeatMode === 'all' && activeRecording && queue.length === 1) {
        play(activeRecording, queue);
      } else next();
    }
  }, [status.didJustFinish]);

  useEffect(() => {
    if (activeRecording && status.currentTime > 0 && Math.floor(status.currentTime) % 5 === 0) savePosition();
  }, [activeRecording, status.currentTime]);

  useEffect(() => {
    if (activeRecording && restorePending.current === activeRecording.id && status.duration > 0) {
      const position = positions[activeRecording.id] || 0;
      if (position > 5 && position < status.duration - 5) player.seekTo(position);
      restorePending.current = null;
    }
  }, [activeRecording, positions, status.duration]);

  useEffect(() => {
    const pending = startPending.current;
    if (!pending || activeRecording?.id !== pending.id || status.duration <= 0) return;
    player.seekTo(pending.seconds);
    startPending.current = null;
    player.play();
  }, [activeRecording, player, status.duration]);

  const orderedQueue = useMemo(() => queue, [queue]);
  const play = (recording: ListenerRecording, nextQueue = queue, startAtSeconds?: number) => {
    if (activeRecording?.id === recording.id) {
      if (status.playing) { savePosition(); player.pause(); } else player.play();
      return;
    }
    savePosition();
    setActiveRecording(recording);
    setRecent((current) => [recording.id, ...current.filter((id) => id !== recording.id)].slice(0, 30));
    setQueue(nextQueue.length ? nextQueue : [recording]);
    restorePending.current = startAtSeconds === undefined ? recording.id : null;
    startPending.current = typeof startAtSeconds === 'number' && startAtSeconds > 0 ? { id: recording.id, seconds: startAtSeconds } : null;
    player.replace(recording.source);
    if (!startPending.current) player.play();
  };
  const playAll = (recordings: ListenerRecording[], shouldShuffle = shuffle) => {
    const nextQueue = [...recordings];
    if (shouldShuffle) nextQueue.sort(() => Math.random() - 0.5);
    if (nextQueue[0]) { setShuffle(shouldShuffle); play(nextQueue[0], nextQueue); }
  };
  const next = () => {
    if (!activeRecording || !orderedQueue.length) return;
    if (shuffle) {
      const alternatives = orderedQueue.filter((item) => item.id !== activeRecording.id);
      const randomRecording = alternatives[Math.floor(Math.random() * alternatives.length)];
      if (randomRecording) { play(randomRecording, orderedQueue); return; }
    }
    const index = orderedQueue.findIndex((item) => item.id === activeRecording.id);
    const nextRecording = orderedQueue[index + 1];
    if (nextRecording) play(nextRecording, orderedQueue);
    else if (repeatMode === 'all') play(orderedQueue[0], orderedQueue);
    else player.pause();
  };
  const previous = () => {
    if (!activeRecording || !orderedQueue.length) return;
    if (status.currentTime > 5) { player.seekTo(0); return; }
    const index = orderedQueue.findIndex((item) => item.id === activeRecording.id);
    const previousRecording = orderedQueue[index - 1];
    if (previousRecording) play(previousRecording, orderedQueue);
  };
  const savePosition = () => { if (activeRecording && status.currentTime > 0) setPositions((current) => ({ ...current, [activeRecording.id]: status.currentTime })); };
  const toggleFavorite = (id: string) => setFavorites((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const createPlaylist = (name: string) => { const cleanName = name.trim(); if (cleanName) setPlaylists((current) => [...current, { id: `playlist_${Date.now()}`, name: cleanName, recordingIds: [] }]); };
  const renamePlaylist = (id: string, name: string) => setPlaylists((current) => current.map((playlist) => playlist.id === id ? { ...playlist, name: name.trim() || playlist.name } : playlist));
  const deletePlaylist = (id: string) => setPlaylists((current) => current.filter((playlist) => playlist.id !== id));
  const addToPlaylist = (playlistId: string, recordingId: string) => setPlaylists((current) => current.map((playlist) => playlist.id === playlistId && !playlist.recordingIds.includes(recordingId) ? { ...playlist, recordingIds: [...playlist.recordingIds, recordingId] } : playlist));
  const removeFromPlaylist = (playlistId: string, recordingId: string) => setPlaylists((current) => current.map((playlist) => playlist.id === playlistId ? { ...playlist, recordingIds: playlist.recordingIds.filter((id) => id !== recordingId) } : playlist));
  const reorderPlaylist = (playlistId: string, recordingIds: string[]) => setPlaylists((current) => current.map((playlist) => playlist.id === playlistId ? { ...playlist, recordingIds } : playlist));
  const addToQueue = (recording: ListenerRecording) => setQueue((current) => current.some((item) => item.id === recording.id) ? current : [...current, recording]);
  const removeFromQueue = (id: string) => setQueue((current) => current.filter((item) => item.id !== id));
  const clearQueue = () => setQueue(activeRecording ? [activeRecording] : []);
  const setPlaybackRate = (rate: number) => setPlaybackRateState(PLAYBACK_RATES.includes(rate) ? rate : 1);
  const openFullPlayer = () => { if (activeRecording && pathname !== '/player') router.push('/player' as never); };
  const value = { player, status, activeRecording, queue, favorites, positions, playlists, recent, playbackRate, repeatMode, toggleFavorite, isFavorite: (id: string) => favorites.includes(id), play, playAll, next, previous, toggleShuffle: () => setShuffle((value) => !value), shuffle, savePosition, seekTo: (seconds: number) => player.seekTo(seconds), createPlaylist, renamePlaylist, deletePlaylist, addToPlaylist, removeFromPlaylist, reorderPlaylist, addToQueue, removeFromQueue, clearQueue, setPlaybackRate, setRepeatMode, openFullPlayer };
  return <ListenerContext.Provider value={value}>{children}</ListenerContext.Provider>;
}

export function useListener() {
  const context = useContext(ListenerContext);
  if (!context) throw new Error('useListener must be used inside ListenerProvider');
  return context;
}
