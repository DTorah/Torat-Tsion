const assert = require('node:assert/strict');
const { youtubeLiveState } = require('./youtube-live');

assert.equal(youtubeLiveState({ snippet: { liveBroadcastContent: 'live' } }), 'live');
assert.equal(youtubeLiveState({ snippet: { liveBroadcastContent: 'upcoming' } }), 'upcoming');
assert.equal(youtubeLiveState({ snippet: { liveBroadcastContent: 'none' }, liveStreamingDetails: { actualStartTime: '2026-11-04T10:00:00Z', actualEndTime: '2026-11-04T10:30:00Z' } }), 'archived');
assert.equal(youtubeLiveState({ snippet: { liveBroadcastContent: 'none' }, liveStreamingDetails: {} }), 'none');
console.log('YouTube live classification tests passed');
