import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { PublicDirectory } from '@/components/public-site';
import { fetchPublicJson } from '@/lib/public-api-cache';

type Rabbi = { id: string; name: string; description?: string };
export default function RabbisPage() {
  const [rabbis, setRabbis] = useState<Rabbi[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { fetchPublicJson<{ rabbis?: Rabbi[] }>('/api/rabbis').then((payload) => setRabbis(payload.rabbis || [])).catch((reason) => setError(reason instanceof Error ? reason.message : 'Unable to load Rabbis')).finally(() => setLoading(false)); }, []);
  if (loading) return <View style={{ alignItems: 'center', flex: 1, justifyContent: 'center' }}><ActivityIndicator color="#2d6cdf" /></View>;
  if (error) return <View style={{ alignItems: 'center', flex: 1, justifyContent: 'center', padding: 24 }}><Text style={{ color: '#b42318' }}>{error}</Text></View>;
  if (!rabbis.length) return <View style={{ alignItems: 'center', flex: 1, justifyContent: 'center', padding: 24 }}><Text style={{ color: '#142950', fontSize: 20, fontWeight: '800' }}>No Rabbis yet.</Text><Text style={{ color: '#5b6e8d', marginTop: 8 }}>Drive folders will appear here when available.</Text></View>;
  return <PublicDirectory title="Rabbis" description="Listen by the voices and teachers behind Torat Tsion." items={rabbis} kind="rabbi" />;
}