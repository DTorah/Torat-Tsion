import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { PublicRecordingList } from '@/components/public-site';
import { apiUrl } from '@/lib/public-recordings';
import { matchesAdminCategory } from '@/lib/recording-category';

type Recording = { id: string; name: string; title?: string; description?: string; category?: string; categoryId?: string | null; streamUrl: string; coverUrl?: string | null; rabbiName?: string | null };
type Category = { id: string; name: string; description?: string };
export default function CategoryPage() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [category, setCategory] = useState<Category | null>(null);
  const [recordings, setRecordings] = useState<Recording[] | null>(null);
  useEffect(() => { fetch(apiUrl('/api/home')).then(async (response) => { const payload = await response.json() as { categories?: Category[]; recordings?: Recording[]; error?: string }; if (!response.ok) throw new Error(payload.error || 'Unable to load category'); const match = payload.categories?.find((item) => item.id === id); setCategory(match || null); setRecordings(match ? (payload.recordings || []).filter((recording) => matchesAdminCategory(recording, match)) : []); }).catch(() => { setCategory(null); setRecordings([]); }); }, [id]);
  if (!recordings) return <View style={{ alignItems: 'center', flex: 1, justifyContent: 'center' }}><ActivityIndicator color="#2d6cdf" /></View>;
  return <PublicRecordingList title={category?.name || 'Category'} description={category?.description} recordings={recordings} timeFrameCategoryId={category?.id} />;
}