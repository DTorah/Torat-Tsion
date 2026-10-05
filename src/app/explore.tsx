import { Link } from 'expo-router';
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';

const destinations = [
  ['Rabbis', '/rabbis', 'Listen by teacher and voice.'],
  ['Categories', '/categories', 'Explore Torah by subject.'],
  ['Collections', '/collections', 'Curated listening paths.'],
  ['Library', '/favorites', 'Your saved recordings and playlists.'],
  ['Privacy Policy', '/privacy', 'How Torat Tsion handles listening and app data.'],
];
export default function BrowsePage() {
  return <SafeAreaView style={styles.safe}><View style={styles.container}><Text style={styles.eyebrow}>Torat Tsion</Text><Text style={styles.title}>Browse</Text><Text style={styles.description}>Find your next shiur by teacher, subject, collection, or your personal library.</Text><View style={styles.grid}>{destinations.map(([title, href, description]) => <Link key={href} href={href as never} asChild><Pressable style={styles.card}><Text style={styles.cardTitle}>{title}</Text><Text style={styles.cardDescription}>{description}</Text><Text style={styles.arrow}>→</Text></Pressable></Link>)}</View></View></SafeAreaView>;
}
const styles = StyleSheet.create({ safe: { backgroundColor: '#101317', flex: 1 }, container: { padding: 24 }, eyebrow: { color: '#2d6cdf', fontSize: 10, fontWeight: '800', letterSpacing: 1.5 }, title: { color: '#F2EEE7', fontSize: 34, fontWeight: '700', marginTop: 8 }, description: { color: '#A7ADB5', fontSize: 15, lineHeight: 23, marginTop: 12, maxWidth: 580 }, grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 28 }, card: { backgroundColor: '#1B2026', borderColor: '#303740', borderRadius: 10, borderWidth: 1, minHeight: 130, padding: 18, width: 250 }, cardTitle: { color: '#F2EEE7', fontSize: 19, fontWeight: '700' }, cardDescription: { color: '#89909A', fontSize: 13, lineHeight: 19, marginTop: 8 }, arrow: { color: '#2d6cdf', fontSize: 22, marginTop: 12 } });
