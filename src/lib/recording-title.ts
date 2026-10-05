const AUDIO_DISPLAY_SUFFIX = /\.(?:3g2|3gp|3gpp|aac|ac3|aif|aiff|alac|amr|ape|caf|flac|m4a|m4b|mid|midi|mka|mp3|mp4|oga|ogg|ogx|opus|wav|wma|weba|webm)(?:\.ogx)?$/i;

export function normalizeRecordingTitle(value: string | null | undefined, fallback = ''): string {
  const title = String(value ?? '').trim();
  if (!title) return '';
  const withoutExtension = title.replace(AUDIO_DISPLAY_SUFFIX, '').trim();
  const withoutTimestampPrefix = withoutExtension.replace(/^(?:\d{8}|\d{6})[ _-]?\d{4}(?:[ _-]+)?/, '');
  const cleaned = (withoutTimestampPrefix || withoutExtension)
    .replace(/[_]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return cleaned && !/^(?:\d{8}|\d{6})[ _-]?\d{4}$/.test(cleaned) ? cleaned : fallback;
}
