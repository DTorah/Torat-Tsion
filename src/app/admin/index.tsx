import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AdminLogin, AdminShell, adminApiUrl, useAdminSession } from '@/components/admin-shell';

const stageTwo = [['Analytics', '/admin/analytics'], ['Recordings', '/admin/recordings'], ['Rabbis', '/admin/rabbis'], ['Categories', '/admin/categories'], ['Featured', '/admin/featured'], ['Covers', '/admin/covers'], ['Carousel', '/admin/carousel']] as const;
type DriveDiagnostic = {
  configuredFolderId?: string;
  folderFormatValid?: boolean;
  oauthEmail?: string | null;
  metadataAccessible?: boolean;
  folderName?: string | null;
  folderMimeType?: string | null;
  childrenAccessible?: boolean;
  childCount?: number;
  driveAccess?: boolean;
  error?: string;
  errorCode?: string;
  errorStatus?: number | string | null;
  googleCode?: number | string | null;
  errorReason?: string | null;
  errorMessage?: string | null;
};
type YoutubeDiagnostic = {
  totalVideos?: number;
  liveVideos?: number;
  upcomingVideos?: number;
  archivedLiveVideos?: number;
  sources?: Array<{ key: string; label: string; error?: string | null; diagnostics?: { totalRetrieved?: number; discoveredCount?: number; liveCount?: number; upcomingCount?: number; archivedLiveCount?: number } }>;
  error?: string;
};

export default function AdminDashboard() {
  const router = useRouter();
  const session = useAdminSession();
  const [driveDiagnostic, setDriveDiagnostic] = useState<DriveDiagnostic | null>(null);
  const [driveDiagnosticLoading, setDriveDiagnosticLoading] = useState(false);
  const [driveDiagnosticMessage, setDriveDiagnosticMessage] = useState<string | null>(null);
  const [youtubeDiagnostic, setYoutubeDiagnostic] = useState<YoutubeDiagnostic | null>(null);
  const [youtubeDiagnosticMessage, setYoutubeDiagnosticMessage] = useState<string | null>(null);
  const [youtubeDiagnosticLoading, setYoutubeDiagnosticLoading] = useState(false);

  const runDriveDiagnostic = async () => {
    if (!session.token || driveDiagnosticLoading) return;
    setDriveDiagnosticLoading(true);
    setDriveDiagnosticMessage(null);
    try {
      const response = await fetch(adminApiUrl('/auth/google/diagnostic'), {
        headers: { Authorization: `Bearer ${session.token}` },
      });
      const payload = await response.json() as DriveDiagnostic;
      if (!response.ok) throw new Error(payload.error || 'Admin authentication is required');
      setDriveDiagnostic(payload);
    } catch (reason) {
      setDriveDiagnosticMessage(reason instanceof Error ? reason.message : 'Unable to run Drive diagnostic');
    } finally {
      setDriveDiagnosticLoading(false);
    }
  };
  const runYoutubeDiagnostic = async () => {
    if (!session.token || youtubeDiagnosticLoading) return;
    setYoutubeDiagnosticLoading(true);
    setYoutubeDiagnosticMessage(null);
    try {
      const response = await fetch(adminApiUrl('/api/admin/youtube/diagnostic'), { headers: { Authorization: `Bearer ${session.token}` } });
      const payload = await response.json() as YoutubeDiagnostic;
      if (!response.ok) throw new Error(payload.error || 'Unable to run YouTube diagnostic');
      setYoutubeDiagnostic(payload);
    } catch (reason) {
      setYoutubeDiagnosticMessage(reason instanceof Error ? reason.message : 'Unable to run YouTube diagnostic');
    } finally {
      setYoutubeDiagnosticLoading(false);
    }
  };

  useEffect(() => {
    if (session.token) void runDriveDiagnostic();
    if (session.token) void runYoutubeDiagnostic();
  }, [session.token]);

  if (!session.token) return <AdminLogin onLogin={session.setToken} />;
  return (
    <AdminShell token={session.token} title="Dashboard">
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>Content control center</Text>
        <Text style={styles.heroText}>Manage the public library without rebuilding the Android app.</Text>
      </View>
      <View style={styles.drivePanel}>
        <View style={styles.driveHeading}>
          <View style={styles.driveCopy}>
            <Text style={styles.panelTitle}>Google Drive connection</Text>
            <Text style={styles.cardText}>Secure admin-only verification of the Torat Sion media folder.</Text>
          </View>
          <View style={styles.drivePanel}>
            <View style={styles.driveHeading}>
              <View style={styles.driveCopy}>
                <Text style={styles.panelTitle}>YouTube synchronization</Text>
                <Text style={styles.cardText}>All discovered uploads, live broadcasts, and archived livestreams from both configured channels.</Text>
              </View>
              <Pressable disabled={youtubeDiagnosticLoading} onPress={() => void runYoutubeDiagnostic()} style={[styles.action, youtubeDiagnosticLoading && styles.disabled]}><Text style={styles.actionText}>{youtubeDiagnosticLoading ? 'Syncing...' : 'Run sync check'}</Text></Pressable>
            </View>
            {youtubeDiagnosticMessage && <Text style={styles.error}>{youtubeDiagnosticMessage}</Text>}
            {youtubeDiagnostic && <View style={styles.diagnosticGrid}>
              <Diagnostic label="Total unique videos" value={String(youtubeDiagnostic.totalVideos ?? 0)} />
              <Diagnostic label="Live now" value={String(youtubeDiagnostic.liveVideos ?? 0)} />
              <Diagnostic label="Upcoming" value={String(youtubeDiagnostic.upcomingVideos ?? 0)} />
              <Diagnostic label="Archived livestreams" value={String(youtubeDiagnostic.archivedLiveVideos ?? 0)} />
              {youtubeDiagnostic.sources?.map((source) => <View key={source.key} style={styles.diagnosticItem}><Text style={styles.diagnosticLabel}>{source.label}</Text><Text style={styles.diagnosticValue}>{source.error || `Found ${source.diagnostics?.discoveredCount ?? 0} of ${source.diagnostics?.totalRetrieved ?? 0} retrieved uploads · live ${source.diagnostics?.liveCount ?? 0} · archived ${source.diagnostics?.archivedLiveCount ?? 0}`}</Text></View>)}
            </View>}
          </View>
          <Pressable disabled={driveDiagnosticLoading} onPress={() => void runDriveDiagnostic()} style={[styles.action, driveDiagnosticLoading && styles.disabled]}>
            <Text style={styles.actionText}>{driveDiagnosticLoading ? 'Checking...' : 'Run check'}</Text>
          </Pressable>
        </View>
        {driveDiagnosticMessage && <Text style={styles.error}>{driveDiagnosticMessage}</Text>}
        {driveDiagnostic && (
          <View style={styles.diagnosticGrid}>
            <Diagnostic label="Folder ID" value={driveDiagnostic.configuredFolderId || 'Unavailable'} />
            <Diagnostic label="Folder format" value={driveDiagnostic.folderFormatValid ? 'Valid' : 'Invalid'} />
            <Diagnostic label="OAuth account" value={driveDiagnostic.oauthEmail || 'Unavailable'} />
            <Diagnostic label="Metadata access" value={driveDiagnostic.metadataAccessible ? 'Accessible' : 'Unavailable'} />
            <Diagnostic label="Folder" value={driveDiagnostic.folderName || 'Unavailable'} />
            <Diagnostic label="Child listing" value={driveDiagnostic.childrenAccessible ? `Accessible (${driveDiagnostic.childCount ?? 0} shown)` : 'Unavailable'} />
            <Diagnostic label="Drive access" value={driveDiagnostic.driveAccess ? 'Verified' : 'Not verified'} emphasis={!driveDiagnostic.driveAccess} />
            {driveDiagnostic.error && <Text style={styles.error}>{driveDiagnostic.error}</Text>}
            {driveDiagnostic.errorCode && (
              <Diagnostic
                label="Google error"
                value={`${driveDiagnostic.errorCode} · Google ${driveDiagnostic.googleCode ?? 'unknown'} · HTTP ${driveDiagnostic.errorStatus ?? 'unknown'} · ${driveDiagnostic.errorReason || driveDiagnostic.errorMessage || 'No further detail'}`}
                emphasis
              />
            )}
          </View>
        )}
      </View>
      <Text style={styles.section}>CONTENT MANAGEMENT</Text>
      <View style={styles.grid}>
        {stageTwo.map(([label, href]) => (
          <Pressable key={label} onPress={() => router.push(href as never)} style={styles.card}>
            <Text style={styles.cardTitle}>{label}</Text>
            <Text style={styles.cardText}>Open management</Text>
          </Pressable>
        ))}
      </View>
    </AdminShell>
  );
}
function Diagnostic({ label, value, emphasis = false }: { label: string; value: string; emphasis?: boolean }) {
  return <View style={styles.diagnosticItem}><Text style={styles.diagnosticLabel}>{label}</Text><Text style={[styles.diagnosticValue, emphasis && styles.diagnosticWarning]} selectable>{value}</Text></View>;
}
const styles = StyleSheet.create({ hero: { backgroundColor: '#26343A', borderRadius: 12, marginTop: 18, padding: 22 }, heroTitle: { color: '#F2EEE7', fontSize: 22, fontWeight: '700' }, heroText: { color: '#B7C0C0', fontSize: 13, lineHeight: 20, marginTop: 8 }, section: { color: '#2d6cdf', fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginTop: 28 }, grid: { gap: 10, marginTop: 12 }, card: { backgroundColor: '#1B2026', borderColor: '#303740', borderRadius: 10, borderWidth: 1, padding: 17 }, cardTitle: { color: '#F2EEE7', fontSize: 16, fontWeight: '700' }, cardText: { color: '#89909A', fontSize: 12, marginTop: 5 }, later: { backgroundColor: '#171C21', borderColor: '#283039', borderRadius: 10, borderWidth: 1, marginTop: 12, paddingHorizontal: 16 }, laterRow: { alignItems: 'center', borderBottomColor: '#283039', borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 14 }, laterTitle: { color: '#A7ADB5', fontSize: 14 }, badge: { color: '#69717B', fontSize: 9, fontWeight: '800', letterSpacing: 1 }, drivePanel: { backgroundColor: '#162544', borderColor: '#30486B', borderRadius: 12, borderWidth: 1, marginTop: 18, padding: 16 }, driveHeading: { alignItems: 'flex-start', flexDirection: 'row', gap: 12 }, driveCopy: { flex: 1 }, panelTitle: { color: '#F2F7FF', fontSize: 17, fontWeight: '700' }, action: { borderColor: '#7FADE5', borderRadius: 8, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10 }, actionText: { color: '#A9D0FF', fontSize: 12, fontWeight: '800' }, disabled: { opacity: 0.5 }, diagnosticGrid: { gap: 9, marginTop: 16 }, diagnosticItem: { borderBottomColor: '#30486B', borderBottomWidth: 1, paddingBottom: 8 }, diagnosticLabel: { color: '#A9BAD2', fontSize: 11, fontWeight: '700' }, diagnosticValue: { color: '#F2F7FF', fontFamily: 'monospace', fontSize: 13, marginTop: 3 }, diagnosticWarning: { color: '#FFB4B4' }, error: { color: '#FFB4B4', fontSize: 12, marginTop: 10 } });
