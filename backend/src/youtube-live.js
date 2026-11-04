function youtubeLiveState(detail) {
  const liveBroadcastContent = detail?.snippet?.liveBroadcastContent;
  const liveDetails = detail?.liveStreamingDetails;
  if (liveBroadcastContent === 'live') return 'live';
  if (liveBroadcastContent === 'upcoming') return 'upcoming';
  if (liveDetails?.actualStartTime || liveDetails?.actualEndTime) return 'archived';
  return 'none';
}

module.exports = { youtubeLiveState };
