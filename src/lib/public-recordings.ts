import type { ListenerRecording } from '@/components/listener-provider';
import { apiUrl } from '@/lib/api';
import { normalizeRecordingTitle } from '@/lib/recording-title';
export { apiUrl } from '@/lib/api';
const fallbackCover = require('@/assets/shiur-covers/fallback.png');

type ApiRecording = {
  id: string;
  name: string;
  title?: string;
  rabbiName?: string | null;
  category?: string;
  description?: string;
  streamUrl: string;
  coverUrl?: string | null;
  recordedDateLabel?: string | null;
  durationSeconds?: number | null;
  shiurStartSeconds?: number | null;
  shiurStartSource?: 'automatic' | 'manual' | null;
  shiurStartConfidence?: number | null;
  shiurSkipEnabled?: boolean;
};
export function toListenerRecording(recording: ApiRecording): ListenerRecording { return { id: recording.id, title: normalizeRecordingTitle(recording.title || recording.name, recording.recordedDateLabel || ''), speaker: recording.rabbiName || 'Torat Tsion', category: recording.category || 'Torah', description: recording.description, durationSeconds: recording.durationSeconds, source: apiUrl(recording.streamUrl), coverUrl: recording.coverUrl ? apiUrl(recording.coverUrl) : null, coverAsset: fallbackCover, shiurStartSeconds: recording.shiurStartSeconds ?? null, shiurStartSource: recording.shiurStartSource ?? null, shiurStartConfidence: recording.shiurStartConfidence ?? null, shiurSkipEnabled: recording.shiurSkipEnabled ?? (typeof recording.shiurStartSeconds === 'number' && recording.shiurStartSeconds > 0), }; }
export async function loadListenerRecordings() { const response = await fetch(apiUrl('/api/home')); const payload = await response.json() as { recordings?: ApiRecording[]; error?: string }; if (!response.ok) throw new Error(payload.error || 'Unable to load recordings'); return (payload.recordings || []).map(toListenerRecording); }
