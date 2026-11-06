import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { ToratSionHome } from '@/components/torat-sion-home';
import { adminApiUrl } from '@/components/admin-shell';

type Override = { content?: string; style?: { color?: string; backgroundColor?: string; fontSize?: number; fontWeight?: string; textAlign?: string } };
type BuilderDocument = { design?: Record<string, unknown>; sections?: unknown[]; elements?: Record<string, Override> };

export function VisualEditorSurface({ token, onExit }: { token: string; onExit: () => void }) {
  const [selectedId, setSelectedId] = useState('');
  const [selectedLabel, setSelectedLabel] = useState('');
  const [value, setValue] = useState('');
  const [draft, setDraft] = useState<BuilderDocument | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetch(adminApiUrl('/api/admin/home-builder'), { headers: { Authorization: `Bearer ${token}` } }).then(async (response) => {
      if (!response.ok) throw new Error('Unable to load editor draft');
      const payload = await response.json() as { draft?: BuilderDocument };
      setDraft(payload.draft || { design: {}, sections: [], elements: {} });
    }).catch((error) => setMessage(error instanceof Error ? error.message : 'Unable to load editor draft'));
  }, [token]);
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const handleClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest('[data-editor-id]') : null;
      if (!target) return;
      event.preventDefault();
      event.stopPropagation();
      const id = target.getAttribute('data-editor-id') || '';
      setSelectedId(id);
      setSelectedLabel(target.getAttribute('aria-label') || target.getAttribute('data-editor-kind') || 'Element');
      setValue(target.textContent?.trim() || '');
    };
    document.addEventListener('click', handleClick, true);
    return () => document.removeEventListener('click', handleClick, true);
  }, []);
  const save = async () => {
    if (!draft || !selectedId) return;
    const next = { ...draft, elements: { ...(draft.elements || {}), [selectedId]: { ...(draft.elements?.[selectedId] || {}), content: value } } };
    setDraft(next);
    if (typeof window !== 'undefined') {
      const element = window.document.querySelector(`[data-editor-id="${CSS.escape(selectedId)}"]`);
      if (element) element.textContent = value;
    }
    const response = await fetch(adminApiUrl('/api/admin/home-builder/draft'), { method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(next) });
    setMessage(response.ok ? 'Draft override saved.' : 'Unable to save draft override.');
  };
  return <View style={styles.surface}><View style={styles.toolbar}><Text style={styles.mode}>EDITOR MODE</Text><Text style={styles.path}>{selectedLabel || 'Click any registered element on the real website'}</Text><Pressable onPress={onExit} style={styles.close}><Text style={styles.closeText}>Exit</Text></Pressable></View>{selectedId ? <View style={styles.inspector}><Text style={styles.inspectorTitle}>{selectedLabel}</Text><TextInput accessibilityLabel="Edit selected element" onChangeText={setValue} style={styles.input} value={value} /><Pressable onPress={() => void save()} style={styles.save}><Text style={styles.saveText}>Save element draft</Text></Pressable>{message ? <Text style={styles.message}>{message}</Text> : null}</View> : null}<View style={styles.site}><ToratSionHome /></View></View>;
}

const styles = StyleSheet.create({
  surface: { backgroundColor: '#f5f1e8', flex: 1 },
  toolbar: { alignItems: 'center', backgroundColor: '#10213d', flexDirection: 'row', gap: 14, minHeight: 52, paddingHorizontal: 18 },
  mode: { color: '#d9b56d', fontSize: 11, fontWeight: '900', letterSpacing: 1.5 },
  path: { color: '#f3f5f8', flex: 1, fontSize: 12 },
  close: { borderColor: '#9eb6d9', borderRadius: 7, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 7 },
  closeText: { color: '#fff', fontWeight: '800' },
  inspector: { backgroundColor: '#fff', borderBottomColor: '#d9e2ef', borderBottomWidth: 1, padding: 12 },
  inspectorTitle: { color: '#10213d', fontSize: 13, fontWeight: '800', marginBottom: 6 },
  input: { borderColor: '#b6c4d6', borderRadius: 7, borderWidth: 1, color: '#10213d', minHeight: 40, paddingHorizontal: 10 },
  save: { alignSelf: 'flex-start', backgroundColor: '#0052CC', borderRadius: 7, marginTop: 8, paddingHorizontal: 12, paddingVertical: 9 },
  saveText: { color: '#fff', fontWeight: '800' },
  message: { color: '#33704d', fontSize: 12, marginTop: 6 },
  site: { flex: 1 },
});
