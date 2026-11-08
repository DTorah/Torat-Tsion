import { useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { donationUrl } from '@/lib/site';

export function DonateButton({ compact = false }: { compact?: boolean }) {
  const [highlighted, setHighlighted] = useState(false);
  return (
    <Pressable
        {...(Platform.OS === 'web' ? { href: donationUrl } : {})}
        onPress={(event) => {
          if (Platform.OS === 'web' && typeof window !== 'undefined') {
            event.preventDefault();
            window.location.assign(donationUrl);
          } else {
            void Linking.openURL(donationUrl);
          }
        }}
        accessibilityRole="link"
        accessibilityLabel="Donate through PayPal — help Torah reach more people"
        onHoverIn={() => setHighlighted(true)}
        onHoverOut={() => setHighlighted(false)}
        onFocus={() => setHighlighted(true)}
        onBlur={() => setHighlighted(false)}
        style={({ pressed }) => [styles.button, compact && styles.compact, highlighted && styles.highlighted, pressed && styles.pressed]}>
        <View accessible={false} style={[styles.heartCircle, compact && styles.heartCircleCompact]}>
          <Text style={styles.heart}>♥</Text>
        </View>
        <View style={styles.copy}>
          {!compact && <Text style={styles.eyebrow}>GIVE THE GIFT OF TORAH</Text>}
          <Text style={[styles.label, compact && styles.labelCompact]}>Donate today</Text>
          <Text style={[styles.caption, compact && styles.captionCompact]}>{compact ? 'Support Torah learning' : 'Help Torah reach more people'}</Text>
        </View>
        <Text accessible={false} style={styles.arrow}>↗</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center', backgroundColor: '#f0c766', borderColor: '#ffe3a0',
    borderRadius: 19, borderWidth: 1, boxShadow: '0 7px 24px rgba(167,121,39,0.28)',
    flexDirection: 'row', flexBasis: 320, flexGrow: 1, flexShrink: 1,
    gap: 14, minHeight: 100, maxWidth: 390,
    paddingHorizontal: 20, paddingVertical: 17,
  },
  heartCircle: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff0c1', borderRadius: 25, width: 50, height: 50 },
  heart: { color: '#855019', fontSize: 27 },
  copy: { flex: 1, minWidth: 0 },
  eyebrow: { color: '#614821', fontSize: 9, fontWeight: '800', letterSpacing: 1.2, marginBottom: 4 },
  label: { color: '#153c30', fontSize: 23, lineHeight: 29, fontWeight: '800' },
  caption: { color: '#4e4c2c', fontSize: 12, lineHeight: 17, marginTop: 4 },
  arrow: { color: '#153c30', fontSize: 27 },
  compact: { flexBasis: 'auto', flexGrow: 0, maxWidth: '100%', minHeight: 76, gap: 9, paddingHorizontal: 12, paddingVertical: 12, borderRadius: 15 },
  heartCircleCompact: { width: 35, height: 35 },
  labelCompact: { fontSize: 16, lineHeight: 22 },
  captionCompact: { fontSize: 10, lineHeight: 14 },
  highlighted: { backgroundColor: '#ffda7c', boxShadow: '0 10px 30px rgba(167,121,39,0.4)', transform: [{ translateY: -2 }] },
  pressed: { opacity: 0.92, transform: [{ scale: 0.98 }] },
});
