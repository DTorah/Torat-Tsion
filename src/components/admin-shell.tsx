import { Stack, usePathname, useRouter } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { apiUrl } from '@/lib/api';

export const adminApiUrl = apiUrl;
export type AdminHeaders = { Authorization: string };

const navigation = [
  ['Dashboard', '/admin'], ['Recordings', '/admin/recordings'], ['Rabbis', '/admin/rabbis'], ['Categories', '/admin/categories'],
  ['Featured Content', '/admin/featured'], ['Carousel', '/admin/carousel'], ['Covers', '/admin/covers'],
] as const;
let activeAdminToken: string | null = null;
const adminTokenStorageKey = 'torat-tsion-admin-session';

function persistAdminToken(token: string | null) {
  if (typeof window === 'undefined') return;
  if (token) window.sessionStorage.setItem(adminTokenStorageKey, token);
  else window.sessionStorage.removeItem(adminTokenStorageKey);
}

export function AdminLogin({ onLogin }: { onLogin: (token: string) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const login = async () => {
    setLoading(true); setError(null);
    try {
      const response = await fetch(adminApiUrl('/api/admin/login'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
      const payload = await response.json() as { sessionToken?: string; error?: string };
      if (!response.ok || !payload.sessionToken) throw new Error(payload.error || 'Unable to sign in');
      onLogin(payload.sessionToken);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to sign in'); }
    finally { setLoading(false); }
  };
  return <View style={styles.login}><Text style={styles.eyebrow}>SHIVTI / ADMIN</Text><Text style={styles.title}>Admin sign in</Text><Text style={styles.muted}>Use the server-configured admin credentials.</Text><TextInput autoCapitalize="none" autoCorrect={false} onChangeText={setUsername} placeholder="Username" placeholderTextColor="#7F8992" style={styles.input} value={username} /><TextInput autoCapitalize="none" onChangeText={setPassword} placeholder="Password" placeholderTextColor="#7F8992" secureTextEntry style={styles.input} value={password} /><Pressable disabled={loading} onPress={login} style={[styles.primary, loading && styles.disabled]}><Text style={styles.primaryText}>{loading ? 'Signing in...' : 'Sign in'}</Text></Pressable>{error && <Text style={styles.error}>{error}</Text>}</View>;
}

export function AdminShell({ token, title, children }: { token: string; title: string; children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const logout = () => {
    activeAdminToken = null;
    persistAdminToken(null);
    router.replace('/admin' as never);
  };
  return <SafeAreaView style={styles.safe}><Stack.Screen options={{ title, headerShown: false }} /><ScrollView contentContainerStyle={styles.container}><View style={styles.header}><Pressable onPress={() => router.push('/')} style={styles.back}><Text style={styles.backText}>‹</Text></Pressable><View style={styles.headerCopy}><Text style={styles.eyebrow}>SHIVTI / ADMIN</Text><Text style={styles.title}>{title}</Text></View><Pressable accessibilityLabel="Log out" onPress={logout} style={styles.logout}><Text style={styles.logoutText}>Log out</Text></Pressable></View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.nav}>{navigation.map(([label, href]) => <Pressable key={label} disabled={!href} onPress={() => href && router.push(href as never)} style={[styles.navItem, href === pathname && styles.navActive, !href && styles.navDisabled]}><Text style={styles.navText}>{label}</Text></Pressable>)}</ScrollView>{children}</ScrollView></SafeAreaView>;
}

export function useAdminSession() {
  const [token, setTokenState] = useState<string | null>(activeAdminToken);
  useEffect(() => {
    if (activeAdminToken || typeof window === 'undefined') return;
    const storedToken = window.sessionStorage.getItem(adminTokenStorageKey);
    if (storedToken) {
      activeAdminToken = storedToken;
      setTokenState(storedToken);
    }
  }, []);
  const setToken = (nextToken: string) => {
    activeAdminToken = nextToken;
    persistAdminToken(nextToken);
    setTokenState(nextToken);
  };
  return { token, setToken, headers: token ? { Authorization: `Bearer ${token}` } : undefined };
}

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: '#101a2e' }, container: { padding: 20, paddingBottom: 48 }, header: { alignItems: 'center', flexDirection: 'row', marginBottom: 20 }, headerCopy: { flex: 1 }, back: { alignItems: 'center', height: 44, justifyContent: 'center', marginRight: 8, width: 36 }, backText: { color: '#F2F7FF', fontSize: 36 }, logout: { borderColor: '#9bbce8', borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8 }, logoutText: { color: '#d7e7ff', fontSize: 11, fontWeight: '700' }, eyebrow: { color: '#8bbcff', fontSize: 10, fontWeight: '800', letterSpacing: 1.5 }, title: { color: '#F2F7FF', fontSize: 27, fontWeight: '700', marginTop: 5 }, muted: { color: '#a9bad2', fontSize: 13, lineHeight: 19, marginTop: 8 }, nav: { gap: 8, paddingBottom: 8 }, navItem: { borderColor: '#30486b', borderRadius: 8, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10 }, navActive: { backgroundColor: '#2d6cdf', borderColor: '#2d6cdf' }, navDisabled: { opacity: 0.45 }, navText: { color: '#F2F7FF', fontSize: 12, fontWeight: '700' }, login: { backgroundColor: '#162544', borderColor: '#30486b', borderRadius: 14, borderWidth: 1, marginTop: 24, padding: 20 }, input: { backgroundColor: '#101a2e', borderColor: '#30486b', borderRadius: 9, borderWidth: 1, color: '#F2F7FF', height: 50, marginTop: 12, paddingHorizontal: 14 }, primary: { alignItems: 'center', backgroundColor: '#2d6cdf', borderRadius: 9, justifyContent: 'center', minHeight: 48, marginTop: 14 }, primaryText: { color: '#ffffff', fontWeight: '800' }, error: { color: '#ff9f9f', fontSize: 13, marginTop: 14, textAlign: 'center' }, disabled: { opacity: 0.5 }, panel: { backgroundColor: '#162544', borderColor: '#30486b', borderRadius: 12, borderWidth: 1, marginTop: 18, padding: 16 }, panelTitle: { color: '#F2F7FF', fontSize: 17, fontWeight: '700' }, action: { borderColor: '#49678f', borderRadius: 8, borderWidth: 1, marginTop: 10, padding: 12 }, actionText: { color: '#8bbcff', fontWeight: '700' }, state: { alignItems: 'center', padding: 32 }, stateText: { color: '#a9bad2', marginTop: 10 }, loading: { marginTop: 28 }, row: { alignItems: 'center', borderBottomColor: '#30486b', borderBottomWidth: 1, flexDirection: 'row', gap: 10, paddingVertical: 14 }, rowCopy: { flex: 1 }, rowTitle: { color: '#F2F7FF', fontSize: 15, fontWeight: '700' }, rowMeta: { color: '#a9bad2', fontSize: 12, marginTop: 4 }, danger: { color: '#ff9f9f', fontSize: 12, fontWeight: '700' }, formLabel: { color: '#c5d6ee', fontSize: 12, fontWeight: '700', marginTop: 14 }, formInput: { backgroundColor: '#101a2e', borderColor: '#30486b', borderRadius: 8, borderWidth: 1, color: '#F2F7FF', minHeight: 46, marginTop: 6, paddingHorizontal: 12 }, textarea: { minHeight: 90, paddingTop: 12 }, switch: { color: '#8bbcff', fontWeight: '800' } });
