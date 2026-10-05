import { Pressable, StyleSheet, View, type GestureResponderEvent } from 'react-native';
import { useState } from 'react';

type SeekBarProps = {
  currentTime: number;
  duration: number;
  onSeek: (seconds: number) => void;
  style?: object;
};

export function SeekBar({ currentTime, duration, onSeek, style }: SeekBarProps) {
  const [width, setWidth] = useState(0);
  const progress = duration > 0 ? Math.max(0, Math.min(1, currentTime / duration)) : 0;
  const seekFromEvent = (event: GestureResponderEvent) => {
    if (duration <= 0) return;
    const locationX = event.nativeEvent.locationX;
    if (width > 0 && Number.isFinite(locationX)) onSeek((Math.max(0, Math.min(width, locationX)) / width) * duration);
  };

  return (
    <Pressable
      accessibilityRole="adjustable"
      accessibilityLabel="Seek in recording"
      onPress={seekFromEvent}
      onPressIn={seekFromEvent}
      onPressMove={seekFromEvent}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={[styles.track, style]}
    >
      <View style={[styles.fill, { width: `${progress * 100}%` }]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: { backgroundColor: '#dfeaf7', borderRadius: 999, height: 10, overflow: 'hidden' },
  fill: { backgroundColor: '#2d6cdf', height: '100%' },
});
