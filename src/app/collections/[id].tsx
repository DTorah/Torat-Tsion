import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { PublicRecordingList } from '@/components/public-site';
import { apiUrl } from '@/lib/api';

type Recording = { id: string; name: string; title?: string; streamUrl: string; coverUrl?: string | null; rabbiName?: string | null; category?: string };
export default function CollectionPage() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [payload, setPayload] = useState<{ collection?: { title?: string; name?: string; description?: string }; recordings?: Recording[] } | null>(null);
  useEffect(() => { fetch(apiUrl(`/api/collections/${encodeURIComponent(id || '')}`)).then((response) => response.json()).then(setPayload).catch(() => setPayload({ recordings: [] })); }, [id]);
  if (!payload) return <View style={{ alignItems: 'center', flex: 1, justifyContent: 'center' }}><ActivityIndicator color="#2d6cdf" /></View>;
  return <PublicRecordingList title={payload.collection?.title || payload.collection?.name || 'Collection'} description={payload.collection?.description} recordings={payload.recordings || []} />;
}
