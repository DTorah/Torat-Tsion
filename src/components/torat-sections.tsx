import { Link } from 'expo-router';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { ahavatShalomYouTubeUrl, donationUrl, torahHelpUrl } from '@/lib/site';

function ExternalButton({ label, url, secondary = false }: { label: string; url: string; secondary?: boolean }) {
  return <Pressable onPress={() => Linking.openURL(url)} style={[styles.button, secondary && styles.secondaryButton]}><Text style={[styles.buttonText, secondary && styles.secondaryButtonText]}>{label}</Text></Pressable>;
}

export function ToratWelcome() {
  return <View style={styles.wrap}>
    <View style={styles.hero}>
      <View style={styles.heroCopy}>
        <Text style={styles.eyebrow}>TORAT TSION</Text>
        <Text style={styles.heroTitle}>A welcoming place to learn, listen, and grow.</Text>
        <Text style={styles.heroText}>Explore Torah audio and video, connect with the rhythm of the Jewish year, and find the information your community needs.</Text>
        <View style={styles.actions}><Link href="/explore" asChild><Pressable style={styles.button}><Text style={styles.buttonText}>Explore shiurim</Text></Pressable></Link><Link href="/rabbis/bakhshi" asChild><Pressable style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>Rabbi Bakhshi</Text></Pressable></Link></View>
      </View>
      <View style={styles.heroArt}><Text style={styles.aleph}>ת</Text><Text style={styles.artCaption}>Torah learning for every day</Text></View>
    </View>
    <View style={styles.quickGrid}>
      <Link href="/parsha" asChild><Pressable style={styles.quickCard}><Text style={styles.quickTitle}>This Week's Parsha</Text><Text style={styles.quickText}>Study the current reading with related learning.</Text></Pressable></Link>
      <Link href="/zmanim" asChild><Pressable style={styles.quickCard}><Text style={styles.quickTitle}>Today's Zmanim</Text><Text style={styles.quickText}>Daily times for your configured community location.</Text></Pressable></Link>
      <Link href="/minyanim" asChild><Pressable style={styles.quickCard}><Text style={styles.quickTitle}>Minyanim</Text><Text style={styles.quickText}>Published weekday, Shabbos, and holiday schedules.</Text></Pressable></Link>
    </View>
    <View style={styles.rabbiSection}><View style={styles.sectionCopy}><Text style={styles.eyebrow}>RABBI YITZCHAK BAKHSHI</Text><Text style={styles.sectionTitle}>Torah that meets you where you are.</Text><Text style={styles.sectionText}>Find featured and latest learning from the Torat Tsion library. Additional classes are clearly marked when they are hosted externally.</Text><View style={styles.actions}><Link href="/rabbis/bakhshi" asChild><Pressable style={styles.button}><Text style={styles.buttonText}>View Rabbi Bakhshi</Text></Pressable></Link><ExternalButton label="TorahHelp website" url={torahHelpUrl} secondary /></View></View><View style={styles.quote}><Text style={styles.quoteMark}>“</Text><Text style={styles.quoteText}>Make space for learning, reflection, and community.</Text></View></View>
    <View style={styles.support}><View><Text style={styles.supportTitle}>Support Torah Learning</Text><Text style={styles.supportText}>Help sustain access to Torah resources and community learning.</Text></View><ExternalButton label="Donate" url={donationUrl} /></View>
    <View style={styles.external}><Text style={styles.sectionTitleSmall}>More Classes by Rabbi Yitzchak Bakhshi</Text><Text style={styles.sectionText}>Explore additional classes on YouTube.</Text><ExternalButton label="Ahavat Shalom on YouTube" url={ahavatShalomYouTubeUrl} secondary /></View>
  </View>;
}

const styles = StyleSheet.create({
  wrap: { gap: 28, marginBottom: 28 },
  hero: { backgroundColor: '#eaf5fb', borderColor: '#cfe6f2', borderRadius: 20, borderWidth: 1, flexDirection: 'row', gap: 20, overflow: 'hidden', padding: 32 },
  heroCopy: { flex: 1, maxWidth: 650 },
  eyebrow: { color: '#147d89', fontSize: 12, fontWeight: '800', letterSpacing: 1.5 },
  heroTitle: { color: '#102a43', fontSize: 42, fontWeight: '800', lineHeight: 49, marginTop: 12 },
  heroText: { color: '#486581', fontSize: 17, lineHeight: 27, marginTop: 16 },
  actions: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 22 },
  button: { alignItems: 'center', backgroundColor: '#123b63', borderRadius: 8, paddingHorizontal: 18, paddingVertical: 12 },
  buttonText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  secondaryButton: { alignItems: 'center', backgroundColor: '#fff', borderColor: '#b8d7e6', borderRadius: 8, borderWidth: 1, paddingHorizontal: 18, paddingVertical: 12 },
  secondaryButtonText: { color: '#123b63', fontSize: 14, fontWeight: '800' },
  heroArt: { alignItems: 'center', backgroundColor: '#d6edf5', justifyContent: 'center', minHeight: 220, minWidth: 190, padding: 20 },
  aleph: { color: '#123b63', fontSize: 112, fontWeight: '300' },
  artCaption: { color: '#356078', fontSize: 12, fontWeight: '700', textAlign: 'center' },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  quickCard: { backgroundColor: '#fff', borderColor: '#d9e7ef', borderRadius: 12, borderWidth: 1, flex: 1, minWidth: 190, padding: 20 },
  quickTitle: { color: '#123b63', fontSize: 18, fontWeight: '800' },
  quickText: { color: '#627d98', fontSize: 14, lineHeight: 21, marginTop: 8 },
  rabbiSection: { backgroundColor: '#f5f9fb', borderColor: '#d9e7ef', borderRadius: 16, borderWidth: 1, flexDirection: 'row', gap: 24, padding: 26 },
  sectionCopy: { flex: 1 },
  sectionTitle: { color: '#102a43', fontSize: 28, fontWeight: '800', lineHeight: 35, marginTop: 8 },
  sectionText: { color: '#486581', fontSize: 15, lineHeight: 24, marginTop: 10 },
  quote: { alignItems: 'center', backgroundColor: '#e7f4f5', justifyContent: 'center', maxWidth: 260, padding: 24 },
  quoteMark: { color: '#147d89', fontSize: 64, height: 45, lineHeight: 60 },
  quoteText: { color: '#164e63', fontSize: 18, fontWeight: '700', lineHeight: 26, textAlign: 'center' },
  support: { alignItems: 'center', backgroundColor: '#123b63', borderRadius: 14, flexDirection: 'row', justifyContent: 'space-between', padding: 24 },
  supportTitle: { color: '#fff', fontSize: 23, fontWeight: '800' },
  supportText: { color: '#d9eef5', fontSize: 14, marginTop: 6 },
  external: { borderTopColor: '#d9e7ef', borderTopWidth: 1, paddingTop: 22 },
  sectionTitleSmall: { color: '#123b63', fontSize: 20, fontWeight: '800' },
});
