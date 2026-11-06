export type EditorElementKind = 'site' | 'page' | 'section' | 'text' | 'image' | 'button' | 'link' | 'video-card' | 'shelf' | 'navigation';

export type EditorElementStyle = {
  color?: string;
  backgroundColor?: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: string;
  textAlign?: 'left' | 'center' | 'right';
  padding?: number;
  margin?: number;
  borderRadius?: number;
  opacity?: number;
  width?: number | string;
  height?: number | string;
  visible?: boolean;
};

export type EditorElement = {
  id: string;
  kind: EditorElementKind;
  label: string;
  page: string;
  content?: string;
  href?: string;
  mediaId?: string;
  style?: EditorElementStyle;
  children?: string[];
};

export type EditorElementOverrides = Record<string, Partial<EditorElement>>;

export function editorElementId(page: string, kind: EditorElementKind, key: string) {
  return `editor:${page}:${kind}:${key}`.replace(/[^A-Za-z0-9:_-]/g, '-');
}

export function editorAttributes(element: EditorElement) {
  return {
    nativeID: element.id,
    accessibilityLabel: `Edit ${element.label}`,
    'data-editor-id': element.id,
    'data-editor-kind': element.kind,
  };
}

export function applyEditorOverride<T extends EditorElement>(element: T, overrides: EditorElementOverrides): T {
  const override = overrides[element.id];
  if (!override) return element;
  return { ...element, ...override, style: { ...element.style, ...override.style } };
}
