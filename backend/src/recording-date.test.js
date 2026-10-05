const assert = require('node:assert/strict');
const {
  formatParenthesizedRecordingDate,
  getParshaForDate,
  initializeRecordingCalendar,
  newestRecordingFirst,
  parseFilenameRecordingDate,
  recordingDateForFile,
} = require('./recording-date');
const { displayRecordingTitle } = require('./recording-title');

async function run() {
  await initializeRecordingCalendar();
  const zone = 'America/New_York';
  for (const filename of ['260814_1224.mp3', '20260814_1224.mp3', '20260814 1224.mp3', '20260814-1224.mp3']) {
    const parsed = parseFilenameRecordingDate(filename, zone);
    assert.equal(parsed?.recordedAt, '2026-08-14T16:24:00.000Z');
    assert.equal(parsed?.recordingDate, '2026-08-14');
    assert.match(parsed?.recordedDateLabel || '', /^Friday, Aug 14, 2026 — 12:24 PM — Parshas /);
    assert.equal(parsed?.recordedAtSource, 'filename');
  }
  for (const [filename, date] of [['9-3-26.mp3', '2026-09-03'], ['08-04-2036.wav', '2036-08-04'], ['RB Shiur (9-3-26).mp3', '2026-09-03']]) {
    assert.equal(parseFilenameRecordingDate(filename, zone)?.recordingDate, date);
  }
  for (const filename of ['notes.mp3', '20261314_1224.mp3', '20260814_2460.mp3', '2026081412245.mp3', '2-30-2026.mp3', '13-4-26.mp3']) {
    assert.equal(parseFilenameRecordingDate(filename, zone), null, filename);
  }
  const noDriveDate = recordingDateForFile({ name: 'notes.mp3', createdTime: '2026-08-14T16:24:00.000Z', modifiedTime: '2026-08-15T16:24:00.000Z' }, zone);
  assert.deepEqual(noDriveDate, { recordedAt: null, recordingDate: null, recordedDateLabel: null, recordedAtSource: null });
  assert.equal(getParshaForDate(new Date('2026-08-29T16:00:00.000Z'), zone), 'Parshas Ki Savo');
  assert.equal(getParshaForDate(new Date('2026-09-03T16:00:00.000Z'), zone), 'Parshas Nitzavim-Vayeilech');
  assert.equal(getParshaForDate(new Date('2026-04-04T16:00:00.000Z'), zone), null);
  assert.ok(newestRecordingFirst(
    { name: 'newer.mp3', recordedAt: '2026-08-14T16:24:00.000Z', createdTime: '2020-01-01' },
    { name: 'older.mp3', recordedAt: '2026-08-13T16:24:00.000Z', createdTime: '2030-01-01' },
  ) < 0);
  assert.ok(newestRecordingFirst(
    { name: 'unknown.mp3', createdTime: '2035-01-01' },
    { name: 'dated.mp3', recordedAt: '2020-01-01T12:00:00.000Z' },
  ) > 0);

  const septemberDate = formatParenthesizedRecordingDate(9, 3, 26, zone);
  const augustDate = formatParenthesizedRecordingDate(8, 4, 36, zone);
  assert.equal(formatParenthesizedRecordingDate(2, 30, 26, zone), null);
  assert.match(septemberDate || '', /^Thursday, Sep 3, 2026 — Parshas Nitzavim-Vayeilech — /);
  assert.match(augustDate || '', /^Monday, Aug 4, 2036 — /);
  assert.equal(displayRecordingTitle('RB Shiur (9-3-26)', '', zone), `RB Shiur — ${septemberDate}`);
  assert.equal(displayRecordingTitle('(9-3-26)', '', zone), septemberDate);
  const timestampTitle = displayRecordingTitle('260917 1245.mp3', 'friendly date', zone);
  assert.doesNotMatch(timestampTitle, /260917|\.mp3/);
  assert.match(timestampTitle, /^friendly date — /);
  assert.match(displayRecordingTitle('260814_1224_Maseches_Kiddushin_2.mp3', '', zone), /^Maseches Kiddushin 2 — Friday, Aug 14, 2026 — 12:24 PM — Parshas /);
  console.log('recording date parser and Parsha tests passed');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
