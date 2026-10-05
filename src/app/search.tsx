import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { PublicRecordingList } from '@/components/public-site';
import { fetchPublicJson } from '@/lib/public-api-cache';

type Recording = { id: string; name: string; title?: string; streamUrl: string };
export default function SearchPage() {
  const { q } = useLocalSearchParams<{ q?: string }>();
  const [recordings, setRecordings] = useState<Recording[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setRecordings(null);
    setError(null);
    fetchPublicJson<{ results?: Recording[] }>(`/api/search?q=${encodeURIComponent(q || '')}`, 30_000)
      .then((payload) => setRecordings(payload.results || []))
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Unable to search recordings'));
  }, [q]);
  if (recordings === null) return <View style={{ alignItems: 'center', flex: 1, justifyContent: 'center' }}><ActivityIndicator color="#2d6cdf" /></View>;
  if (error) return <View style={{ alignItems: 'center', flex: 1, justifyContent: 'center', padding: 24 }}><Text style={{ color: '#b42318' }}>{error}</Text></View>;
  return <PublicRecordingList title={`Search results${q ? ` for “${q}”` : ''}`} recordings={recordings} />;
}