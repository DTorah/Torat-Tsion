import { Image } from 'expo-image';
import { Pressable, ScrollView, StyleSheet, Text, View, Platform, useWindowDimensions } from 'react-native';
import { useEffect, useMemo, useState } from 'react';

import { apiUrl } from '@/lib/api';
import { normalizeRecordingTitle } from '@/lib/recording-title';
import { getShiurSkipSeconds, PLAYBACK_RATES, useListener } from '@/components/listener-provider';
import { RangeSlider } from '@/components/slider';
import { SeekBar } from '@/components/seek-bar';

const neutralCover = require('@/assets/shiur-covers/fallback.png');

function formatTime(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '0:00';
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60);
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

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

export function MiniPlayer() {
  const {
    activeRecording,
    status,
    openFullPlayer,
    player,
    queue,
    next,
    previous,
    toggleFavorite,
    isFavorite,
    addToQueue,
    removeFromQueue,
    clearQueue,
    shuffle,
    toggleShuffle,
    repeatMode,
    setRepeatMode,
    playbackRate,
    setPlaybackRate,
    play,
  } = useListener();
  const { width } = useWindowDimensions();
  const [hydrated, setHydrated] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => setHydrated(true), []);
  if (!activeRecording) return null;

  const isDesktop = hydrated && Platform.OS === 'web' && width >= 980;
  const shiurSkipSeconds = getShiurSkipSeconds(activeRecording);
  const showSkipToShiur = shiurSkipSeconds !== null && status.currentTime < shiurSkipSeconds - 1 && (status.duration <= 0 || status.duration > shiurSkipSeconds);
  const upNext = useMemo(() => queue.filter((item) => item.id !== activeRecording.id), [activeRecording.id, queue]);

  const openPanel = () => {
    if (Platform.OS === 'web' && isDesktop) {
      setExpanded(true);
      return;
    }
    openFullPlayer();
  };

  return (
    <>
      <View style={styles.container}>
        <Pressable onPress={openPanel} style={styles.identity}>
          <View style={styles.art}>
            {activeRecording.coverUrl ? <Image source={{ uri: activeRecording.coverUrl }} style={StyleSheet.absoluteFill} /> : <Image source={neutralCover} style={styles.mark} />}
          </View>
          <View style={styles.copy}>
            <Text style={styles.title} numberOfLines={1}>{normalizeRecordingTitle(activeRecording.title)}</Text>
            <Text style={styles.speaker} numberOfLines={1}>{activeRecording.speaker}</Text>
          </View>
        </Pressable>

        <View style={styles.rightControls}>
          <Pressable accessibilityLabel={status.playing ? 'Pause' : 'Play'} onPress={() => (status.playing ? player.pause() : player.play())} style={styles.play}>
            <Text style={styles.playText}>{status.playing ? 'Ⅱ' : '▶'}</Text>
          </Pressable>
          {isDesktop && (
            <Pressable onPress={() => setExpanded((current) => !current)} style={styles.expand}>
              <Text style={styles.expandText}>{expanded ? 'Close' : 'Now Playing'}</Text>
            </Pressable>
          )}
        </View>

        <SeekBar currentTime={status.currentTime} duration={status.duration} onSeek={(seconds) => void player.seekTo(seconds)} style={styles.progress} />
      </View>

      {isDesktop && expanded && (
        <View pointerEvents="box-none" style={styles.panelAnchor}>
          <View style={styles.panel}>
            <View style={styles.panelHeader}>
              <Text style={styles.panelTitle}>Now Playing</Text>
              <Pressable onPress={() => setExpanded(false)} style={styles.closeButton}>
                <Text style={styles.closeText}>Close</Text>
              </Pressable>
            </View>

            <View style={styles.panelArtWrap}>
              {activeRecording.coverUrl ? <Image source={{ uri: activeRecording.coverUrl }} style={styles.panelArt} /> : <Image source={neutralCover} style={styles.panelLogo} />}
            </View>

            <Text style={styles.panelRecordingTitle} numberOfLines={2}>{normalizeRecordingTitle(activeRecording.title)}</Text>
            <Text style={styles.panelSpeaker}>{activeRecording.speaker}</Text>

            <SeekBar currentTime={status.currentTime} duration={status.duration} onSeek={(seconds) => void player.seekTo(seconds)} style={styles.seekBar} />

            <View style={styles.timesRow}>
              <Text style={styles.timeText}>{formatTime(status.currentTime)}</Text>
              <Text style={styles.timeText}>{formatTime(status.duration)}</Text>
            </View>

            {showSkipToShiur && (
              <Pressable accessibilityLabel={`Skip to shiur at ${formatTime(shiurSkipSeconds)}`} onPress={() => { player.seekTo(shiurSkipSeconds); if (!status.playing) player.play(); }} style={styles.skipButton}>
                <Text style={styles.skipButtonText}>{`Skip to Shiur · ${formatTime(shiurSkipSeconds)}`}</Text>
              </Pressable>
            )}

            <View style={styles.panelControls}>
              <Pressable onPress={previous} style={styles.controlButton}><Text style={styles.controlButtonText}>⏮</Text></Pressable>
              <Pressable onPress={() => (status.playing ? player.pause() : player.play())} style={styles.primaryControl}><Text style={styles.primaryControlText}>{status.playing ? '⏸' : '▶'}</Text></Pressable>
              <Pressable onPress={next} style={styles.controlButton}><Text style={styles.controlButtonText}>⏭</Text></Pressable>
            </View>

            <View style={styles.panelActionGrid}>
              <Pressable onPress={() => toggleFavorite(activeRecording.id)} style={styles.actionChip}>
                <Text style={styles.actionChipText}>{isFavorite(activeRecording.id) ? '★ Saved' : '☆ Save'}</Text>
              </Pressable>
              <Pressable onPress={() => triggerDownload(activeRecording.id, normalizeRecordingTitle(activeRecording.title))} style={styles.actionChip}>
                <Text style={styles.actionChipText}>↓ Download</Text>
              </Pressable>
              <Pressable onPress={() => addToQueue(activeRecording)} style={styles.actionChip}>
                <Text style={styles.actionChipText}>＋ Queue</Text>
              </Pressable>
              <Pressable onPress={toggleShuffle} style={styles.actionChip}>
                <Text style={styles.actionChipText}>{shuffle ? 'Shuffle on' : 'Shuffle'}</Text>
              </Pressable>
              <Pressable onPress={() => setRepeatMode(repeatMode === 'off' ? 'all' : repeatMode === 'all' ? 'one' : 'off')} style={styles.actionChip}>
                <Text style={styles.actionChipText}>{repeatMode === 'off' ? 'Repeat' : `Repeat ${repeatMode}`}</Text>
              </Pressable>
            </View>

            <View style={styles.rateRow}>
              <Text style={styles.rateLabel}>Speed</Text>
              <RangeSlider
                value={playbackRate}
                min={0.5}
                max={2}
                step={0.1}
                onChange={setPlaybackRate}
                formatter={(rate) => `${rate.toFixed(1)}x`}
                showValue
                trackStyle={styles.rateTrack}
                fillStyle={styles.rateFill}
                thumbStyle={styles.rateThumb}
                labelStyle={styles.rateLabel}
                valueStyle={styles.rateValue}
              />
            </View>

            <View style={styles.queueSectionHeader}>
              <Text style={styles.queueSectionTitle}>Up Next</Text>
              {queue.length > 1 && <Pressable onPress={clearQueue}><Text style={styles.clearQueueText}>Clear</Text></Pressable>}
            </View>

            {upNext.length ? (
              <ScrollView style={styles.queueList} showsVerticalScrollIndicator={false}>
                {upNext.map((recording) => (
                  <View key={recording.id} style={styles.queueItem}>
                    <Pressable onPress={() => play(recording, queue)} style={styles.queueInfo}>
                      <Text style={styles.queueTitle} numberOfLines={1}>{normalizeRecordingTitle(recording.title)}</Text>
                      <Text style={styles.queueSpeaker} numberOfLines={1}>{recording.speaker}</Text>
                    </Pressable>
                    <Pressable onPress={() => removeFromQueue(recording.id)} style={styles.queueRemove}><Text style={styles.queueRemoveText}>×</Text></Pressable>
                  </View>
                ))}
              </ScrollView>
            ) : (
              <Text style={styles.emptyText}>No queued recordings.</Text>
            )}
          </View>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    borderTopColor: '#dfeaf7',
    borderTopWidth: 1,
    bottom: 0,
    flexDirection: 'row',
    minHeight: 72,
    padding: 10,
    position: 'absolute',
    width: '100%',
    zIndex: 12,
    shadowColor: '#98afd0',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
  },
  identity: { alignItems: 'center', flex: 1, flexDirection: 'row' },
  art: { alignItems: 'center', backgroundColor: '#edf5ff', borderRadius: 12, height: 44, justifyContent: 'center', overflow: 'hidden', width: 44 },
  mark: { height: 30, resizeMode: 'contain', width: 30 },
  copy: { flex: 1, marginLeft: 10 },
  title: { color: '#142950', fontSize: 13, fontWeight: '700' },
  speaker: { color: '#5b6e8d', fontSize: 11, marginTop: 3 },
  rightControls: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  play: { alignItems: 'center', backgroundColor: '#2d6cdf', borderRadius: 999, height: 40, justifyContent: 'center', width: 40 },
  playText: { color: '#ffffff', fontWeight: '800' },
  expand: { backgroundColor: '#edf5ff', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  expandText: { color: '#1d4ea8', fontSize: 11, fontWeight: '700' },
  progress: { backgroundColor: '#dfeaf7', bottom: 0, height: 3, left: 0, position: 'absolute', right: 0 },
  fill: { backgroundColor: '#2d6cdf', height: 3 },
  panelAnchor: { position: 'absolute', right: 24, bottom: 88, zIndex: 20 },
  panel: {
    backgroundColor: '#fff',
    borderColor: '#dfeaf7',
    borderRadius: 24,
    borderWidth: 1,
    width: 330,
    padding: 14,
    shadowColor: '#6d8fc0',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.14,
    shadowRadius: 18,
  },
  panelHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  panelTitle: { color: '#142950', fontSize: 18, fontWeight: '800' },
  closeButton: { paddingHorizontal: 8, paddingVertical: 4 },
  closeText: { color: '#2d6cdf', fontWeight: '700' },
  panelArtWrap: { alignItems: 'center', marginBottom: 8 },
  panelArt: { borderRadius: 14, height: 92, width: 92 },
  panelLogo: { height: 52, resizeMode: 'contain', width: 52 },
  panelRecordingTitle: { color: '#142950', fontSize: 17, fontWeight: '800', textAlign: 'center' },
  panelSpeaker: { color: '#5b6e8d', fontSize: 12, marginTop: 3, textAlign: 'center' },
  seekBar: { backgroundColor: '#dfeaf7', borderRadius: 999, height: 8, marginTop: 10, overflow: 'hidden' },
  seekFill: { backgroundColor: '#2d6cdf', height: '100%' },
  timesRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  timeText: { color: '#5b6e8d', fontSize: 12 },
  skipButton: { backgroundColor: '#edf5ff', borderColor: '#bfd4ff', borderRadius: 999, borderWidth: 1, marginTop: 14, paddingHorizontal: 14, paddingVertical: 8 },
  skipButtonText: { color: '#1d4ea8', fontSize: 12, fontWeight: '800', letterSpacing: 0.2 },
  panelControls: { alignItems: 'center', flexDirection: 'row', justifyContent: 'center', marginTop: 10, gap: 14 },
  controlButton: { alignItems: 'center', backgroundColor: '#edf5ff', borderRadius: 999, height: 36, justifyContent: 'center', width: 36 },
  controlButtonText: { color: '#1d4ea8', fontSize: 18, fontWeight: '700' },
  primaryControl: { alignItems: 'center', backgroundColor: '#2d6cdf', borderRadius: 999, height: 44, justifyContent: 'center', width: 44 },
  primaryControlText: { color: '#ffffff', fontSize: 18, fontWeight: '800' },
  panelActionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  actionChip: { backgroundColor: '#edf5ff', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 8 },
  actionChipText: { color: '#1d4ea8', fontSize: 12, fontWeight: '700' },
  rateRow: { alignItems: 'stretch', gap: 8, marginTop: 10, width: '100%' },
  rateLabel: { color: '#142950', fontSize: 12, fontWeight: '700' },
  rateValue: { color: '#2d6cdf', fontSize: 12, fontWeight: '800' },
  rateTrack: { backgroundColor: '#dfeaf7', borderRadius: 999, height: 16 },
  rateFill: { backgroundColor: '#2d6cdf', borderRadius: 999 },
  rateThumb: { backgroundColor: '#ffffff', borderColor: '#2d6cdf', borderWidth: 3 },
  queueSectionHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  queueSectionTitle: { color: '#142950', fontSize: 16, fontWeight: '800' },
  clearQueueText: { color: '#2d6cdf', fontSize: 12, fontWeight: '700' },
  queueList: { maxHeight: 100, marginTop: 8 },
  queueItem: { alignItems: 'center', borderBottomColor: '#edf5ff', borderBottomWidth: 1, flexDirection: 'row', paddingVertical: 8 },
  queueInfo: { flex: 1 },
  queueTitle: { color: '#142950', fontSize: 13, fontWeight: '700' },
  queueSpeaker: { color: '#5b6e8d', fontSize: 11, marginTop: 2 },
  queueRemove: { paddingLeft: 8 },
  queueRemoveText: { color: '#2d6cdf', fontSize: 18, fontWeight: '700' },
  emptyText: { color: '#5b6e8d', fontSize: 12, marginTop: 12 },
});
