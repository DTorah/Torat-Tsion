import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { PublicDirectory } from '@/components/public-site';
import { apiUrl } from '@/lib/api';

type Collection = { id: string; name?: string; title?: string; description?: string };
export default function CollectionsPage() {
  const [items, setItems] = useState<Collection[] | null>(null);
  useEffect(() => { fetch(apiUrl('/api/collections')).then((response) => response.json()).then((payload: { collections?: Collection[] }) => setItems(payload.collections || [])).catch(() => setItems([])); }, []);
  if (!items) return <View style={{ alignItems: 'center', flex: 1, justifyContent: 'center' }}><ActivityIndicator color="#2d6cdf" /></View>;
  return <PublicDirectory title="Collections" description="Curated paths for deeper Torah listening." items={items.map((item) => ({ ...item, name: item.title || item.name || 'Collection' }))} kind="collection" />;
}
