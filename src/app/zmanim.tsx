import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { apiUrl } from '@/lib/api';

type ZmanimPayload = { location?: string; times?: Record<string, string>; error?: string };
const labels = ['Alos HaShachar', 'Misheyakir', 'Sunrise', 'Sof Zman Kriat Shema', 'Sof Zman Tefillah', 'Chatzos', 'Mincha Gedolah', 'Mincha Ketanah', 'Plag HaMincha', 'Sunset', 'Tzais'];

export default function ZmanimScreen() {
  const [payload, setPayload] = useState<ZmanimPayload | null>(null);
  useEffect(() => { fetch(apiUrl('/api/zmanim')).then((response) => response.json()).then(setPayload).catch(() => setPayload({ error: 'Zmanim are not available right now.' })); }, []);
  return <ScrollView contentContainerStyle={styles.page}><View style={styles.card}><Text style={styles.eyebrow}>TODAY'S ZMANIM</Text>{!payload && <ActivityIndicator color="#147d89" />}{payload?.error && <Text style={styles.body}>{payload.error}</Text>}{payload && !payload.error && <><Text style={styles.location}>{payload.location}</Text>{labels.map((label) => <View key={label} style={styles.row}><Text style={styles.label}>{label}</Text><Text style={styles.time}>{payload.times?.[label] || '—'}</Text></View>)}</>}</View></ScrollView>;
}

const styles = StyleSheet.create({ page: { backgroundColor: '#f7fbfd', flexGrow: 1, padding: 28 }, card: { alignSelf: 'center', backgroundColor: '#fff', borderColor: '#d9e7ef', borderRadius: 16, borderWidth: 1, maxWidth: 760, padding: 30, width: '100%' }, eyebrow: { color: '#147d89', fontSize: 12, fontWeight: '800', letterSpacing: 1.4 }, location: { color: '#486581', fontSize: 16, marginVertical: 16 }, body: { color: '#486581', fontSize: 16, lineHeight: 25, marginTop: 20 }, row: { borderBottomColor: '#e7eef3', borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12 }, label: { color: '#486581', fontSize: 15 }, time: { color: '#123b63', fontSize: 15, fontWeight: '800' } });
