import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AdminLogin, AdminShell, useAdminSession } from '@/components/admin-shell';

const stageTwo = [['Recordings', '/admin/recordings'], ['Rabbis', '/admin/rabbis'], ['Categories', '/admin/categories'], ['Featured', '/admin/featured'], ['Covers', '/admin/covers'], ['Carousel', '/admin/carousel']] as const;
export default function AdminDashboard() {
  const router = useRouter();
  const session = useAdminSession();
  if (!session.token) return <AdminLogin onLogin={session.setToken} />;
  return <AdminShell token={session.token} title="Dashboard"><View style={styles.hero}><Text style={styles.heroTitle}>Content control center</Text><Text style={styles.heroText}>Manage the public library without rebuilding the Android app.</Text></View><Text style={styles.section}>CONTENT MANAGEMENT</Text><View style={styles.grid}>{stageTwo.map(([label, href]) => <Pressable key={label} onPress={() => router.push(href as never)} style={styles.card}><Text style={styles.cardTitle}>{label}</Text><Text style={styles.cardText}>Open management</Text></Pressable>)}</View></AdminShell>;
}
const styles = StyleSheet.create({ hero: { backgroundColor: '#26343A', borderRadius: 12, marginTop: 18, padding: 22 }, heroTitle: { color: '#F2EEE7', fontSize: 22, fontWeight: '700' }, heroText: { color: '#B7C0C0', fontSize: 13, lineHeight: 20, marginTop: 8 }, section: { color: '#2d6cdf', fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginTop: 28 }, grid: { gap: 10, marginTop: 12 }, card: { backgroundColor: '#1B2026', borderColor: '#303740', borderRadius: 10, borderWidth: 1, padding: 17 }, cardTitle: { color: '#F2EEE7', fontSize: 16, fontWeight: '700' }, cardText: { color: '#89909A', fontSize: 12, marginTop: 5 }, later: { backgroundColor: '#171C21', borderColor: '#283039', borderRadius: 10, borderWidth: 1, marginTop: 12, paddingHorizontal: 16 }, laterRow: { alignItems: 'center', borderBottomColor: '#283039', borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 14 }, laterTitle: { color: '#A7ADB5', fontSize: 14 }, badge: { color: '#69717B', fontSize: 9, fontWeight: '800', letterSpacing: 1 } });
