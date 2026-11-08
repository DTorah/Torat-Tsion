import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { AdminLogin, AdminShell, adminApiUrl, useAdminSession } from '@/components/admin-shell';
import { fetchPublicJson } from '@/lib/public-api-cache';

type Analytics = { windowDays: number; pageViews: number; searches: number; videoPlays: number; popularVideos: { videoId: string; plays: number }[] };
type Catalog = { sources?: { videos?: { id: string; title: string }[] }[] };

export default function AnalyticsPage() {
  const session = useAdminSession();
  const router = useRouter();
  const [data, setData] = useState<Analytics | null>(null);
  const [titles, setTitles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    if (!session.token) return;
    let cancelled = false;
    setLoading(true); setError(null);
    fetch(adminApiUrl('/api/admin/analytics'), { headers: { Authorization: `Bearer ${session.token}` }, cache: 'no-store' })
      .then(async (response) => {
        const payload = await response.json() as Analytics & { error?: string };
        if (!response.ok) throw new Error(response.status === 401 ? 'Your session has expired. Sign out and sign in again.' : payload.error || 'Unable to load analytics.');
        if (!cancelled) setData(payload);
      })
      .catch((reason) => { if (!cancelled) setError(reason instanceof Error ? reason.message : 'Unable to load analytics.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [session.token, refresh]);
  useEffect(() => {
    if (!session.token) return;
    let cancelled = false;
    fetchPublicJson<Catalog>('/api/videos', 120_000).then((catalog) => {
      if (!cancelled) setTitles(Object.fromEntries((catalog.sources || []).flatMap((source) => source.videos || []).map((video) => [video.id, video.title])));
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [session.token]);
  if (!session.token) return <AdminLogin onLogin={session.setToken} />;
  return <AdminShell token={session.token} title="Analytics">
    <View style={styles.header}><View><Text style={styles.heading}>Torah Farsi activity</Text><Text style={styles.muted}>A project of Torat Sion · Last {data?.windowDays || 30} days</Text></View><Pressable accessibilityRole="button" disabled={loading} onPress={() => setRefresh((value) => value + 1)} style={styles.button}><Text style={styles.buttonText}>Refresh</Text></Pressable></View>
    {loading ? <ActivityIndicator accessibilityLabel="Loading analytics" color="#b54a61" style={styles.loading} /> : error ? <View style={styles.panel}><Text accessibilityRole="alert" style={styles.error}>{error}</Text><Text style={styles.muted}>Use Refresh to try again.</Text></View> : data ? <>
      <View style={styles.metrics}>{[['Page views', data.pageViews], ['Video selections', data.videoPlays], ['Searches submitted', data.searches]].map(([label, value]) => <View key={String(label)} style={styles.metric}><Text style={styles.metricValue}>{Number(value).toLocaleString()}</Text><Text style={styles.metricLabel}>{label}</Text></View>)}</View>
      <View style={styles.panel}><Text style={styles.heading}>Most selected classes</Text>{data.popularVideos.length ? data.popularVideos.map((video, index) => <Pressable key={video.videoId} accessibilityRole="link" onPress={() => router.push(`/videos?video=${encodeURIComponent(video.videoId)}` as never)} style={styles.row}><Text style={styles.rank}>{index + 1}</Text><View style={styles.rowCopy}><Text style={styles.rowTitle}>{titles[video.videoId] || video.videoId}</Text><Text style={styles.muted}>Open class →</Text></View><Text style={styles.plays}>{video.plays.toLocaleString()}</Text></Pressable>) : <Text style={styles.empty}>No video selections recorded in this period yet.</Text>}</View>
      <Text style={styles.note}>Counts reflect retained activity events, not unique visitors or watch time. Video selections count clicks to play; they do not confirm playback completed. Activity before tracking was enabled is not included.</Text>
    </> : null}
  </AdminShell>;
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 16, marginTop: 20 },
  heading: { color: '#f8edf0', fontSize: 21, fontWeight: '700' },
  muted: { color: '#b9c6d9', fontSize: 12, lineHeight: 19, marginTop: 5 },
  button: { backgroundColor: '#f5e5e9', borderRadius: 10, paddingHorizontal: 18, paddingVertical: 12 },
  buttonText: { color: '#874356', fontWeight: '700' },
  loading: { marginVertical: 48 },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 24 },
  metric: { backgroundColor: '#ffffff', borderRadius: 16, minWidth: 190, flex: 1, padding: 24 },
  metricValue: { color: '#874356', fontSize: 36, fontWeight: '800' },
  metricLabel: { color: '#66545c', fontSize: 13, marginTop: 8 },
  panel: { backgroundColor: '#162544', borderColor: '#30486b', borderWidth: 1, borderRadius: 16, padding: 22, marginTop: 24 },
  row: { alignItems: 'center', borderTopColor: '#30486b', borderTopWidth: 1, flexDirection: 'row', gap: 16, paddingVertical: 16, marginTop: 8 },
  rank: { color: '#c9a35b', fontSize: 18, width: 25 },
  rowCopy: { flex: 1 },
  rowTitle: { color: '#ffffff', fontSize: 14, fontWeight: '600' },
  plays: { color: '#f5d9e1', fontSize: 20, fontWeight: '700' },
  empty: { color: '#b9c6d9', marginTop: 20, lineHeight: 22 },
  note: { color: '#b9c6d9', fontSize: 12, lineHeight: 20, marginTop: 20, maxWidth: 850 },
  error: { color: '#ffb6bd', fontSize: 15 },
});
