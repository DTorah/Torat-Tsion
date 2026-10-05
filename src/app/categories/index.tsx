import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { PublicDirectory } from '@/components/public-site';
import { apiUrl } from '@/lib/public-recordings';

type Category = { id: string; name: string; description?: string };
export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(apiUrl('/api/categories'))
      .then((response) => response.json())
      .then((payload: { categories?: Category[] }) => setCategories(payload.categories || []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <View style={styles.loading}><ActivityIndicator color="#2d6cdf" /></View>;
  if (!categories.length) return <View style={styles.empty}><Text style={styles.emptyTitle}>No categories yet.</Text><Text style={styles.emptyText}>The admin can create categories and assign recordings here.</Text></View>;
  return <PublicDirectory title="Categories" description="Find the right subject for your next listening session." items={categories} kind="category" />;
}

const styles = StyleSheet.create({
  loading: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  empty: { alignItems: 'center', flex: 1, justifyContent: 'center', padding: 32 },
  emptyTitle: { color: '#142950', fontSize: 22, fontWeight: '800' },
  emptyText: { color: '#5b6e8d', fontSize: 14, marginTop: 10, textAlign: 'center' },
});