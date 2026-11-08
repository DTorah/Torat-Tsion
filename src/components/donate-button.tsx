import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';
import { donationUrl } from '@/lib/site';

export function DonateButton() {
  return (
    <Link href={donationUrl} asChild>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel="Donate through TorahHelp — support Torah learning"
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
        <Text accessible={false} style={styles.heart}>♥</Text>
        <Text style={styles.label}>Donate</Text>
        <Text accessible={false} style={styles.arrow}>↗</Text>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center', backgroundColor: '#e7c477', borderColor: '#f3dcaa',
    borderRadius: 999, borderWidth: 1, boxShadow: '0 4px 16px rgba(167,121,39,0.22)',
    flexDirection: 'row', gap: 9, justifyContent: 'center', minHeight: 46,
    paddingHorizontal: 19, paddingVertical: 11,
  },
  label: { color: '#173d33', fontSize: 14, fontWeight: '800' },
  heart: { color: '#76531e', fontSize: 17 },
  arrow: { color: '#173d33', fontSize: 17, marginLeft: 2 },
  pressed: { opacity: 0.88, transform: [{ scale: 0.98 }] },
});
