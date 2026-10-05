import { type LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import { useRef, useState } from 'react';

type SliderProps = {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  formatter?: (value: number) => string;
  label?: string;
  showValue?: boolean;
  disabled?: boolean;
  trackStyle?: object;
  fillStyle?: object;
  thumbStyle?: object;
  labelStyle?: object;
  valueStyle?: object;
};

function clamp(value: number, min: number, max: number) {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function RangeSlider({
  value,
  min,
  max,
  step,
  onChange,
  formatter,
  label,
  showValue = false,
  disabled = false,
  trackStyle,
  fillStyle,
  thumbStyle,
  labelStyle,
  valueStyle,
}: SliderProps) {
  const [trackWidth, setTrackWidth] = useState(0);
  const trackRef = useRef<View | null>(null);

  const snapValue = (rawValue: number) => {
    const boundedRaw = clamp(rawValue, min, max);
    const stepCount = (boundedRaw - min) / step;
    const snapped = Math.round(stepCount) * step + min;
    return clamp(Number(snapped.toFixed(2)), min, max);
  };

  const updateFromOffset = (offset: number) => {
    if (!trackWidth || disabled) return;
    const ratio = clamp(offset / trackWidth, 0, 1);
    const rawValue = min + ratio * (max - min);
    onChange(snapValue(rawValue));
  };

  const handlePress = (event: any) => {
    const offset = typeof event?.nativeEvent?.locationX === 'number' ? event.nativeEvent.locationX : 0;
    updateFromOffset(offset);
  };

  const handleMove = (event: any) => {
    const offset = typeof event?.nativeEvent?.locationX === 'number' ? event.nativeEvent.locationX : 0;
    updateFromOffset(offset);
  };

  const ratio = clamp((value - min) / (max - min || 1), 0, 1);
  const formattedValue = formatter ? formatter(value) : `${value}`;

  return (
    <View style={styles.container}>
      {(label || showValue) && (
        <View style={styles.header}>
          {label ? <Text style={[styles.label, labelStyle]}>{label}</Text> : null}
          {showValue ? <Text style={[styles.value, valueStyle]}>{formattedValue}</Text> : null}
        </View>
      )}

      <View
        ref={trackRef}
        onLayout={(event: LayoutChangeEvent) => setTrackWidth(event.nativeEvent.layout.width)}
        onMoveShouldSetResponder={() => !disabled}
        onResponderGrant={handleMove}
        onResponderMove={handleMove}
        onStartShouldSetResponder={() => !disabled}
        onResponderTerminationRequest={() => !disabled}
        style={[styles.track, trackStyle, disabled && styles.disabledTrack]}
      >
        <View style={[styles.fill, fillStyle, { width: `${ratio * 100}%` }]} />
        <View style={[styles.thumb, thumbStyle, { left: `${ratio * 100}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%' },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  label: { color: '#142950', fontSize: 12, fontWeight: '700' },
  value: { color: '#2d6cdf', fontSize: 14, fontWeight: '800' },
  track: {
    alignItems: 'center',
    backgroundColor: '#dfeaf7',
    borderRadius: 999,
    height: 16,
    justifyContent: 'center',
    position: 'relative',
    width: '100%',
  },
  disabledTrack: { opacity: 0.5 },
  fill: {
    backgroundColor: '#2d6cdf',
    borderRadius: 999,
    height: 16,
    left: 0,
    position: 'absolute',
    top: 0,
  },
  thumb: {
    backgroundColor: '#ffffff',
    borderColor: '#2d6cdf',
    borderRadius: 999,
    borderWidth: 3,
    height: 22,
    marginLeft: -11,
    position: 'absolute',
    top: -3,
    width: 22,
  },
});
