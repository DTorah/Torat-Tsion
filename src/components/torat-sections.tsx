import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export function ToratWelcome() {
  return <View style={styles.wrap}>
    <View style={styles.compactWelcome}>
      <View style={styles.kicker}><View style={styles.kickerDot} /><Text style={styles.eyebrow}>TORAT TSION · TORAH LISTENING</Text></View>
      <Text style={styles.heroTitle}>Listen, learn, and return.</Text>
      <Text style={styles.heroText}>Browse Rabbi Isaac Bakhshi's shiurim by topic, source, and season. Press play to begin.</Text>
      <Link href="/explore" asChild><Pressable style={styles.button}><Text style={styles.buttonText}>Browse all shiurim</Text></Pressable></Link>
    </View>
    <View style={styles.quickGrid}>
      <Link href="/parsha" asChild><Pressable style={styles.quickCard}><Text style={styles.quickLabel}>THIS WEEK</Text><Text style={styles.quickTitle}>Parsha</Text><Text style={styles.quickText}>Find learning for the current Torah reading.</Text></Pressable></Link>
      <Link href="/rabbis/bakhshi" asChild><Pressable style={styles.quickCard}><Text style={styles.quickLabel}>TEACHER</Text><Text style={styles.quickTitle}>Rabbi Isaac Bakhshi</Text><Text style={styles.quickText}>Browse his audio and video classes.</Text></Pressable></Link>
      <Link href="/favorites" asChild><Pressable style={styles.quickCard}><Text style={styles.quickLabel}>YOUR LIBRARY</Text><Text style={styles.quickTitle}>Continue listening</Text><Text style={styles.quickText}>Return to favorites and recent shiurim.</Text></Pressable></Link>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  wrap: { gap: 16, marginBottom: 18 },
  compactWelcome: { backgroundColor: '#eaf5fb', borderColor: '#cfe6f2', borderRadius: 14, borderWidth: 1, paddingHorizontal: 22, paddingVertical: 18 },
  kicker: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  kickerDot: { backgroundColor: '#147d89', borderRadius: 99, height: 7, width: 7 },
  eyebrow: { color: '#147d89', fontSize: 12, fontWeight: '800', letterSpacing: 1.5 },
  heroTitle: { color: '#102a43', fontSize: 30, fontWeight: '800', lineHeight: 36, marginTop: 8 },
  heroText: { color: '#486581', fontSize: 15, lineHeight: 23, marginTop: 7, maxWidth: 680 },
  button: { alignItems: 'center', backgroundColor: '#123b63', borderRadius: 8, paddingHorizontal: 18, paddingVertical: 12 },
  buttonText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  quickCard: { backgroundColor: '#fff', borderColor: '#d9e7ef', borderRadius: 10, borderWidth: 1, flex: 1, minWidth: 190, padding: 15 },
  quickLabel: { color: '#147d89', fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  quickTitle: { color: '#123b63', fontSize: 17, fontWeight: '800', marginTop: 5 },
  quickText: { color: '#627d98', fontSize: 13, lineHeight: 19, marginTop: 5 },
});
