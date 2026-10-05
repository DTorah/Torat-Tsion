import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

import { getShiurSkipSeconds, useListener } from '@/components/listener-provider';
import { RangeSlider } from '@/components/slider';
import { SeekBar } from '@/components/seek-bar';
import { apiUrl } from '@/lib/api';
import { normalizeRecordingTitle } from '@/lib/recording-title';

const neutralCover = require('@/assets/shiur-covers/fallback.png');

function format(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
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

export default function FullPlayer() {
  const router = useRouter();
  const {
    activeRecording,
    status,
    player,
    next,
    previous,
    shuffle,
    toggleShuffle,
    queue,
    play,
    seekTo,
    repeatMode,
    setRepeatMode,
    playbackRate,
    setPlaybackRate,
    isFavorite,
    toggleFavorite,
    removeFromQueue,
    clearQueue,
    addToQueue,
  } = useListener();
  if (!activeRecording) return <SafeAreaView style={styles.safe}><Text style={styles.empty}>Nothing is playing.</Text></SafeAreaView>;

  const shiurSkipSeconds = getShiurSkipSeconds(activeRecording);
  const showSkipToShiur = shiurSkipSeconds !== null && status.currentTime < shiurSkipSeconds - 1 && (status.duration <= 0 || status.duration > shiurSkipSeconds);
  const upNext = queue.filter((recording) => recording.id !== activeRecording.id);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Pressable accessibilityLabel="Close player" onPress={() => router.back()}>
          <Text style={styles.close}>‹ Back</Text>
        </Pressable>

        <View style={styles.cover}>
          {activeRecording.coverUrl ? <Image contentFit="cover" source={{ uri: activeRecording.coverUrl }} style={StyleSheet.absoluteFill} /> : <Image source={neutralCover} style={styles.mark} />}
        </View>

        <Text style={styles.title}>{normalizeRecordingTitle(activeRecording.title)}</Text>
        <Text style={styles.speaker}>{activeRecording.speaker}</Text>

        <SeekBar currentTime={status.currentTime} duration={status.duration} onSeek={(seconds) => void seekTo(seconds)} style={styles.track} />

        <View style={styles.times}>
          <Text style={styles.timeText}>{format(status.currentTime)}</Text>
          <Text style={styles.timeText}>{format(status.duration)}</Text>
        </View>

        {showSkipToShiur && (
          <Pressable accessibilityLabel={`Skip to shiur at ${format(shiurSkipSeconds)}`} onPress={() => { seekTo(shiurSkipSeconds); if (!status.playing) player.play(); }} style={styles.skipButton}>
            <Text style={styles.skipButtonText}>{`Skip to Shiur · ${format(shiurSkipSeconds)}`}</Text>
          </Pressable>
        )}

        <View style={styles.controls}>
          <Pressable accessibilityLabel="Previous" onPress={previous} style={styles.controlButton}><Text style={styles.controlIcon}>⏮</Text></Pressable>
          <Pressable accessibilityLabel={status.playing ? 'Pause' : 'Play'} onPress={() => (status.playing ? player.pause() : player.play())} style={styles.main}>
            <Text style={styles.mainText}>{status.playing ? '⏸' : '▶'}</Text>
          </Pressable>
          <Pressable accessibilityLabel="Next" onPress={next} style={styles.controlButton}><Text style={styles.controlIcon}>⏭</Text></Pressable>
        </View>

        <View style={styles.actions}>
          <Pressable onPress={() => toggleFavorite(activeRecording.id)} style={styles.actionChip}><Text style={styles.action}>{isFavorite(activeRecording.id) ? '★ Saved' : '☆ Save'}</Text></Pressable>
          <Pressable onPress={() => addToQueue(activeRecording)} style={styles.actionChip}><Text style={styles.action}>＋ Queue</Text></Pressable>
          <Pressable onPress={() => triggerDownload(activeRecording.id, normalizeRecordingTitle(activeRecording.title))} style={styles.actionChip}><Text style={styles.action}>↓ Download</Text></Pressable>
          <Pressable onPress={toggleShuffle} style={styles.actionChip}><Text style={styles.action}>{shuffle ? '↝ Shuffle on' : '↝ Shuffle'}</Text></Pressable>
          <Pressable onPress={() => setRepeatMode(repeatMode === 'off' ? 'all' : repeatMode === 'all' ? 'one' : 'off')} style={styles.actionChip}><Text style={styles.action}>↻ {repeatMode === 'off' ? 'Repeat' : `Repeat ${repeatMode}`}</Text></Pressable>
        </View>

        <View style={styles.rateRow}>
          <RangeSlider
            value={playbackRate}
            min={0.5}
            max={2}
            step={0.1}
            onChange={setPlaybackRate}
            formatter={(nextRate) => `${nextRate.toFixed(1)}x`}
            label="Speed"
            showValue
            trackStyle={styles.rateTrack}
            fillStyle={styles.rateFill}
            thumbStyle={styles.rateThumb}
            labelStyle={styles.queueTitle}
            valueStyle={styles.rateValue}
          />
        </View>

        <View style={styles.queueHeader}>
          <Text style={styles.queueTitle}>Now Playing</Text>
          <Pressable onPress={clearQueue}><Text style={styles.action}>Clear queue</Text></Pressable>
        </View>

        <View key={activeRecording.id} style={styles.queueItemActive}>
          <View style={styles.queueCopy}>
            <Text style={styles.queueText}>{normalizeRecordingTitle(activeRecording.title)}</Text>
            <Text style={styles.queueSpeaker}>{activeRecording.speaker}</Text>
          </View>
        </View>

        <Text style={styles.queueTitle}>Up Next</Text>
        {upNext.length ? upNext.map((recording) => (
          <View key={recording.id} style={styles.queueItem}>
            <Pressable onPress={() => play(recording, queue)} style={styles.queueCopy}>
              <Text style={styles.queueText}>{normalizeRecordingTitle(recording.title)}</Text>
              <Text style={styles.queueSpeaker}>{recording.speaker}</Text>
            </Pressable>
            <Pressable accessibilityLabel={`Remove ${recording.title} from queue`} onPress={() => removeFromQueue(recording.id)}>
              <Text style={styles.action}>×</Text>
            </Pressable>
          </View>
        )) : <Text style={styles.emptyText}>No queued recordings.</Text>}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { backgroundColor: '#f4f8ff', flex: 1 },
  container: { alignItems: 'center', padding: 22, paddingBottom: 130 },
  close: { alignSelf: 'flex-start', color: '#1d4ea8', fontWeight: '700', marginBottom: 24 },
  cover: { alignItems: 'center', aspectRatio: 1, backgroundColor: '#edf5ff', borderRadius: 20, justifyContent: 'center', maxWidth: 360, overflow: 'hidden', width: '100%' },
  mark: { height: 80, resizeMode: 'contain', width: 80 },
  title: { color: '#142950', fontSize: 26, fontWeight: '800', marginTop: 25, textAlign: 'center' },
  speaker: { color: '#2d6cdf', fontSize: 14, marginTop: 7 },
  track: { backgroundColor: '#dfeaf7', borderRadius: 999, height: 10, marginTop: 30, overflow: 'hidden', width: '100%' },
  fill: { backgroundColor: '#2d6cdf', height: 10 },
  times: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, width: '100%' },
  timeText: { color: '#5b6e8d', fontSize: 12 },
  controls: { alignItems: 'center', flexDirection: 'row', gap: 20, marginTop: 25 },
  controlButton: { alignItems: 'center', backgroundColor: '#edf5ff', borderRadius: 999, height: 42, justifyContent: 'center', width: 42 },
  controlIcon: { color: '#1d4ea8', fontSize: 18, fontWeight: '700' },
  main: { alignItems: 'center', backgroundColor: '#2d6cdf', borderRadius: 999, height: 60, justifyContent: 'center', width: 60 },
  mainText: { color: '#ffffff', fontSize: 20, fontWeight: '800' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginTop: 24 },
  actionChip: { backgroundColor: '#ffffff', borderColor: '#dfeaf7', borderRadius: 999, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10 },
  action: { color: '#1d4ea8', fontSize: 12, fontWeight: '700' },
  skipButton: { backgroundColor: '#edf5ff', borderColor: '#bfd4ff', borderRadius: 999, borderWidth: 1, marginTop: 18, paddingHorizontal: 16, paddingVertical: 10 },
  skipButtonText: { color: '#1d4ea8', fontSize: 12, fontWeight: '800', letterSpacing: 0.2 },
  rateRow: { alignSelf: 'stretch', marginTop: 25 },
  rateTrack: { backgroundColor: '#dfeaf7', borderRadius: 999, height: 18 },
  rateFill: { backgroundColor: '#2d6cdf', borderRadius: 999 },
  rateThumb: { backgroundColor: '#ffffff', borderColor: '#2d6cdf', borderWidth: 3 },
  rateValue: { color: '#2d6cdf', fontSize: 12, fontWeight: '800' },
  queueHeader: { alignSelf: 'stretch', alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginTop: 30 },
  queueTitle: { color: '#142950', fontSize: 20, fontWeight: '800', marginTop: 10 },
  queueItemActive: { alignItems: 'center', alignSelf: 'stretch', backgroundColor: '#edf5ff', borderColor: '#dfeaf7', borderRadius: 16, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, padding: 12 },
  queueItem: { alignItems: 'center', alignSelf: 'stretch', borderBottomColor: '#dfeaf7', borderBottomWidth: 1, flexDirection: 'row', gap: 10, paddingVertical: 12 },
  queueCopy: { flex: 1 },
  queueText: { color: '#142950', fontSize: 13, fontWeight: '700' },
  queueSpeaker: { color: '#5b6e8d', fontSize: 11, marginTop: 4 },
  emptyText: { color: '#5b6e8d', marginTop: 12, textAlign: 'center' },
  empty: { color: '#5b6e8d', margin: 30 },
});
