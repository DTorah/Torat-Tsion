import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { apiUrl } from '@/lib/api';

type Minyan = { name: string; time: string; location?: string; day?: string };
export default function MinyanimScreen() {
  const [items, setItems] = useState<Minyan[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { fetch(apiUrl('/api/minyanim')).then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.error); setItems(data.minyanim || []); }).catch((reason) => setError(reason instanceof Error ? reason.message : 'Minyan information is not available right now.')); }, []);
  return <ScrollView contentContainerStyle={styles.page}><View style={styles.card}><Text style={styles.eyebrow}>MINYANIM</Text><Text style={styles.title}>Community prayer times</Text>{!items && !error && <ActivityIndicator color="#147d89" />}{error && <Text style={styles.body}>{error}</Text>}{items?.length === 0 && <Text style={styles.body}>Minyan times have not been published yet.</Text>}{items?.map((item) => <View key={`${item.day}-${item.name}-${item.time}`} style={styles.row}><View><Text style={styles.name}>{item.name}</Text><Text style={styles.meta}>{item.day || 'Schedule'}{item.location ? ` · ${item.location}` : ''}</Text></View><Text style={styles.time}>{item.time}</Text></View>)}</View></ScrollView>;
}

const styles = StyleSheet.create({ page: { backgroundColor: '#f7fbfd', flexGrow: 1, padding: 28 }, card: { alignSelf: 'center', backgroundColor: '#fff', borderColor: '#d9e7ef', borderRadius: 16, borderWidth: 1, maxWidth: 760, padding: 30, width: '100%' }, eyebrow: { color: '#147d89', fontSize: 12, fontWeight: '800', letterSpacing: 1.4 }, title: { color: '#102a43', fontSize: 32, fontWeight: '800', marginBottom: 22, marginTop: 10 }, body: { color: '#486581', fontSize: 16, lineHeight: 25, marginTop: 18 }, row: { borderBottomColor: '#e7eef3', borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 14 }, name: { color: '#123b63', fontSize: 16, fontWeight: '800' }, meta: { color: '#627d98', fontSize: 13, marginTop: 4 }, time: { color: '#147d89', fontSize: 17, fontWeight: '800' } });
