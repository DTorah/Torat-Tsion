const defaultTimeZone = 'America/New_York';
let hebcal;

async function initializeRecordingCalendar() {
  hebcal ||= await import('@hebcal/core');
}

function zonedParts(date, timeZone) {
  const values = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  return Object.fromEntries(values.filter((part) => part.type !== 'literal').map((part) => [part.type, Number(part.value)]));
}

function localDateTimeToInstant({ year, month, day, hour, minute }, timeZone) {
  let instant = Date.UTC(year, month - 1, day, hour, minute);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const actual = zonedParts(new Date(instant), timeZone);
    const target = Date.UTC(year, month - 1, day, hour, minute);
    const observed = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute);
    if (target === observed) return new Date(instant);
    instant += target - observed;
  }
  const result = new Date(instant);
  const verified = zonedParts(result, timeZone);
  return verified.year === year && verified.month === month && verified.day === day && verified.hour === hour && verified.minute === minute ? result : null;
}

function ashkenaziParshaName(name) {
  const names = {
    'Achrei Mot': 'Achrei Mos',
    'Beha\'alotcha': 'Behaaloscha',
    'Bechukotai': 'Bechukosai',
    'Chayei Sara': 'Chayei Sarah',
    'Bereshit': 'Bereshis',
    'Chukat': 'Chukas',
    'Ha\'azinu': 'Haazinu',
    'Ki Tavo': 'Ki Savo',
    'Ki Teitzei': 'Ki Seitzei',
    'Lech-Lecha': 'Lech Lecha',
    Matot: 'Matos',
    Miketz: 'Mikeitz',
    'Re\'eh': 'Reeh',
    Shemot: 'Shemos',
    Toldot: 'Toldos',
    'Va\'era': 'Vaera',
    Vayeshev: 'Vayeishev',
    Vayera: 'Vayeira',
    Vayakhel: 'Vayakhel',
    Vayetzei: 'Vayeitzei',
    Vayigash: 'Vayigash',
    Vayishlach: 'Vayishlach',
    Vayechi: 'Vayechi',
    Yitro: 'Yisro',
  };
  return names[name] || name;
}

function getParshaForDate(date, timeZone = defaultTimeZone) {
  if (!hebcal || !Number.isFinite(date?.getTime?.())) return null;
  try {
    const { year, month, day } = zonedParts(date, timeZone);
    const hebrewDate = new hebcal.HDate(new Date(Date.UTC(year, month - 1, day, 12)));
    const reading = hebcal.getSedra(hebrewDate.getFullYear(), false).lookup(hebrewDate);
    if (!reading || reading.chag || !Array.isArray(reading.parsha) || !reading.parsha.length) return null;
    if (reading.parsha.some((name) => !hebcal.parshiot.includes(name))) return null;
    const names = reading.parsha.map(ashkenaziParshaName);
    if (names.some((name) => !/^[A-Za-z' -]+$/.test(name))) return null;
    return `Parshas ${names.join('-')}`;
  } catch {
    return null;
  }
}

function formatRecordingDate(date, timeZone, includeTime = true) {
  const gregorian = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
  const hebrew = new Intl.DateTimeFormat('en-u-ca-hebrew', {
    timeZone,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
  const parsha = getParshaForDate(date, timeZone);
  const parts = [gregorian];
  if (includeTime) {
    parts.push(new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', minute: '2-digit' }).format(date));
  }
  if (parsha) parts.push(parsha);
  parts.push(hebrew);
  return parts.join(' — ');
}

function formatParenthesizedRecordingDate(month, day, year, timeZone = defaultTimeZone) {
  const normalizedYear = year < 100 ? 2000 + year : year;
  if (normalizedYear < 2000 || normalizedYear > 2099 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const calendarDate = new Date(Date.UTC(normalizedYear, month - 1, day));
  if (calendarDate.getUTCFullYear() !== normalizedYear || calendarDate.getUTCMonth() !== month - 1 || calendarDate.getUTCDate() !== day) return null;
  const date = localDateTimeToInstant({ year: normalizedYear, month, day, hour: 12, minute: 0 }, timeZone);
  if (!date) return null;
  try {
    const gregorian = new Intl.DateTimeFormat('en-US', {
      timeZone,
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(date);
    const hebrew = new Intl.DateTimeFormat('en-u-ca-hebrew', { timeZone, day: 'numeric', month: 'long', year: 'numeric' }).format(date);
    const parsha = getParshaForDate(date, timeZone);
    return [gregorian, parsha, hebrew].filter(Boolean).join(' — ');
  } catch {
    return null;
  }
}

function parseFilenameRecordingDate(name, timeZone = defaultTimeZone) {
  const source = String(name || '');
  const timestamp = /(?:^|[^\d])(\d{8}|\d{6})[ _-]?(\d{4})(?!\d)/.exec(source);
  const dateOnly = timestamp ? null : /(?:^|[^\d])(\d{1,2})-(\d{1,2})-(\d{2}|\d{4})(?!\d)/.exec(source);
  if (!timestamp && !dateOnly) return null;
  const compactDate = timestamp?.[1];
  const year = timestamp
    ? (compactDate.length === 8 ? Number(compactDate.slice(0, 4)) : 2000 + Number(compactDate.slice(0, 2)))
    : (Number(dateOnly[3]) < 100 ? 2000 + Number(dateOnly[3]) : Number(dateOnly[3]));
  const month = timestamp ? Number(compactDate.slice(-4, -2)) : Number(dateOnly[1]);
  const day = timestamp ? Number(compactDate.slice(-2)) : Number(dateOnly[2]);
  const hour = timestamp ? Number(timestamp[2].slice(0, 2)) : 12;
  const minute = timestamp ? Number(timestamp[2].slice(2)) : 0;
  if (year < 2000 || year > 2099 || month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) return null;
  const calendarDate = new Date(Date.UTC(year, month - 1, day));
  if (calendarDate.getUTCFullYear() !== year || calendarDate.getUTCMonth() !== month - 1 || calendarDate.getUTCDate() !== day) return null;
  try {
    const recordedAt = localDateTimeToInstant({ year, month, day, hour, minute }, timeZone);
    if (!recordedAt) return null;
    return {
      recordedAt: recordedAt.toISOString(),
      recordingDate: `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      recordedDateLabel: formatRecordingDate(recordedAt, timeZone, Boolean(timestamp)),
      recordedAtSource: 'filename',
    };
  } catch {
    return null;
  }
}

function recordingDateForFile(file, timeZone = defaultTimeZone) {
  const parsed = parseFilenameRecordingDate(file.name, timeZone);
  if (parsed) return parsed;
  return { recordedAt: null, recordingDate: null, recordedDateLabel: null, recordedAtSource: null };
}

function newestRecordingFirst(left, right) {
  const leftTime = Date.parse(left.recordedAt || '') || 0;
  const rightTime = Date.parse(right.recordedAt || '') || 0;
  return rightTime - leftTime || String(left.title || left.name).localeCompare(String(right.title || right.name));
}

module.exports = { formatParenthesizedRecordingDate, getParshaForDate, initializeRecordingCalendar, newestRecordingFirst, parseFilenameRecordingDate, recordingDateForFile };
