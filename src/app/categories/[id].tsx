import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { PublicRecordingList } from '@/components/public-site';
import { apiUrl } from '@/lib/public-recordings';

type Recording = { id: string; name: string; title?: string; category?: string; categoryId?: string | null; streamUrl: string; coverUrl?: string | null; rabbiName?: string | null };
type Category = { id: string; name: string; description?: string };
export default function CategoryPage() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [category, setCategory] = useState<Category | null>(null);
  const [recordings, setRecordings] = useState<Recording[] | null>(null);
  useEffect(() => { fetch(apiUrl('/api/home')).then((response) => response.json()).then((payload: { categories?: Category[]; recordings?: Recording[] }) => { const match = payload.categories?.find((item) => item.id === id); setCategory(match || null); setRecordings((payload.recordings || []).filter((recording) => recording.categoryId === id || recording.category === match?.name)); }); }, [id]);
  if (!recordings) return <View style={{ alignItems: 'center', flex: 1, justifyContent: 'center' }}><ActivityIndicator color="#2d6cdf" /></View>;
  return <PublicRecordingList title={category?.name || 'Category'} description={category?.description} recordings={recordings} />;
}