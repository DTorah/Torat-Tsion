const audioDisplaySuffix = /\.(?:3g2|3gp|3gpp|aac|ac3|aif|aiff|alac|amr|ape|caf|flac|m4a|m4b|mid|midi|mka|mp3|mp4|oga|ogg|ogx|opus|wav|wma|weba|webm)(?:\.ogx)?$/i;
const { formatParenthesizedRecordingDate, parseFilenameRecordingDate } = require('./recording-date');

function displayRecordingTitle(value, fallback = '', timeZone, filename = value) {
  const title = String(value || '').trim();
  const withoutExtension = title.replace(audioDisplaySuffix, '').trim();
  const withoutTimestampPrefix = withoutExtension.replace(/^(?:\d{8}|\d{6})[ _-]?\d{4}(?:[ _-]+)?/, '');
  let normalized = (withoutTimestampPrefix || withoutExtension).replace(/[_]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
  if (!normalized || /^(?:\d{8}|\d{6})[ _-]?\d{4}$/.test(normalized)) normalized = String(fallback || '').trim();
  if (!normalized) return '';
  const dateMatch = /(?:^|\s)\((\d{1,2})-(\d{1,2})-(\d{2}|\d{4})\)$/.exec(normalized);
  if (dateMatch) {
    const dateLabel = formatParenthesizedRecordingDate(Number(dateMatch[1]), Number(dateMatch[2]), Number(dateMatch[3]), timeZone);
    if (dateLabel) {
      const text = normalized.slice(0, dateMatch.index).trim();
      normalized = text ? `${text} — ${dateLabel}` : dateLabel;
    }
  }
  const parsedDate = parseFilenameRecordingDate(filename, timeZone);
  if (parsedDate?.recordedDateLabel && !normalized.includes(parsedDate.recordedDateLabel)) {
    normalized = `${normalized} — ${parsedDate.recordedDateLabel}`;
  }
  return normalized;
}

module.exports = { displayRecordingTitle };
