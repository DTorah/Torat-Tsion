import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { apiUrl } from '@/lib/api';

type ParshaPayload = { parsha?: string | null; hebrewDate?: string; gregorianDate?: string; error?: string };

export default function ParshaScreen() {
  const [payload, setPayload] = useState<ParshaPayload | null>(null);
  useEffect(() => { fetch(apiUrl('/api/parsha')).then((response) => response.json()).then(setPayload).catch(() => setPayload({ error: 'Parsha information is not available right now.' })); }, []);
  return <ScrollView contentContainerStyle={styles.page}><View style={styles.card}><Text style={styles.eyebrow}>THIS WEEK'S PARSHA</Text>{!payload && <ActivityIndicator color="#147d89" />}{payload?.error && <Text style={styles.body}>{payload.error}</Text>}{payload && !payload.error && <><Text style={styles.title}>{payload.parsha || 'No weekly reading'}</Text><Text style={styles.date}>{payload.hebrewDate}</Text><Text style={styles.date}>{payload.gregorianDate}</Text><Text style={styles.body}>Browse the library for related Rabbi Bakhshi shiurim, audio, and video.</Text></>}</View></ScrollView>;
}

const styles = StyleSheet.create({ page: { backgroundColor: '#f7fbfd', flexGrow: 1, padding: 28 }, card: { alignSelf: 'center', backgroundColor: '#fff', borderColor: '#d9e7ef', borderRadius: 16, borderWidth: 1, maxWidth: 760, padding: 34, width: '100%' }, eyebrow: { color: '#147d89', fontSize: 12, fontWeight: '800', letterSpacing: 1.4 }, title: { color: '#102a43', fontSize: 38, fontWeight: '800', marginTop: 14 }, date: { color: '#486581', fontSize: 16, marginTop: 8 }, body: { color: '#486581', fontSize: 16, lineHeight: 25, marginTop: 22 } });
