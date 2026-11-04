import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { AdminLogin, AdminShell, adminApiUrl, useAdminSession } from '@/components/admin-shell';

type SectionType = 'video-shelf' | 'featured-banner' | 'grid' | 'carousel' | 'playlist' | 'announcement' | 'text' | 'image' | 'category-collection';
type BuilderVideo = { id: string; title: string; thumbnailUrl?: string | null; publishedAt?: string | null; channelTitle?: string; sourceKey?: string; };
type Section = { id: string; type: SectionType; title: string; subtitle?: string; enabled: boolean; layout: 'shelf' | 'grid' | 'featured'; columns: number; visibleCount: number; background?: string; textColor?: string; source?: string; videoIds?: string[]; description?: string; banner?: { videoId?: string; imageUrl?: string; title?: string; description?: string; buttonText?: string; overlay?: string; textAlign?: 'left' | 'center' | 'right'; height?: number }; responsive?: { desktop?: boolean; tablet?: boolean; mobile?: boolean; cardWidth?: number; spacing?: number }; };
type BuilderDocument = { design: { theme?: string; background?: string; accent?: string; text?: string; font?: string; radius?: number }; sections: Section[] };
type BuilderResponse = { draft: BuilderDocument; published?: BuilderDocument | null; history?: Array<{ id: string; createdAt: string; createdBy?: string; draft: BuilderDocument }>; deleted?: Section[]; error?: string };

const sectionTypes: Array<[SectionType, string]> = [
  ['featured-banner', 'Featured banner'], ['video-shelf', 'Video shelf'], ['grid', 'Video grid'], ['carousel', 'Carousel'],
  ['playlist', 'Playlist'], ['announcement', 'Announcement'], ['text', 'Text block'], ['image', 'Image block'], ['category-collection', 'Category collection'],
];

function newSection(type: SectionType, index: number): Section {
  const label = sectionTypes.find(([value]) => value === type)?.[1] || 'Homepage section';
  return { id: `section-${Date.now()}-${index}`, type, title: label, subtitle: '', enabled: true, layout: type === 'featured-banner' ? 'featured' : type === 'grid' ? 'grid' : 'shelf', columns: 4, visibleCount: 12, background: '#FFFFFF', textColor: '#111827', videoIds: [], responsive: { desktop: true, tablet: true, mobile: true, cardWidth: 320, spacing: 24 } };
}

export default function HomepageBuilderPage() {
  const session = useAdminSession();
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const [document, setDocument] = useState<BuilderDocument>({ design: {}, sections: [] });
  const [history, setHistory] = useState<BuilderDocument[]>([]);
  const [redo, setRedo] = useState<BuilderDocument[]>([]);
  const [deleted, setDeleted] = useState<Section[]>([]);
  const [versions, setVersions] = useState<BuilderResponse['history']>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const [videos, setVideos] = useState<BuilderVideo[]>([]);
  const [videoSearch, setVideoSearch] = useState('');
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [device, setDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');

  const load = async () => {
    if (!session.token) return;
    setLoading(true);
    try {
      const response = await fetch(adminApiUrl('/api/admin/home-builder'), { headers: { Authorization: `Bearer ${session.token}` } });
      const payload = await response.json() as BuilderResponse;
      if (!response.ok) throw new Error(payload.error || 'Unable to load homepage builder');
      setDocument(payload.draft);
      setDeleted(payload.deleted || []);
      setVersions(payload.history || []);
      setHistory([]);
      setRedo([]);
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : 'Unable to load homepage builder');
    } finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [session.token]);
  useEffect(() => {
    fetch(adminApiUrl('/api/videos')).then(async (response) => {
      if (!response.ok) throw new Error('Unable to load videos');
      const payload = await response.json() as { sources?: Array<{ videos?: BuilderVideo[] }> };
      setVideos([...new Map((payload.sources || []).flatMap((source) => source.videos || []).map((video) => [video.id, video])).values()]);
    }).catch(() => setMessage('Video selector is unavailable. Existing selections are preserved.'));
  }, []);

  const update = (next: BuilderDocument) => {
    setHistory((items) => [...items.slice(-30), document]);
    setRedo([]);
    setDocument(next);
  };
  const updateSection = (id: string, patch: Partial<Section>) => update({ ...document, sections: document.sections.map((section) => section.id === id ? { ...section, ...patch } : section) });
  const selectedSection = document.sections.find((section) => section.id === selectedSectionId) || null;
  const selectedVideos = selectedSection?.videoIds || [];
  const updateSelectedSection = (patch: Partial<Section>) => { if (selectedSection) updateSection(selectedSection.id, patch); };
  const toggleVideo = (videoId: string) => {
    if (!selectedSection) return;
    const next = selectedVideos.includes(videoId) ? selectedVideos.filter((id) => id !== videoId) : [...selectedVideos, videoId];
    updateSelectedSection({ videoIds: next });
  };
  const moveVideo = (index: number, direction: -1 | 1) => {
    if (!selectedSection) return;
    const target = index + direction;
    if (target < 0 || target >= selectedVideos.length) return;
    const next = [...selectedVideos];
    [next[index], next[target]] = [next[target], next[index]];
    updateSelectedSection({ videoIds: next });
  };
  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= document.sections.length) return;
    const sections = [...document.sections];
    [sections[index], sections[target]] = [sections[target], sections[index]];
    update({ ...document, sections });
  };
  const add = (type: SectionType) => update({ ...document, sections: [...document.sections, newSection(type, document.sections.length)] });
  const duplicate = (section: Section) => update({ ...document, sections: [...document.sections, { ...section, id: `section-${Date.now()}`, title: `${section.title} copy` }] });
  const remove = (section: Section) => { setDeleted((items) => [...items, section]); update({ ...document, sections: document.sections.filter((item) => item.id !== section.id) }); };
  const undo = () => { const previous = history[history.length - 1]; if (!previous) return; setRedo((items) => [...items, document]); setDocument(previous); setHistory((items) => items.slice(0, -1)); };
  const redoChange = () => { const next = redo[redo.length - 1]; if (!next) return; setHistory((items) => [...items, document]); setDocument(next); setRedo((items) => items.slice(0, -1)); };
  const reorderByDrop = (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;
    const from = document.sections.findIndex((section) => section.id === sourceId);
    const to = document.sections.findIndex((section) => section.id === targetId);
    if (from < 0 || to < 0) return;
    const sections = [...document.sections];
    const [moved] = sections.splice(from, 1);
    sections.splice(to, 0, moved);
    update({ ...document, sections });
  };
  const saveDraft = async (publish = false) => {
    if (!session.token || saving) return;
    setSaving(true); setMessage(null);
    try {
      const save = await fetch(adminApiUrl('/api/admin/home-builder/draft'), { method: 'PUT', headers: { Authorization: `Bearer ${session.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(document) });
      if (!save.ok) throw new Error((await save.json() as { error?: string }).error || 'Unable to save draft');
      if (publish) {
        const publishResponse = await fetch(adminApiUrl('/api/admin/home-builder/publish'), { method: 'POST', headers: { Authorization: `Bearer ${session.token}` } });
        if (!publishResponse.ok) throw new Error((await publishResponse.json() as { error?: string }).error || 'Unable to publish homepage');
        setVersions((await (await fetch(adminApiUrl('/api/admin/home-builder'), { headers: { Authorization: `Bearer ${session.token}` } })).json() as BuilderResponse).history || []);
        setMessage('Homepage published successfully.');
      } else setMessage('Draft saved. Visitors still see the last published version.');
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : 'Unable to save homepage'); }
    finally { setSaving(false); }
  };
  const restore = async (id: string) => {
    if (!session.token) return;
    const response = await fetch(adminApiUrl(`/api/admin/home-builder/restore/${id}`), { method: 'POST', headers: { Authorization: `Bearer ${session.token}` } });
    if (response.ok) { setMessage('Version restored to the draft. Save or publish to apply it.'); await load(); }
  };
  const restoreDeleted = (section: Section) => { setDeleted((items) => items.filter((item) => item.id !== section.id)); update({ ...document, sections: [...document.sections, { ...section, enabled: false }] }); };
  const selectedTab = String(tab || 'builder');
  const tabTitle = selectedTab === 'design' ? 'Design Studio' : selectedTab === 'history' ? 'Publishing & Version History' : selectedTab === 'banners' ? 'Banner Manager' : 'Homepage Builder';
  const visibleSections = useMemo(() => document.sections.filter((section) => section.enabled), [document.sections]);
  const filteredVideos = useMemo(() => {
    const query = videoSearch.trim().toLowerCase();
    return videos.filter((video) => !query || `${video.title} ${video.channelTitle || ''}`.toLowerCase().includes(query)).slice(0, 80);
  }, [videoSearch, videos]);
  const previewSection = (section: Section) => {
    const sectionVideos = (section.videoIds || []).map((id) => videos.find((video) => video.id === id)).filter((video): video is BuilderVideo => Boolean(video));
    const bannerVideo = videos.find((video) => video.id === section.banner?.videoId);
    const isVisible = section.responsive?.[device] !== false;
    return <Pressable key={section.id} accessibilityLabel={`Edit ${section.title || 'section'}`} onPress={() => setSelectedSectionId(section.id)} style={[styles.previewSection, { backgroundColor: section.background || '#fff', opacity: isVisible ? 1 : 0.45 }, selectedSectionId === section.id && styles.previewSelected]}>
      <Pressable onPress={() => setSelectedSectionId(section.id)}><Text style={{ color: section.textColor || document.design.text || '#111827', fontSize: 20, fontWeight: '800' }}>{section.banner?.title || section.title || 'Untitled section'}</Text></Pressable>
      {section.subtitle ? <Text style={styles.muted}>{section.subtitle}</Text> : null}
      {section.banner?.description ? <Text style={styles.previewDescription}>{section.banner.description}</Text> : null}
      {bannerVideo ? <Image contentFit="cover" source={{ uri: bannerVideo.thumbnailUrl || '' }} style={styles.previewBannerImage} /> : null}
      <View style={styles.previewVideoRow}>{sectionVideos.slice(0, section.visibleCount).map((video) => <Pressable key={video.id} onPress={() => setSelectedSectionId(section.id)} style={styles.previewVideo}><Image contentFit="cover" source={{ uri: video.thumbnailUrl || '' }} style={styles.previewThumb} /><Text numberOfLines={2} style={styles.previewVideoTitle}>{video.title}</Text></Pressable>)}</View>
      <Text style={styles.previewType}>{section.type} · {section.layout} · {sectionVideos.length || section.visibleCount} items · {device}</Text>
    </Pressable>;
  };
  const dragProps = (section: Section) => Platform.OS === 'web' ? {
    draggable: true,
    onDragStart: (event: { nativeEvent?: { dataTransfer?: { setData: (type: string, value: string) => void } } }) => event.nativeEvent?.dataTransfer?.setData('text/plain', section.id),
    onDragOver: (event: { preventDefault?: () => void }) => event.preventDefault?.(),
    onDrop: (event: { nativeEvent?: { dataTransfer?: { getData: (type: string) => string } } }) => reorderByDrop(event.nativeEvent?.dataTransfer?.getData('text/plain') || '', section.id),
  } : {};

  if (!session.token) return <AdminLogin onLogin={session.setToken} />;
  return <AdminShell token={session.token} title={tabTitle}>
    {loading ? <View style={styles.state}><ActivityIndicator color="#8bbcff" /></View> : <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.toolbar}><View><Text style={styles.eyebrow}>VISUAL CMS</Text><Text style={styles.title}>{tabTitle}</Text><Text style={styles.muted}>Edit the homepage visually. Nothing is public until you publish.</Text></View><View style={styles.toolbarActions}><Pressable onPress={() => setPreview(!preview)} style={styles.secondary}><Text style={styles.secondaryText}>{preview ? 'Close preview' : 'Preview'}</Text></Pressable><Pressable disabled={saving} onPress={() => void saveDraft(false)} style={styles.secondary}><Text style={styles.secondaryText}>Save draft</Text></Pressable><Pressable disabled={saving} onPress={() => void saveDraft(true)} style={styles.primary}><Text style={styles.primaryText}>{saving ? 'Publishing…' : 'Publish'}</Text></Pressable></View></View>
      {message && <Text style={styles.message}>{message}</Text>}
      {preview ? <View style={[styles.preview, { backgroundColor: document.design.background || '#F8F9FA' }]}><View style={styles.previewToolbar}><Text style={[styles.previewTitle, { color: document.design.text || '#111827' }]}>Live homepage preview</Text><View style={styles.deviceRow}>{(['desktop', 'tablet', 'mobile'] as const).map((value) => <Pressable key={value} onPress={() => setDevice(value)} style={[styles.deviceButton, device === value && styles.deviceButtonActive]}><Text style={styles.deviceText}>{value}</Text></Pressable>)}</View></View>{visibleSections.map(previewSection)}{selectedSection && <View style={styles.inspector}><Text style={styles.inspectorTitle}>Editing: {selectedSection.title}</Text><Text style={styles.formLabel}>Section heading</Text><TextInput onChangeText={(title) => updateSelectedSection({ title })} style={styles.input} value={selectedSection.title} /><Text style={styles.formLabel}>Subtitle</Text><TextInput onChangeText={(subtitle) => updateSelectedSection({ subtitle })} style={styles.input} value={selectedSection.subtitle} /><Text style={styles.formLabel}>Description</Text><TextInput multiline onChangeText={(description) => updateSelectedSection({ description })} style={styles.input} value={selectedSection.description || ''} /><Text style={styles.formLabel}>Background / text colors</Text><View style={styles.formRow}><TextInput onChangeText={(background) => updateSelectedSection({ background })} style={styles.input} value={selectedSection.background || '#FFFFFF'} /><TextInput onChangeText={(textColor) => updateSelectedSection({ textColor })} style={styles.input} value={selectedSection.textColor || '#111827'} /></View><Text style={styles.formLabel}>Visibility: {device}</Text><Pressable onPress={() => updateSelectedSection({ responsive: { ...selectedSection.responsive, [device]: selectedSection.responsive?.[device] === false } })} style={styles.tool}><Text style={styles.toolText}>{selectedSection.responsive?.[device] === false ? 'Hidden on this device' : 'Visible on this device'}</Text></Pressable></View>}</View> : <>
        <View style={styles.controlRow}><Pressable disabled={!history.length} onPress={undo} style={styles.tool}><Text style={styles.toolText}>Undo</Text></Pressable><Pressable disabled={!redo.length} onPress={redoChange} style={styles.tool}><Text style={styles.toolText}>Redo</Text></Pressable><Text style={styles.unsaved}>{history.length ? 'Unpublished changes' : 'Saved state'}</Text></View>
        <Text style={styles.sectionHeading}>Add section</Text><View style={styles.typeRow}>{sectionTypes.map(([type, label]) => <Pressable key={type} onPress={() => add(type)} style={styles.typeButton}><Text style={styles.typeText}>＋ {label}</Text></Pressable>)}</View>
        <Text style={styles.sectionHeading}>Homepage sections</Text>{document.sections.map((section, index) => <View {...dragProps(section)} key={section.id} onTouchEnd={() => setSelectedSectionId(section.id)} style={[styles.sectionCard, !section.enabled && styles.hiddenCard, selectedSectionId === section.id && styles.sectionSelected]}><View style={styles.sectionTop}><View style={styles.sectionCopy}><Text style={styles.sectionNumber}>{index + 1}</Text><TextInput onChangeText={(title) => updateSection(section.id, { title })} style={styles.sectionTitle} value={section.title} /><Text style={styles.sectionType}>{section.type} · drag to reorder</Text></View><View style={styles.rowActions}><Pressable onPress={() => move(index, -1)}><Text style={styles.actionText}>↑</Text></Pressable><Pressable onPress={() => move(index, 1)}><Text style={styles.actionText}>↓</Text></Pressable><Pressable onPress={() => duplicate(section)}><Text style={styles.actionText}>Duplicate</Text></Pressable><Pressable onPress={() => updateSection(section.id, { enabled: !section.enabled })}><Text style={styles.actionText}>{section.enabled ? 'Hide' : 'Show'}</Text></Pressable><Pressable onPress={() => remove(section)}><Text style={styles.danger}>Delete</Text></Pressable></View></View><View style={styles.formRow}><TextInput onChangeText={(subtitle) => updateSection(section.id, { subtitle })} placeholder="Subtitle" placeholderTextColor="#7f8992" style={styles.input} value={section.subtitle} /><TextInput keyboardType="number-pad" onChangeText={(value) => updateSection(section.id, { visibleCount: Math.max(1, Number(value) || 1) })} style={styles.smallInput} value={String(section.visibleCount)} /><Text style={styles.inputHint}>items</Text><TextInput keyboardType="number-pad" onChangeText={(value) => updateSection(section.id, { columns: Math.max(1, Number(value) || 1) })} style={styles.smallInput} value={String(section.columns)} /><Text style={styles.inputHint}>columns</Text></View><Pressable onPress={() => setPreview(true)} style={styles.editButton}><Text style={styles.actionText}>Edit this section in preview →</Text></Pressable></View>)}
        {!document.sections.length && <Text style={styles.muted}>Start with a professional section template above.</Text>}
        {selectedSection && <View style={styles.inspector}><Text style={styles.inspectorTitle}>Selected section: {selectedSection.title}</Text><Text style={styles.formLabel}>Search authentic YouTube videos</Text><TextInput onChangeText={setVideoSearch} placeholder="Search title or channel" placeholderTextColor="#7f8992" style={styles.input} value={videoSearch} /><Text style={styles.muted}>{selectedVideos.length} selected · click to add or remove, then use arrows to order</Text><ScrollView style={styles.videoSelector}>{filteredVideos.map((video) => { const selected = selectedVideos.includes(video.id); const selectedIndex = selectedVideos.indexOf(video.id); return <Pressable key={video.id} onPress={() => toggleVideo(video.id)} style={[styles.videoOption, selected && styles.videoOptionSelected]}><Image contentFit="cover" source={{ uri: video.thumbnailUrl || '' }} style={styles.videoThumb} /><View style={styles.videoMeta}><Text numberOfLines={2} style={styles.videoTitle}>{video.title}</Text><Text numberOfLines={1} style={styles.videoSub}>{video.channelTitle || video.sourceKey || 'YouTube'}{video.publishedAt ? ` · ${new Date(video.publishedAt).toLocaleDateString()}` : ''}</Text></View>{selected && <View style={styles.videoOrder}><Pressable onPress={(event) => { event.stopPropagation(); moveVideo(selectedIndex, -1); }}><Text style={styles.actionText}>↑</Text></Pressable><Pressable onPress={(event) => { event.stopPropagation(); moveVideo(selectedIndex, 1); }}><Text style={styles.actionText}>↓</Text></Pressable></View>}</Pressable>; })}</ScrollView>{selectedSection.type === 'featured-banner' && <><Text style={styles.formLabel}>Banner controls</Text><TextInput onChangeText={(title) => updateSelectedSection({ banner: { ...selectedSection.banner, title } })} placeholder="Display title override" placeholderTextColor="#7f8992" style={styles.input} value={selectedSection.banner?.title || ''} /><TextInput multiline onChangeText={(description) => updateSelectedSection({ banner: { ...selectedSection.banner, description } })} placeholder="Banner description" placeholderTextColor="#7f8992" style={styles.input} value={selectedSection.banner?.description || ''} /><TextInput onChangeText={(buttonText) => updateSelectedSection({ banner: { ...selectedSection.banner, buttonText } })} placeholder="Button label" placeholderTextColor="#7f8992" style={styles.input} value={selectedSection.banner?.buttonText || ''} /><View style={styles.formRow}>{selectedVideos.slice(0, 1).map((id) => <Pressable key={id} onPress={() => updateSelectedSection({ banner: { ...selectedSection.banner, videoId: id } })} style={styles.tool}><Text style={styles.toolText}>{selectedSection.banner?.videoId === id ? 'Banner video selected' : 'Use first selected video'}</Text></Pressable>)}</View></>}</View>}
        {deleted.length > 0 && <><Text style={styles.sectionHeading}>Recently deleted</Text>{deleted.map((section) => <View key={section.id} style={styles.deletedRow}><Text style={styles.muted}>{section.title}</Text><Pressable onPress={() => restoreDeleted(section)}><Text style={styles.actionText}>Restore</Text></Pressable></View>)}</>}
        <Text style={styles.sectionHeading}>Design Studio</Text><View style={styles.designCard}><Text style={styles.formLabel}>Theme preset</Text><TextInput onChangeText={(theme) => update({ ...document, design: { ...document.design, theme } })} style={styles.input} value={document.design.theme || 'torat-sion'} /><Text style={styles.formLabel}>Background color</Text><TextInput onChangeText={(background) => update({ ...document, design: { ...document.design, background } })} style={styles.input} value={document.design.background || '#F8F9FA'} /><Text style={styles.formLabel}>Accent color</Text><TextInput onChangeText={(accent) => update({ ...document, design: { ...document.design, accent } })} style={styles.input} value={document.design.accent || '#0052CC'} /><Text style={styles.formLabel}>Font family</Text><TextInput onChangeText={(font) => update({ ...document, design: { ...document.design, font } })} style={styles.input} value={document.design.font || 'Inter, system-ui, sans-serif'} /></View>
        <Text style={styles.sectionHeading}>Version history</Text>{versions?.map((version) => <View key={version.id} style={styles.deletedRow}><Text style={styles.muted}>{new Date(version.createdAt).toLocaleString()} · {version.createdBy || 'admin'}</Text><Pressable onPress={() => void restore(version.id)}><Text style={styles.actionText}>Restore</Text></Pressable></View>)}
      </>}
    </ScrollView>}
  </AdminShell>;
}

const styles = StyleSheet.create({
  content: { paddingBottom: 60 },
  state: { alignItems: 'center', padding: 48 },
  toolbar: { alignItems: 'flex-start', flexDirection: 'row', gap: 18, justifyContent: 'space-between' },
  toolbarActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  eyebrow: { color: '#8bbcff', fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  title: { color: '#F2F7FF', fontSize: 27, fontWeight: '700', marginTop: 5 },
  muted: { color: '#a9bad2', fontSize: 13, lineHeight: 19, marginTop: 7 },
  primary: { backgroundColor: '#2d6cdf', borderRadius: 8, paddingHorizontal: 15, paddingVertical: 11 },
  primaryText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  secondary: { borderColor: '#49678f', borderRadius: 8, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 10 },
  secondaryText: { color: '#c5d6ee', fontSize: 12, fontWeight: '700' },
  message: { backgroundColor: '#15365b', borderRadius: 8, color: '#c8e0ff', marginTop: 14, padding: 12 },
  controlRow: { alignItems: 'center', flexDirection: 'row', gap: 8, marginTop: 24 },
  tool: { borderColor: '#30486b', borderRadius: 7, borderWidth: 1, paddingHorizontal: 11, paddingVertical: 8 },
  toolText: { color: '#c5d6ee', fontSize: 12, fontWeight: '700' },
  unsaved: { color: '#e5bd75', fontSize: 12, marginLeft: 8 },
  sectionHeading: { color: '#8bbcff', fontSize: 11, fontWeight: '800', letterSpacing: 1.3, marginTop: 28 },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  typeButton: { backgroundColor: '#1b2a46', borderColor: '#30486b', borderRadius: 8, borderWidth: 1, paddingHorizontal: 11, paddingVertical: 9 },
  typeText: { color: '#d7e7ff', fontSize: 12, fontWeight: '700' },
  sectionCard: { backgroundColor: '#162544', borderColor: '#30486b', borderRadius: 11, borderWidth: 1, marginTop: 12, padding: 14 },
  hiddenCard: { opacity: 0.55 },
  sectionTop: { alignItems: 'flex-start', flexDirection: 'row', justifyContent: 'space-between' },
  sectionCopy: { alignItems: 'center', flexDirection: 'row', flex: 1, gap: 9 },
  sectionNumber: { color: '#8bbcff', fontSize: 12, fontWeight: '800' },
  sectionTitle: { color: '#F2F7FF', flex: 1, fontSize: 16, fontWeight: '700', padding: 0 },
  sectionType: { color: '#7f9abd', fontSize: 11 },
  rowActions: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  actionText: { color: '#8bbcff', fontSize: 12, fontWeight: '800' },
  danger: { color: '#ff9f9f', fontSize: 12, fontWeight: '800' },
  formRow: { alignItems: 'center', flexDirection: 'row', gap: 8, marginTop: 12 },
  input: { backgroundColor: '#101a2e', borderColor: '#30486b', borderRadius: 7, borderWidth: 1, color: '#F2F7FF', flex: 1, minHeight: 42, paddingHorizontal: 10 },
  smallInput: { backgroundColor: '#101a2e', borderColor: '#30486b', borderRadius: 7, borderWidth: 1, color: '#F2F7FF', minHeight: 42, paddingHorizontal: 10, width: 66 },
  inputHint: { color: '#a9bad2', fontSize: 11 },
  designCard: { backgroundColor: '#162544', borderColor: '#30486b', borderRadius: 11, borderWidth: 1, marginTop: 12, padding: 14 },
  formLabel: { color: '#c5d6ee', fontSize: 12, fontWeight: '700', marginBottom: 6, marginTop: 10 },
  deletedRow: { alignItems: 'center', borderBottomColor: '#30486b', borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12 },
  preview: { borderRadius: 14, marginTop: 24, padding: 20 },
  previewToolbar: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  previewTitle: { fontSize: 24, fontWeight: '800', marginBottom: 15 },
  previewSection: { borderColor: 'transparent', borderRadius: 10, borderWidth: 2, marginBottom: 10, minHeight: 90, padding: 16 },
  previewSelected: { borderColor: '#2d6cdf' },
  previewDescription: { color: '#59677c', marginTop: 8 },
  previewBannerImage: { borderRadius: 8, height: 150, marginTop: 12, width: '100%' },
  previewVideoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 },
  previewVideo: { width: 140 },
  previewThumb: { borderRadius: 7, height: 78, width: 140 },
  previewVideoTitle: { color: '#172844', fontSize: 11, fontWeight: '700', marginTop: 5 },
  previewType: { color: '#64748b', fontSize: 11, marginTop: 10 },
  deviceRow: { flexDirection: 'row', gap: 6 },
  deviceButton: { borderColor: '#c4cedc', borderRadius: 6, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 6 },
  deviceButtonActive: { backgroundColor: '#dceaff', borderColor: '#2d6cdf' },
  deviceText: { color: '#30486b', fontSize: 11, fontWeight: '700' },
  inspector: { backgroundColor: '#10203a', borderColor: '#4e76ac', borderRadius: 11, borderWidth: 1, marginTop: 16, padding: 14 },
  inspectorTitle: { color: '#f2f7ff', fontSize: 16, fontWeight: '800', marginBottom: 10 },
  videoSelector: { maxHeight: 420, marginTop: 8 },
  videoOption: { alignItems: 'center', borderColor: '#30486b', borderRadius: 8, borderWidth: 1, flexDirection: 'row', gap: 9, marginBottom: 7, padding: 7 },
  videoOptionSelected: { backgroundColor: '#1d3c68', borderColor: '#65a3ff' },
  videoThumb: { borderRadius: 5, height: 54, width: 96 },
  videoMeta: { flex: 1 },
  videoTitle: { color: '#f2f7ff', fontSize: 12, fontWeight: '700' },
  videoSub: { color: '#9eb2ce', fontSize: 10, marginTop: 4 },
  videoOrder: { flexDirection: 'row', gap: 7 },
  editButton: { marginTop: 12 },
  sectionSelected: { borderColor: '#65a3ff' },
});
