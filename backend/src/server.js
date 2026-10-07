const crypto = require('node:crypto');
const { execFile } = require('node:child_process');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const express = require('express');
const multer = require('multer');
const { google } = require('googleapis');
const { initializeRecordingCalendar, newestRecordingFirst, recordingDateForFile } = require('./recording-date');
const { displayRecordingTitle } = require('./recording-title');

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    execFile(command, args, options, (error, stdout, stderr) => {
      if (error) {
        error.stdout = stdout;
        error.stderr = stderr;
        reject(error);
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

function writeStreamToFile(stream, filePath) {
  return new Promise((resolve, reject) => {
    const writer = fs.createWriteStream(filePath);
    stream.on('error', reject);
    writer.on('error', reject);
    writer.on('finish', resolve);
    stream.pipe(writer);
  });
}

const app = express();
const port = Number(process.env.PORT || 8080);
const folderId = process.env.TORAT_TSION_DRIVE_FOLDER_ID?.trim() || '';
const dataDirectory = process.env.TORAT_TSION_DATA_DIR || path.join('/tmp', 'torat-tsion-data');
const coversDirectory = path.join(dataDirectory, 'covers');
const mappingPath = path.join(dataDirectory, 'covers.json');
const contentPath = path.join(dataDirectory, 'content.json');
const githubContentsToken = process.env.GITHUB_CONTENTS_TOKEN?.trim() || null;
const githubContentsRepository = process.env.GITHUB_CONTENTS_REPOSITORY?.trim() || 'DTorah/Darchei-Torah';
const githubContentsBranch = process.env.GITHUB_CONTENTS_BRANCH?.trim() || 'torat-tsion-content';
const githubContentsEnabled = Boolean(githubContentsToken);
const recordingTimeZone = process.env.RECORDING_TIME_ZONE || 'America/New_York';
const maxImageBytes = 5 * 1024 * 1024;
const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const sessionDurationSeconds = 8 * 60 * 60;
const cookieName = 'torat_tsion_admin';
const driveFolderMimeType = 'application/vnd.google-apps.folder';
const driveShortcutMimeType = 'application/vnd.google-apps.shortcut';
// Any file (regardless of the MIME type Drive reports) whose extension matches one of these is treated as audio.
// Drive frequently mislabels real audio files as application/octet-stream or an unrelated generic type.
const audioFallbackExtensions = new Set(['3g2', '3gp', '3gpp', 'aac', 'ac3', 'aif', 'aiff', 'alac', 'amr', 'ape', 'caf', 'flac', 'm4a', 'm4b', 'mid', 'midi', 'mka', 'mp3', 'mp4', 'oga', 'ogg', 'ogx', 'opus', 'wav', 'wma', 'weba', 'webm']);
const audioMimeTypesByExtension = new Map([
  ['3g2', 'audio/3gpp2'],
  ['3gp', 'audio/3gpp'],
  ['3gpp', 'audio/3gpp'],
  ['aac', 'audio/aac'],
  ['ac3', 'audio/ac3'],
  ['aif', 'audio/aiff'],
  ['aiff', 'audio/aiff'],
  ['alac', 'audio/mp4'],
  ['amr', 'audio/amr'],
  ['ape', 'audio/x-ape'],
  ['caf', 'audio/x-caf'],
  ['flac', 'audio/flac'],
  ['m4a', 'audio/mp4'],
  ['m4b', 'audio/mp4'],
  ['mid', 'audio/midi'],
  ['midi', 'audio/midi'],
  ['mka', 'audio/x-matroska'],
  ['mp3', 'audio/mpeg'],
  ['mp4', 'audio/mp4'],
  ['oga', 'audio/ogg'],
  ['ogg', 'audio/ogg'],
  ['ogx', 'audio/ogg'],
  ['opus', 'audio/opus'],
  ['wav', 'audio/wav'],
  ['wma', 'audio/x-ms-wma'],
  ['weba', 'audio/webm'],
  ['webm', 'audio/webm'],
]);
let driveClient;
const discoveryCacheTtlMs = 5 * 60 * 1000;
const durationHydrationRefreshMs = 2 * 60 * 1000;
const durationProbeCooldownMs = 6 * 60 * 60 * 1000;
let discoveryCache = null;
let discoveryPromise = null;
const driveContentsCache = new Map();
const driveContentsPromises = new Map();
let githubBranchPromise = null;
const persistentCache = new Map();
const persistentCacheTtlMs = 30 * 1000;
let contentMutationTail = Promise.resolve();
const googleOAuthRedirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI || 'https://torat-tsion-api.onrender.com/auth/google/callback';
const googleOAuthScope = 'https://www.googleapis.com/auth/drive.readonly';
const pendingOAuthStates = new Map();

app.use((req, res, next) => {
  const origin = req.get('origin');
  if (origin) {
    res.set('Access-Control-Allow-Origin', origin);
    res.set('Vary', 'Origin');
    res.set('Access-Control-Allow-Credentials', 'true');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, Range');
    res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  }
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
});

function safeErrorCode(error) {
  const status =
    error?.response?.status ??
    error?.code ??
    error?.status ??
    null;

  if (status === 401) return 'drive_authentication';
  if (status === 403) return 'drive_authorization';
  if (status === 404) return 'drive_folder_not_found';
  if (status >= 400) return 'drive_api_error';
  if (error?.code === 'drive_folder_not_configured') return 'drive_folder_not_configured';
  if (error?.code === 'google_oauth_client_not_configured') return 'google_oauth_client_not_configured';
  if (error?.code === 'google_oauth_refresh_token_not_configured') return 'google_oauth_refresh_token_not_configured';

  if (error?.message?.includes('ENOENT')) return 'credential_file_missing';
  if (error?.message?.includes('JSON')) return 'credential_parse_error';
  if (error?.message?.toLowerCase().includes('credential')) return 'credential_error';

  return 'unknown_drive_error';
}

function assertDriveConfigured() {
  if (!folderId) {
    const error = new Error('Torat Tsion Drive folder is not configured');
    error.code = 'drive_folder_not_configured';
    throw error;
  }
}

function storageError(message, status) {
  const error = new Error(message);
  error.status = status;
  error.code = 'durable_storage_error';
  return error;
}

function githubContentPath(relativePath) {
  return relativePath.split('/').map(encodeURIComponent).join('/');
}

async function githubRequest(pathname, options = {}) {
  const response = await fetch(`https://api.github.com${pathname}`, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${githubContentsToken}`,
      'User-Agent': 'torat-tsion-content-store',
      ...options.headers,
    },
  });
  if (response.status === 404) return { response, body: null };
  if (!response.ok) throw storageError(`GitHub content storage request failed (${response.status})`, response.status);
  return { response, body: await response.json() };
}

async function ensureGithubBranch() {
  if (!githubContentsEnabled) return;
  if (githubBranchPromise) return githubBranchPromise;
  githubBranchPromise = (async () => {
    const branch = await githubRequest(`/repos/${githubContentsRepository}/git/ref/heads/${encodeURIComponent(githubContentsBranch)}`);
    if (branch.response.ok) return;
    const main = await githubRequest(`/repos/${githubContentsRepository}/git/ref/heads/main`);
    if (!main.response.ok || !main.body?.object?.sha) throw storageError('Unable to initialize GitHub content branch', main.response.status);
    const created = await fetch(`https://api.github.com/repos/${githubContentsRepository}/git/refs`, {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${githubContentsToken}`,
        'Content-Type': 'application/json',
        'User-Agent': 'torat-tsion-content-store',
      },
      body: JSON.stringify({ ref: `refs/heads/${githubContentsBranch}`, sha: main.body.object.sha }),
    });
    if (!created.ok && created.status !== 422) throw storageError(`Unable to create GitHub content branch (${created.status})`, created.status);
  })();
  try {
    await githubBranchPromise;
  } catch (error) {
    githubBranchPromise = null;
    throw error;
  }
}

async function readStoredFile(relativePath) {
  const cached = persistentCache.get(relativePath);
  if (cached && Date.now() - cached.createdAt < persistentCacheTtlMs) return cached.value;
  if (!githubContentsEnabled) {
    try {
      const value = await fsp.readFile(path.join(dataDirectory, relativePath));
      persistentCache.set(relativePath, { createdAt: Date.now(), value });
      return value;
    } catch (error) {
      if (error.code === 'ENOENT') return null;
      throw error;
    }
  }
  await ensureGithubBranch();
  const result = await githubRequest(`/repos/${githubContentsRepository}/contents/${githubContentPath(relativePath)}?ref=${encodeURIComponent(githubContentsBranch)}`);
  if (!result.response.ok) return null;
  let content = result.body;
  if (content.encoding !== 'base64') {
    const blob = await githubRequest(`/repos/${githubContentsRepository}/git/blobs/${content.sha}`);
    content = blob.body;
  }
  if (!content?.content) throw storageError('GitHub content storage returned an unreadable file', 502);
  const value = Buffer.from(content.content.replace(/\n/g, ''), 'base64');
  persistentCache.set(relativePath, { createdAt: Date.now(), value });
  return value;
}

async function writeStoredFile(relativePath, bytes, message) {
  const value = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  if (!githubContentsEnabled) {
    const filePath = path.join(dataDirectory, relativePath);
    await fsp.mkdir(path.dirname(filePath), { recursive: true });
    await fsp.writeFile(filePath, value);
  } else {
    await ensureGithubBranch();
    const existing = await githubRequest(`/repos/${githubContentsRepository}/contents/${githubContentPath(relativePath)}?ref=${encodeURIComponent(githubContentsBranch)}`);
    const response = await fetch(`https://api.github.com/repos/${githubContentsRepository}/contents/${githubContentPath(relativePath)}`, {
      method: 'PUT',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${githubContentsToken}`,
        'Content-Type': 'application/json',
        'User-Agent': 'torat-tsion-content-store',
      },
      body: JSON.stringify({ message, content: value.toString('base64'), branch: githubContentsBranch, ...(existing.body?.sha ? { sha: existing.body.sha } : {}) }),
    });
    if (!response.ok) throw storageError(`Unable to write GitHub content storage (${response.status})`, response.status);
  }
  persistentCache.set(relativePath, { createdAt: Date.now(), value });
}

async function deleteStoredFile(relativePath, message) {
  if (!githubContentsEnabled) {
    try { await fsp.unlink(path.join(dataDirectory, relativePath)); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  } else {
    await ensureGithubBranch();
    const existing = await githubRequest(`/repos/${githubContentsRepository}/contents/${githubContentPath(relativePath)}?ref=${encodeURIComponent(githubContentsBranch)}`);
    if (!existing.response.ok) return;
    const response = await fetch(`https://api.github.com/repos/${githubContentsRepository}/contents/${githubContentPath(relativePath)}`, {
      method: 'DELETE',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${githubContentsToken}`,
        'Content-Type': 'application/json',
        'User-Agent': 'torat-tsion-content-store',
      },
      body: JSON.stringify({ message, sha: existing.body.sha, branch: githubContentsBranch }),
    });
    if (!response.ok) throw storageError(`Unable to delete GitHub content storage (${response.status})`, response.status);
  }
  persistentCache.delete(relativePath);
}

function driveErrorDetails(error) {
  const response = error?.response;
  const apiError = response?.data?.error;
  return {
    code: safeErrorCode(error),
    status: response?.status ?? error?.status ?? error?.code ?? null,
    reason: apiError?.errors?.[0]?.reason ?? null,
    message: apiError?.message ?? error?.message ?? null,
  };
}

function requestedContentRange(range, size) {
  if (!range || !size) return null;
  const match = /^bytes=(\d+)-(\d*)$/.exec(range);
  if (!match) return null;
  const start = Number(match[1]);
  const requestedEnd = match[2] ? Number(match[2]) : size - 1;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(requestedEnd) || start > requestedEnd || start >= size) return null;
  return {
    value: `bytes ${start}-${Math.min(requestedEnd, size - 1)}/${size}`,
    length: Math.min(requestedEnd, size - 1) - start + 1,
  };
}


function googleOAuthClientConfigured() {
  return Boolean(process.env.GOOGLE_OAUTH_CLIENT_ID?.trim() && process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim());
}

function googleOAuthConfigured() {
  return Boolean(googleOAuthClientConfigured() && process.env.GOOGLE_OAUTH_REFRESH_TOKEN?.trim());
}

function getOAuthClient() {
  if (!googleOAuthClientConfigured()) {
    const error = new Error('Google OAuth client is not configured');
    error.code = 'google_oauth_client_not_configured';
    throw error;
  }
  return new google.auth.OAuth2(
    process.env.GOOGLE_OAUTH_CLIENT_ID.trim(),
    process.env.GOOGLE_OAUTH_CLIENT_SECRET.trim(),
    googleOAuthRedirectUri,
  );
}

async function getDrive() {
  if (driveClient) return driveClient;
  if (!googleOAuthConfigured()) {
    const error = new Error('Google OAuth refresh token is not configured');
    error.code = 'google_oauth_refresh_token_not_configured';
    throw error;
  }
  const auth = getOAuthClient();
  auth.setCredentials({ refresh_token: process.env.GOOGLE_OAUTH_REFRESH_TOKEN.trim() });
  await auth.getAccessToken();
  driveClient = google.drive({ version: 'v3', auth });
  return driveClient;
}

function fileExtension(name) {
  return String(name || '').toLowerCase().split('.').pop() || '';
}

function isAudioFile(file) {
  if (!file.id || !file.name || file.mimeType === driveFolderMimeType || file.mimeType === driveShortcutMimeType) return false;
  if (file.mimeType?.startsWith('audio/')) return true;
  const extension = fileExtension(file.name);
  // A video container with zero-by-zero reported dimensions has no visual track and is really audio-only.
  const audioOnlyVideo = file.mimeType?.startsWith('video/') &&
    file.videoMediaMetadata?.width === 0 &&
    file.videoMediaMetadata?.height === 0;
  if (audioOnlyVideo) return true;
  // Drive frequently mislabels real audio files (octet-stream, unrecognized/generic types); trust the extension.
  return audioFallbackExtensions.has(extension);
}

function audioContentType(file) {
  if (!isAudioFile(file)) return null;
  if (file.mimeType?.startsWith('audio/')) return file.mimeType;
  if (file.mimeType?.startsWith('video/')) return `audio/${file.mimeType.slice('video/'.length)}`;
  return audioMimeTypesByExtension.get(fileExtension(file.name)) || 'application/octet-stream';
}

async function resolveShortcut(file) {
  const targetId = file.shortcutDetails?.targetId;
  const targetMimeType = file.shortcutDetails?.targetMimeType;
  if (!targetId) return null;
  if (targetMimeType === driveFolderMimeType) return { id: targetId, name: file.name, mimeType: driveFolderMimeType };
  try {
    const drive = await getDrive();
    const response = await drive.files.get({
      fileId: targetId,
      fields: 'id,name,mimeType,size,createdTime,modifiedTime,videoMediaMetadata',
      supportsAllDrives: false,
    });
    return { ...response.data, name: file.name || response.data.name };
  } catch {
    return null;
  }
}

async function fetchDriveContents(parentId, diagnostics = null) {
  const drive = await getDrive();
  const files = [];
  let pageToken;
  do {
    const response = await drive.files.list({
      q: `'${parentId}' in parents and trashed = false`,
      fields: 'nextPageToken, files(id, name, mimeType, size, createdTime, modifiedTime, videoMediaMetadata, shortcutDetails)',
      orderBy: 'createdTime desc', pageSize: 1000, pageToken, spaces: 'drive',
    });
    files.push(...(response.data.files || []));
    pageToken = response.data.nextPageToken || undefined;
  } while (pageToken);

  const resolved = [];
  for (const file of files) {
    if (diagnostics) diagnostics.totalFiles += 1;
    if (file.mimeType === driveShortcutMimeType) {
      if (diagnostics) diagnostics.shortcuts += 1;
      const target = await resolveShortcut(file);
      if (target) resolved.push(target);
      else if (diagnostics) diagnostics.unresolvedShortcuts += 1;
      continue;
    }
    resolved.push(file);
  }

  const recordings = [];
  const folders = [];
  for (const file of resolved) {
    if (!file.id || !file.name) continue;
    if (file.mimeType === driveFolderMimeType) {
      folders.push(file);
      if (diagnostics) diagnostics.folders += 1;
      continue;
    }
    if (isAudioFile(file)) {
      recordings.push(file);
      if (diagnostics) diagnostics.audioRecognized += 1;
      continue;
    }
    if (diagnostics) {
      const key = file.mimeType || 'unknown';
      diagnostics.rejectedByMimeType[key] = (diagnostics.rejectedByMimeType[key] || 0) + 1;
    }
  }
  return { recordings, folders };
}

async function listDriveContents(parentId, diagnostics = null) {
  assertDriveConfigured();
  const cached = driveContentsCache.get(parentId);
  if (cached && Date.now() - cached.createdAt < discoveryCacheTtlMs) {
    if (diagnostics) {
      diagnostics.totalFiles += cached.contents.recordings.length + cached.contents.folders.length;
      diagnostics.folders += cached.contents.folders.length;
      diagnostics.audioRecognized += cached.contents.recordings.length;
    }
    return cached.contents;
  }
  const pending = driveContentsPromises.get(parentId);
  if (pending) return pending;
  const request = fetchDriveContents(parentId, diagnostics).then((contents) => {
    driveContentsCache.set(parentId, { createdAt: Date.now(), contents });
    return contents;
  }).finally(() => driveContentsPromises.delete(parentId));
  driveContentsPromises.set(parentId, request);
  return request;
}

async function listRecordings() {
  const discovery = await getRecordingDiscovery();
  return discovery.entries.map(({ file, folder }) => ({ ...file, _folderContext: folder }));
}

async function listRecordingEntries(parentId, ownerFolder = null, visited = new Set(), initialContents = null, folderPath = [], diagnostics = null) {
  if (visited.has(parentId)) return [];
  visited.add(parentId);
  const contents = initialContents || await listDriveContents(parentId, diagnostics);
  const nested = await Promise.all(contents.folders.map((folder) => listRecordingEntries(folder.id, ownerFolder || folder, visited, null, [...folderPath, folder], diagnostics)));
  return [
    ...contents.recordings.map((file) => ({ file, folder: ownerFolder, folderPath })),
    ...nested.flat(),
  ];
}

let durationHydrationInFlight = false;
async function scheduleDurationHydration(discovery) {
  if (durationHydrationInFlight) return;
  const missing = discovery.entries.filter(({ file }) => !Number.isFinite(Number(file.videoMediaMetadata?.durationMillis)));
  if (!missing.length) return;
  durationHydrationInFlight = true;
  try {
    const content = await readContent();
    // Process a bounded batch so this never blocks requests or overwhelms Drive/ffmpeg.
    const candidates = missing.filter(({ file }) => {
      const saved = content.recordings[file.id] || {};
      const hasDuration = Number.isFinite(Number(saved.durationSeconds)) && Number(saved.durationSeconds) > 0;
      const recentlyProbed = saved.durationProbedAt && Date.now() - Date.parse(saved.durationProbedAt) < durationProbeCooldownMs;
      return !hasDuration && !recentlyProbed;
    }).slice(0, 6);
    for (const { file } of candidates) {
      await hydrateRecordingAnalysis(content, file);
    }
  } catch (error) {
    console.error('duration hydration sweep failed', error?.message || error);
  } finally {
    durationHydrationInFlight = false;
  }
}

async function getRecordingDiscovery() {
  if (discoveryCache && Date.now() - discoveryCache.createdAt < discoveryCacheTtlMs) {
    scheduleDurationHydration(discoveryCache).catch(() => {});
    return discoveryCache;
  }
  if (discoveryPromise) return discoveryPromise;
  discoveryPromise = (async () => {
    const diagnostics = { totalFiles: 0, folders: 0, shortcuts: 0, unresolvedShortcuts: 0, audioRecognized: 0, rejectedByMimeType: {} };
    const rootContents = await listDriveContents(folderId, diagnostics);
    const entries = await listRecordingEntries(folderId, null, new Set(), rootContents, [], diagnostics);
    const value = { createdAt: Date.now(), rootContents, entries, diagnostics };
    discoveryCache = value;
    return value;
  })();
  try {
    const value = await discoveryPromise;
    scheduleDurationHydration(value).catch(() => {});
    return value;
  } finally {
    discoveryPromise = null;
  }
}

function invalidateRecordingDiscovery() {
  discoveryCache = null;
}

async function assertFolderUnderRoot(requestedFolderId) {
  if (requestedFolderId === folderId) return { id: folderId, name: 'Recordings', parentId: null };
  const drive = await getDrive();
  const initial = await drive.files.get({ fileId: requestedFolderId, fields: 'id,name,mimeType,parents', supportsAllDrives: false });
  if (initial.data.mimeType !== driveFolderMimeType) throw new Error('not a recordings folder');
  const requested = { id: initial.data.id, name: initial.data.name, parentId: initial.data.parents?.[0] || null };
  const visited = new Set([requestedFolderId]);
  let parents = initial.data.parents;
  let currentId = parents?.[0];
  // Walk up the ancestor chain only to confirm this folder actually lives under the recordings root;
  // the folder's own id/name/parentId (captured above) is always what gets returned to the caller.
  while (currentId && !visited.has(currentId)) {
    if (parents?.includes(folderId)) return requested;
    visited.add(currentId);
    const response = await drive.files.get({ fileId: currentId, fields: 'id,name,mimeType,parents', supportsAllDrives: false });
    if (response.data.mimeType !== driveFolderMimeType) throw new Error('not a recordings folder');
    parents = response.data.parents;
    currentId = parents?.[0];
  }
  if (parents?.includes(folderId)) return requested;
  const error = new Error('folder is outside recordings root');
  error.code = 404;
  throw error;
}

function publicFolder(folder, parentId) {
  return { id: folder.id, name: folder.name, parentId };
}

function toRabbiFromFolder(folder, saved = {}) {
  const name = String(saved.name || folder.name || '').trim();
  return {
    id: saved.id || folder.id,
    name: name || folder.name,
    description: saved.description || saved.biography || `Explore ${folder.name}'s shiurim`,
    biography: saved.biography || '',
    photoUrl: saved.photoUrl || null,
    featured: Boolean(saved.featured),
    enabled: saved.enabled !== false,
    sortOrder: Number(saved.sortOrder || 0),
  };
}

function mergeRabbis(content, folders = []) {
  const saved = Array.isArray(content.rabbis) ? content.rabbis : [];
  const byId = new Map();
  const byName = new Map();
  const assign = (value) => {
    const candidate = value && value.name ? { ...value, name: String(value.name).trim() } : value;
    if (!candidate || !candidate.name) return;
    const idKey = String(candidate.id || candidate.name).trim();
    if (idKey) byId.set(idKey, { ...(byId.get(idKey) || {}), ...candidate });
    if (candidate.id) byId.set(String(candidate.id).trim(), { ...(byId.get(String(candidate.id).trim()) || {}), ...candidate });
    const lowerName = String(candidate.name).trim().toLowerCase();
    if (lowerName) byName.set(lowerName, { ...(byName.get(lowerName) || {}), ...candidate });
  };
  for (const rabbi of saved) {
    assign(rabbi);
  }
  for (const folder of folders) {
    if (!folder || !folder.id || !folder.name) continue;
    const savedRabbi = byId.get(folder.id) || byName.get(String(folder.name).trim().toLowerCase()) || {};
    const candidate = toRabbiFromFolder(folder, savedRabbi);
    assign(candidate);
  }
  const merged = new Map();
  for (const rabbi of [...byId.values(), ...byName.values()]) {
    const key = String(rabbi.id || rabbi.name).trim();
    if (!key) continue;
    merged.set(key, { ...(merged.get(key) || {}), ...rabbi, name: String(rabbi.name).trim() });
  }
  return [...merged.values()].filter((rabbi) => rabbi && rabbi.name).sort((a, b) => (Number(a.sortOrder || 0) - Number(b.sortOrder || 0)) || a.name.localeCompare(b.name));
}

function sign(value) { return crypto.createHmac('sha256', process.env.ADMIN_SESSION_SECRET || '').update(value).digest('base64url'); }
function makeSession(username) { const payload = Buffer.from(JSON.stringify({ username, expiresAt: Math.floor(Date.now() / 1000) + sessionDurationSeconds })).toString('base64url'); return `${payload}.${sign(payload)}`; }
function constantTimeEqual(left, right) {
  const leftBytes = Buffer.from(String(left));
  const rightBytes = Buffer.from(String(right));
  return leftBytes.length === rightBytes.length && crypto.timingSafeEqual(leftBytes, rightBytes);
}
function adminConfigurationValid() {
  return Boolean(process.env.ADMIN_USERNAME && process.env.ADMIN_PASSWORD && process.env.ADMIN_SESSION_SECRET && Buffer.byteLength(process.env.ADMIN_SESSION_SECRET) >= 32);
}
function isAdmin(req) {
  const auth = req.get('authorization');
  const cookie = req.get('cookie')?.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
  const token = cookie || (auth?.startsWith('Bearer ') ? auth.slice(7) : null);
  if (!token || !process.env.ADMIN_SESSION_SECRET) return false;
  const [payload, signature] = token.split('.');
  if (!payload || signature !== sign(payload)) return false;
  try { return JSON.parse(Buffer.from(payload, 'base64url').toString()).expiresAt > Math.floor(Date.now() / 1000); } catch { return false; }
}
function requireAdmin(req, res, next) { if (!isAdmin(req)) return res.status(401).json({ error: 'Admin authentication required' }); next(); }
function validId(id) { return /^[A-Za-z0-9_-]{10,200}$/.test(id); }
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
}
function extension(mime) { return mime === 'image/jpeg' ? 'jpg' : mime.slice(6); }
function validSignature(buffer, mime) { return mime === 'image/png' ? buffer.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) : mime === 'image/jpeg' ? buffer.subarray(0, 3).equals(Buffer.from([255,216,255])) : buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP'; }
async function readMapping() { const bytes = await readStoredFile('covers.json'); return bytes ? JSON.parse(bytes.toString('utf8')) : {}; }
async function writeMapping(mapping) { await writeStoredFile('covers.json', `${JSON.stringify(mapping, null, 2)}\n`, 'Update Torat Tsion cover mappings'); }
const defaultContent = {
  settings: { homepageSections: ['announcement', 'featuredRabbis', 'featuredShiurim', 'newThisWeek', 'trending', 'categories', 'playlists', 'radio', 'advertisements'] },
  categories: [],
  rabbis: [],
  recordings: {},
  playlists: [],
  stations: [{ id: 'general', name: 'General', category: null, recordingIds: [] }],
  advertisements: [],
  sponsoredContent: [],
  announcements: [],
  collections: [],
  carousel: [],
  minyanim: [],
};
async function readContent() { const bytes = await readStoredFile('content.json'); return bytes ? { ...defaultContent, ...JSON.parse(bytes.toString('utf8')) } : { ...defaultContent }; }
async function writeContentRaw(content) { await writeStoredFile('content.json', `${JSON.stringify(content, null, 2)}\n`, 'Update Torat Tsion CMS content'); }
function enqueueContentMutation(operation) {
  const result = contentMutationTail.then(operation, operation);
  contentMutationTail = result.catch(() => {});
  return result;
}
async function writeContent(content) { return enqueueContentMutation(() => writeContentRaw(content)); }
async function mutateContent(mutator) {
  return enqueueContentMutation(async () => {
    const content = await readContent();
    const result = await mutator(content);
    await writeContentRaw(content);
    return result;
  });
}
function isActive(item, now = Date.now()) { return item?.enabled !== false && (!item.startDate || Date.parse(item.startDate) <= now) && (!item.endDate || Date.parse(item.endDate) >= now); }
function asFiniteNumber(value, fallback = null) {
  if (value === null || value === undefined || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed;
}
function normalizeShiurStartMetadata(recording = {}) {
  const startSeconds = asFiniteNumber(recording.shiurStartSeconds, null);
  const confidence = asFiniteNumber(recording.shiurStartConfidence, null);
  const normalizedStart = startSeconds === null || startSeconds < 0 ? null : Number(startSeconds.toFixed(2));
  const normalizedConfidence = confidence === null ? null : Math.max(0, Math.min(1, Number(confidence.toFixed(2))));
  return {
    shiurStartSeconds: normalizedStart,
    shiurStartSource: recording.shiurStartSource === 'manual' ? 'manual' : (normalizedStart !== null ? 'automatic' : null),
    shiurStartConfidence: normalizedConfidence,
    shiurSkipEnabled: recording.shiurSkipEnabled === false ? false : normalizedStart !== null,
  };
}
async function detectSpeechStartFromAudioFile(filePath) {
  const ffmpeg = process.env.FFMPEG_PATH || 'ffmpeg';
  const ffprobe = process.env.FFPROBE_PATH || 'ffprobe';
  try {
    const probeResult = await runCommand(ffprobe, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', filePath]);
    const durationSeconds = Number.parseFloat((probeResult.stdout || '').trim());
    const analysisWindow = Number.isFinite(durationSeconds) && durationSeconds > 0 ? Math.min(durationSeconds, 120) : 120;
    let stderr;
    try {
      ({ stderr } = await runCommand(ffmpeg, ['-hide_banner', '-t', String(analysisWindow), '-i', filePath, '-af', 'silencedetect=noise=-30dB:d=0.5', '-f', 'null', '-'], { maxBuffer: 64 * 1024 * 1024 }));
    } catch (error) {
      stderr = error.stderr || '';
      if (!/silence_(?:start|end)|time=/.test(stderr)) return null;
    }
    const silenceStarts = [...stderr.matchAll(/silence_start: ([0-9.]+)/g)].map((match) => Number(match[1])).filter(Number.isFinite);
    const silenceEnds = [...stderr.matchAll(/silence_end: ([0-9.]+)/g)].map((match) => Number(match[1])).filter(Number.isFinite);
    const initialSilenceEnd = silenceStarts.some((value) => value <= 0.25)
      ? silenceEnds.find((value) => value > 0.25 && value < analysisWindow)
      : null;

    // This is silence/energy based speech-start detection, not speaker recognition.
    const startSeconds = initialSilenceEnd === undefined || initialSilenceEnd === null ? 0 : Number(initialSilenceEnd.toFixed(2));
    return {
      startSeconds,
      durationSeconds: Number.isFinite(durationSeconds) && durationSeconds > 0 ? Number(durationSeconds.toFixed(2)) : null,
      confidence: startSeconds > 0 ? 0.7 : 0.6,
      source: 'automatic',
      valid: true,
    };
  } catch {
    return null;
  }
}
async function hydrateRecordingAnalysis(content, file) {
  const existing = content.recordings[file.id] || {};
  const hasDuration = asFiniteNumber(existing.durationSeconds, null) !== null || Boolean(file.videoMediaMetadata?.durationMillis);
  const hasStart = Object.prototype.hasOwnProperty.call(existing, 'shiurStartSeconds') && existing.shiurStartSeconds !== null && existing.shiurStartSeconds !== undefined;
  const needsStart = existing.shiurSkipEnabled !== false && !hasStart;
  const needsDuration = !hasDuration;
  if (!needsStart && !needsDuration) return;
  // Avoid repeatedly re-downloading/probing the same file every discovery cycle.
  const recentlyProbed = existing.durationProbedAt && Date.now() - Date.parse(existing.durationProbedAt) < durationProbeCooldownMs;
  if (recentlyProbed) return;
  const tempPath = path.join(dataDirectory, `analysis-${file.id}.tmp`);
  try {
    await fsp.mkdir(dataDirectory, { recursive: true });
    const drive = await getDrive();
    const response = await drive.files.get({ fileId: file.id, alt: 'media', supportsAllDrives: false }, { responseType: 'stream' });
    await writeStreamToFile(response.data, tempPath);
    const analysis = await detectSpeechStartFromAudioFile(tempPath);
    const next = {
      ...existing,
      durationSeconds: asFiniteNumber(existing.durationSeconds, analysis?.durationSeconds ?? null),
      durationSource: analysis?.durationSeconds && !hasDuration ? 'ffprobe' : existing.durationSource,
      durationProbedAt: new Date().toISOString(),
      ...(needsStart && analysis?.valid ? {
        shiurStartSeconds: analysis.startSeconds > 0 ? Number(analysis.startSeconds.toFixed(2)) : null,
        shiurStartSource: 'automatic',
        shiurStartConfidence: analysis.startSeconds > 0 ? Number(Math.max(0, Math.min(1, analysis.confidence || 0.7)).toFixed(2)) : null,
        shiurSkipEnabled: analysis.startSeconds > 0,
      } : {}),
      updatedAt: new Date().toISOString(),
    };
    await mutateContent((latestContent) => {
      latestContent.recordings[file.id] = { ...latestContent.recordings[file.id], ...next };
    });
  } catch (error) {
    console.error('automatic shiur analysis skipped', safeErrorCode(error), error?.message || 'unknown');
    await mutateContent((latestContent) => {
      latestContent.recordings[file.id] = { ...latestContent.recordings[file.id], ...existing, durationProbedAt: new Date().toISOString() };
    }).catch(() => {});
  } finally {
    await fsp.unlink(tempPath).catch(() => {});
  }
}
function recordingMetadata(content, file) {
  const saved = content.recordings[file.id] || {};
  const publicSaved = Object.fromEntries(Object.entries(saved).filter(([key]) => key !== 'createdTime' && key !== 'modifiedTime'));
  const metadata = normalizeShiurStartMetadata(saved);
  const recordingDate = recordingDateForFile(file, recordingTimeZone);
  return {
    ...publicSaved,
    id: file.id,
    title: displayRecordingTitle(saved.title || file.name, recordingDate.recordedDateLabel, recordingTimeZone, file.name),
    name: file.name,
    mimeType: file.mimeType,
    size: file.size ? Number(file.size) : null,
    durationSeconds: asFiniteNumber(saved.durationSeconds, file.videoMediaMetadata?.durationMillis ? Number(file.videoMediaMetadata.durationMillis) / 1000 : null),
    ...recordingDate,
    streamUrl: `/api/recordings/${encodeURIComponent(file.id)}`,
    ...metadata,
  };
}
function buildHome(content, files, covers, folders = []) {
  const rabbis = mergeRabbis(content, folders).filter((rabbi) => rabbi.enabled !== false);
  const rabbiById = new Map(rabbis.map((rabbi) => [rabbi.id, rabbi]));
  const categoryByFolderId = new Map(content.categories.flatMap((category) => (Array.isArray(category.folderIds) ? category.folderIds : []).map((folderId) => [folderId, category])));
  const recordings = files.map((file) => {
    const saved = content.recordings[file.id] || {};
    const folderContext = file._folderContext || null;
    const rabbi = rabbiById.get(saved.rabbiId || null) || (folders.length && saved.rabbiId ? undefined : undefined);
    const inferredRabbi = folders.find((folder) => folder.id === saved.rabbiId || folder.name === saved.rabbiName) || folderContext;
    const recording = recordingMetadata(content, file);
    const resolvedRabbi = rabbi
      || (saved.rabbiId ? rabbiById.get(saved.rabbiId) : null)
      || (inferredRabbi ? rabbiById.get(inferredRabbi.id) : null)
      || (folders.length === 1 ? folders[0] : null)
      || folderContext;
    const matchedCategory = saved.categoryId
      ? content.categories.find((category) => category.id === saved.categoryId)
      : [folderContext?.id, ...(Array.isArray(file._folderPath) ? file._folderPath.map((folder) => folder.id) : [])]
        .map((folderId) => categoryByFolderId.get(folderId))
        .find(Boolean);
    return {
      ...recording,
      rabbiName: recording.rabbiName || saved.rabbiName || resolvedRabbi?.name || null,
      rabbiId: recording.rabbiId || saved.rabbiId || resolvedRabbi?.id || null,
      categoryId: recording.categoryId || saved.categoryId || matchedCategory?.id || null,
      category: recording.category || saved.category || matchedCategory?.name || null,
      coverUrl: content.recordings[recording.id]?.coverUrl || covers[recording.id]?.coverUrl || resolvedRabbi?.photoUrl || null,
      folderPath: Array.isArray(file._folderPath) ? file._folderPath.map((folder) => ({ id: folder.id, name: folder.name })) : [],
    };
  }).filter((recording) => recording.visible !== false).sort(newestRecordingFirst);
  const byId = new Map(recordings.map((recording) => [recording.id, recording]));
  const pick = (predicate, limit = 12) => recordings.filter(predicate).sort((a, b) => (b.sortOrder || 0) - (a.sortOrder || 0) || newestRecordingFirst(a, b)).slice(0, limit);
  const featuredIds = new Set(recordings.filter((recording) => recording.featured).map((recording) => recording.id));
  const week = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const activeAnnouncements = content.announcements.filter((item) => isActive(item));
  return { settings: content.settings, rabbis, categories: content.categories.filter((item) => item.enabled !== false).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)), recordings, featuredShiurim: recordings.filter((recording) => featuredIds.has(recording.id)).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)), newThisWeek: pick((recording) => recording.new || (recording.recordedAt && Date.parse(recording.recordedAt) >= week)), trending: recordings.filter((recording) => recording.trending).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)).slice(0, 12), playlists: content.playlists.filter((item) => isActive(item)), stations: content.stations.filter((item) => isActive(item)), advertisements: content.advertisements.filter((item) => isActive(item)).sort((a, b) => (b.priority || 0) - (a.priority || 0)), sponsoredContent: content.sponsoredContent.filter((item) => isActive(item)), announcements: activeAnnouncements, collections: content.collections.filter((item) => isActive(item)), carousel: buildCarousel(content, recordings), _recordingIndex: Object.fromEntries([...byId].map(([id, recording]) => [id, recording])), };
}

function buildCarousel(content, recordings) {
  const byId = new Map(recordings.map((recording) => [recording.id, recording]));
  const manual = (content.carousel || []).filter((item) => item.enabled !== false).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  const fromManual = manual.map((item) => {
    const recording = item.recordingId ? byId.get(item.recordingId) : null;
    return {
      id: item.id,
      kind: item.kind || (recording ? 'recording' : 'custom'),
      title: item.title || (recording ? normalizeRecordingTitleForCarousel(recording) : 'Torat Tsion'),
      subtitle: item.subtitle || recording?.rabbiName || '',
      coverUrl: item.coverUrl || recording?.coverUrl || null,
      recordingId: item.recordingId || null,
      countdownAt: item.countdownAt || null,
      link: item.link || (recording ? `/recordings/${recording.id}` : null),
    };
  });
  if (fromManual.length) return fromManual;
  // No curated carousel yet: surface recently added recordings instead of a fake "live" placeholder.
  return recordings.slice(0, 8)
    .map((recording) => ({
      id: recording.id,
      kind: 'recording',
      title: normalizeRecordingTitleForCarousel(recording),
      subtitle: recording.rabbiName || '',
      coverUrl: recording.coverUrl || null,
      recordingId: recording.id,
      countdownAt: null,
      link: `/recordings/${recording.id}`,
    }));
}
function normalizeRecordingTitleForCarousel(recording) { return recording.title || recording.name || 'Torat Tsion'; }

function publicRabbi(rabbi) { return { id: rabbi.id, name: rabbi.name, description: rabbi.description || '', biography: rabbi.biography || '', photoUrl: rabbi.photoUrl || null, featured: Boolean(rabbi.featured), enabled: rabbi.enabled !== false, sortOrder: Number(rabbi.sortOrder || 0) }; }
function publicCategory(category) { return { id: category.id, name: category.name, description: category.description || '', imageUrl: category.imageUrl || null, enabled: category.enabled !== false, sortOrder: Number(category.sortOrder || 0), folderIds: Array.isArray(category.folderIds) ? category.folderIds : [] }; }
function newContentId(prefix) { return `${prefix}_${crypto.randomUUID()}`; }
function findEntity(items, id) { return items.find((item) => item.id === id); }
function timeFrameToleranceMinutes() { return 1; }
function findTimeFrameRecordings(recordings, targetMinutes) {
  const toleranceMinutes = timeFrameToleranceMinutes(targetMinutes);
  const targetSeconds = targetMinutes * 60;
  const maximumDistance = toleranceMinutes * 60;
  return recordings
    .filter((recording) => Number.isFinite(Number(recording.durationSeconds)) && Number(recording.durationSeconds) > 0)
    .map((recording) => ({ recording, distance: Math.abs(Number(recording.durationSeconds) - targetSeconds) }))
    .filter((candidate) => candidate.distance <= maximumDistance)
    .sort((a, b) => a.distance - b.distance || newestRecordingFirst(a.recording, b.recording))
    .slice(0, 24)
    .map(({ recording }) => recording);
}
function ensureDiscoveredRabbi(content, folder) {
  let rabbi = findEntity(content.rabbis, folder.id);
  if (rabbi) return rabbi;
  rabbi = { ...toRabbiFromFolder(folder), id: folder.id, createdAt: new Date().toISOString() };
  content.rabbis.push(rabbi);
  return rabbi;
}

async function buildHomeSummary() {
  const [content, covers, rootContents] = await Promise.all([readContent(), readMapping(), listDriveContents(folderId)]);
  const savedRecordings = Object.entries(content.recordings || {});
  const featuredIds = savedRecordings.filter(([, recording]) => recording.featured).map(([id]) => id).slice(0, 24);
  const prioritizedIds = [
    ...featuredIds,
    ...(content.carousel || []).filter((item) => item.enabled !== false).map((item) => item.recordingId).filter(Boolean).slice(0, 24),
  ];
  const selectedIds = [...new Set(prioritizedIds.filter(validId))].slice(0, 48);
  const drive = await getDrive();
  const curatedFiles = (await Promise.all(selectedIds.map(async (id) => {
    try {
      const file = await getRecordingMetadata(drive, id);
      return file && isAudioFile(file) ? file : null;
    } catch (error) {
      if (error?.response?.status === 404) return null;
      throw error;
    }
  }))).filter(Boolean);
  const directFiles = [...rootContents.recordings]
    .sort((a, b) => newestRecordingFirst(recordingMetadata(content, a), recordingMetadata(content, b)))
    .slice(0, 12);
  const filesById = new Map([...directFiles, ...curatedFiles].map((file) => [file.id, file]));
  const home = buildHome(content, [...filesById.values()], covers, rootContents.folders);
  const hasManualCarousel = (content.carousel || []).some((item) => item.enabled !== false);
  return {
    ...home,
    carousel: hasManualCarousel ? home.carousel : home.carousel.filter((item) => filesById.has(item.recordingId)),
    folders: rootContents.folders.map((folder) => publicFolder(folder, folderId)),
  };
}

app.use(express.json({ limit: '32kb' }));
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: maxImageBytes } });
app.get('/auth/google', (_req, res) => {
  try {
    const state = crypto.randomBytes(32).toString('base64url');
    pendingOAuthStates.set(state, { expiresAt: Date.now() + 10 * 60 * 1000 });
    const authorizationUrl = getOAuthClient().generateAuthUrl({
      access_type: 'offline',
      prompt: 'select_account',
      scope: [googleOAuthScope],
      state,
    });
    res.redirect(authorizationUrl);
  } catch (error) {
    console.error('Google OAuth start failed', safeErrorCode(error));
    res.status(503).json({ error: 'Google OAuth is not configured' });
  }
});
app.get('/auth/google/callback', async (req, res) => {
  const state = String(req.query.state || '');
  const pending = pendingOAuthStates.get(state);
  pendingOAuthStates.delete(state);
  if (!state || !pending || pending.expiresAt < Date.now()) {
    return res.status(400).send('Google OAuth authorization expired or is invalid.');
  }
  if (req.query.error) return res.status(400).send('Google OAuth authorization was cancelled.');
  try {
    const code = String(req.query.code || '');
    if (!code) return res.status(400).send('Google OAuth did not return an authorization code.');
    const { tokens } = await getOAuthClient().getToken(code);
    if (!tokens.refresh_token) {
      return res.status(400).send('Google did not issue a refresh token. Revoke the existing grant and authorize again.');
    }
    res.type('html').send(`<!doctype html><meta charset="utf-8"><title>Torat Tsion Google Drive OAuth</title><style>body{font-family:system-ui;max-width:760px;margin:40px auto;padding:0 20px;color:#123b63}code{display:block;word-break:break-all;background:#f3f7fa;padding:16px;border:1px solid #d9e7ef}strong{color:#9b1c1c}</style><h1>Authorization complete</h1><p>Copy this refresh token into the Render environment variable <code>GOOGLE_OAUTH_REFRESH_TOKEN</code>. This page does not store it.</p><code>${escapeHtml(tokens.refresh_token)}</code><p><strong>Keep this token secret and do not commit it.</strong> Restart the Render service after saving it.</p>`);
  } catch (error) {
    console.error('Google OAuth callback failed', safeErrorCode(error));
    res.status(502).send('Google OAuth could not be completed.');
  }
});
app.get('/auth/google/status', requireAdmin, async (_req, res) => {
  const status = {
    clientConfigured: googleOAuthClientConfigured(),
    refreshTokenConfigured: Boolean(process.env.GOOGLE_OAUTH_REFRESH_TOKEN?.trim()),
    driveFolderConfigured: Boolean(folderId),
    driveAccessible: false,
  };
  if (status.clientConfigured && status.refreshTokenConfigured && status.driveFolderConfigured) {
    try {
      const drive = await getDrive();
      const response = await drive.files.get({ fileId: folderId, fields: 'id,mimeType' });
      status.driveAccessible = response.data.id === folderId && response.data.mimeType === driveFolderMimeType;
    } catch (error) {
      console.error('Google OAuth status check failed', safeErrorCode(error));
    }
  }
  res.json(status);
});
app.get('/health', (_req, res) => res.json({
  ok: true,
  contentStorage: githubContentsEnabled ? 'github' : 'filesystem',
  driveConfigured: Boolean(folderId),
  driveFolderFormatValid: validId(folderId),
  googleOAuthConfigured: googleOAuthConfigured(),
  adminConfigured: Boolean(process.env.ADMIN_USERNAME && process.env.ADMIN_PASSWORD && process.env.ADMIN_SESSION_SECRET),
  zmanimConfigured: Boolean(process.env.TORAT_TSION_LOCATION?.trim() && process.env.TORAT_TSION_ZMANIM_JSON?.trim()),
}));
app.get('/api/parsha', async (_req, res) => {
  try {
    await initializeRecordingCalendar();
    const now = new Date();
    const timeZone = process.env.RECORDING_TIME_ZONE || 'America/New_York';
    const { getParshaForDate } = require('./recording-date');
    res.json({
      parsha: getParshaForDate(now, timeZone),
      hebrewDate: new Intl.DateTimeFormat('en-u-ca-hebrew', { timeZone, dateStyle: 'long' }).format(now),
      gregorianDate: new Intl.DateTimeFormat('en-US', { timeZone, dateStyle: 'long' }).format(now),
    });
  } catch (error) {
    console.error('parsha failed', error);
    res.status(500).json({ error: 'Unable to load the current Parsha' });
  }
});
app.get('/api/minyanim', async (_req, res) => {
  try {
    const content = await readContent();
    res.json({ minyanim: Array.isArray(content.minyanim) ? content.minyanim : [] });
  } catch (error) {
    console.error('minyanim failed', error);
    res.status(500).json({ error: 'Unable to load Minyan information' });
  }
});
app.get('/api/zmanim', (_req, res) => {
  const location = process.env.TORAT_TSION_LOCATION?.trim();
  const configured = process.env.TORAT_TSION_ZMANIM_JSON?.trim();
  if (!location || !configured) return res.status(503).json({ error: 'Zmanim location and daily schedule are not configured yet.' });
  try {
    const times = JSON.parse(configured);
    if (!times || typeof times !== 'object' || Array.isArray(times)) throw new Error('Invalid zmanim JSON');
    res.json({ location, times });
  } catch (error) {
    console.error('zmanim configuration failed', error);
    res.status(500).json({ error: 'Zmanim configuration is invalid' });
  }
});
app.get('/api/recordings', async (_req, res) => { try { const [content, contents] = await Promise.all([readContent(), listDriveContents(folderId)]); res.json({ recordings: contents.recordings.map((file) => recordingMetadata(content, file)), folders: contents.folders.map((folder) => publicFolder(folder, folderId)) }); } catch (error) { console.error('recordings failed', safeErrorCode(error)); res.status(500).json({ error: 'Unable to load recordings', code: safeErrorCode(error) }); } });
app.get('/api/recordings/folder/:folderId', async (req, res) => { if (!validId(req.params.folderId)) return res.status(400).json({ error: 'Invalid folder ID' }); try { const folder = await assertFolderUnderRoot(req.params.folderId); const [content, contents, covers] = await Promise.all([readContent(), listDriveContents(req.params.folderId), readMapping()]); const recordings = buildHome(content, contents.recordings, covers, [folder]).recordings; res.json({ folder, recordings, folders: contents.folders.map((childFolder) => publicFolder(childFolder, req.params.folderId)) }); } catch (error) { console.error('folder recordings failed', safeErrorCode(error)); res.status(safeErrorCode(error) === 'drive_folder_not_found' ? 404 : 500).json({ error: 'Unable to load folder', code: safeErrorCode(error) }); } });
app.get('/api/home', async (req, res) => { try { if (req.query.summary === '1') return res.json(await buildHomeSummary()); const [content, covers, discovery] = await Promise.all([readContent(), readMapping(), getRecordingDiscovery()]); const files = discovery.entries.map(({ file, folder, folderPath }) => ({ ...file, _folderContext: folder, _folderPath: folderPath })); const home = buildHome(content, files, covers, discovery.rootContents.folders); res.json({ ...home, folders: discovery.rootContents.folders.map((folder) => publicFolder(folder, folderId)) }); } catch (error) { console.error('home failed', safeErrorCode(error)); res.status(500).json({ error: 'Unable to load homepage' }); } });
app.get('/api/categories', async (_req, res) => { try { const content = await readContent(); res.json({ categories: content.categories.filter((category) => category.enabled !== false).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)).map(publicCategory) }); } catch { res.status(500).json({ error: 'Unable to load categories' }); } });
app.get('/api/rabbis', async (_req, res) => { try { const [content, contents] = await Promise.all([readContent(), listDriveContents(folderId)]); res.json({ rabbis: mergeRabbis(content, contents.folders).filter((rabbi) => rabbi.enabled !== false).sort((a, b) => (Number(a.sortOrder || 0) - Number(b.sortOrder || 0)) || a.name.localeCompare(b.name)).map(publicRabbi) }); } catch { res.status(500).json({ error: 'Unable to load rabbis' }); } });
app.get('/api/rabbis/:id', async (req, res) => { try { const [content, covers, discovery] = await Promise.all([readContent(), readMapping(), getRecordingDiscovery()]); const rabbis = mergeRabbis(content, discovery.rootContents.folders); const rabbi = rabbis.find((item) => item.id === req.params.id || item.name === req.params.id) || findEntity(content.rabbis, req.params.id); if (!rabbi || rabbi.enabled === false) return res.status(404).json({ error: 'Rabbi not found' }); const files = discovery.entries.filter((entry) => entry.folder?.id === rabbi.id).map(({ file, folder, folderPath }) => ({ ...file, _folderContext: folder, _folderPath: folderPath })); const home = buildHome(content, files, covers, discovery.rootContents.folders); res.json({ rabbi: publicRabbi(rabbi), recordings: home.recordings.filter((recording) => recording.rabbiId === rabbi.id || (!recording.rabbiId && recording.rabbiName === rabbi.name)).sort(newestRecordingFirst)}); } catch { res.status(500).json({ error: 'Unable to load Rabbi profile' }); } });
app.get('/api/time-frame', async (req, res) => { const targetMinutes = Number(req.query.minutes); const requestedDate = String(req.query.date || '').trim(); if (!Number.isInteger(targetMinutes) || targetMinutes < 5 || targetMinutes > 120) return res.status(400).json({ error: 'Minutes must be an integer between 5 and 120' }); if (requestedDate && !/^\d{4}-\d{2}-\d{2}$/.test(requestedDate)) return res.status(400).json({ error: 'Date must use YYYY-MM-DD' }); try { const [content, covers, discovery] = await Promise.all([readContent(), readMapping(), getRecordingDiscovery()]); const files = discovery.entries.map(({ file, folder, folderPath }) => ({ ...file, _folderContext: folder, _folderPath: folderPath })); const allRecordings = buildHome(content, files, covers, discovery.rootContents.folders).recordings; const dateRecordings = requestedDate ? allRecordings.filter((recording) => recording.recordingDate === requestedDate) : allRecordings; const durationPendingCount = dateRecordings.filter((recording) => !Number.isFinite(Number(recording.durationSeconds)) || Number(recording.durationSeconds) <= 0).length; const recordings = findTimeFrameRecordings(dateRecordings, targetMinutes); res.json({ targetMinutes, requestedDate: requestedDate || null, toleranceMinutes: timeFrameToleranceMinutes(targetMinutes), recordings, scannedRecordingCount: dateRecordings.length, durationPendingCount, complete: durationPendingCount === 0 }); } catch (error) { console.error('time frame failed', safeErrorCode(error)); res.status(500).json({ error: 'Unable to find recordings for this time frame' }); } });
app.get('/api/collections', async (_req, res) => { try { const content = await readContent(); res.json({ collections: content.collections.filter((item) => isActive(item)).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)) }); } catch { res.status(500).json({ error: 'Unable to load collections' }); } });
app.get('/api/collections/:id', async (req, res) => { try { const [content, files, covers] = await Promise.all([readContent(), listRecordings(), readMapping()]); const collection = content.collections.find((item) => item.id === req.params.id && isActive(item)); if (!collection) return res.status(404).json({ error: 'Collection not found' }); const home = buildHome(content, files, covers); res.json({ collection, recordings: (collection.recordingIds || []).map((id) => home._recordingIndex[id]).filter(Boolean) }); } catch { res.status(500).json({ error: 'Unable to load collection' }); } });
app.get('/api/recording-details/:id', async (req, res) => { try { const [content, files, covers] = await Promise.all([readContent(), listRecordings(), readMapping()]); const home = buildHome(content, files, covers); const recording = home._recordingIndex[req.params.id]; if (!recording) return res.status(404).json({ error: 'Recording not found' }); const related = home.recordings.filter((item) => item.id !== recording.id && ((item.rabbiId && item.rabbiId === recording.rabbiId) || (item.categoryId && item.categoryId === recording.categoryId))).slice(0, 8); res.json({ recording, related }); } catch { res.status(500).json({ error: 'Unable to load recording details' }); } });
app.get('/api/search', async (req, res) => { try { const [content, files, covers] = await Promise.all([readContent(), listRecordings(), readMapping()]); const query = String(req.query.q || '').trim().toLowerCase(); const home = buildHome(content, files, covers); const results = home.recordings.filter((recording) => !query || [recording.title, recording.description, recording.category, recording.rabbiName, recording.name, recording.recordedAt, recording.recordedDateLabel].some((value) => String(value || '').toLowerCase().includes(query))); res.json({ results }); } catch { res.status(500).json({ error: 'Unable to search recordings' }); } });
app.post('/api/recordings/:id/play', async (req, res) => { if (!validId(req.params.id)) return res.status(400).json({ error: 'Invalid recording ID' }); try { const content = await readContent(); const current = content.recordings[req.params.id] || {}; content.recordings[req.params.id] = { ...current, playCount: Number(current.playCount || 0) + 1 }; await writeContent(content); res.json({ playCount: content.recordings[req.params.id].playCount }); } catch { res.status(500).json({ error: 'Unable to record play' }); } });
app.put('/api/admin/content', requireAdmin, async (req, res) => { if (!req.body || typeof req.body !== 'object') return res.status(400).json({ error: 'Content object is required' }); try { const current = await readContent(); const next = { ...current, ...req.body, settings: { ...current.settings, ...(req.body.settings || {}) } }; await writeContent(next); res.json({ content: next }); } catch { res.status(500).json({ error: 'Unable to save content' }); } });
app.get('/api/admin/content', requireAdmin, async (_req, res) => { try { res.json({ content: await readContent() }); } catch { res.status(500).json({ error: 'Unable to load content' }); } });
app.get('/api/admin/rabbis', requireAdmin, async (_req, res) => { try { const [content, contents] = await Promise.all([readContent(), listDriveContents(folderId)]); res.json({ rabbis: mergeRabbis(content, contents.folders).filter((rabbi) => rabbi.enabled !== false).map(publicRabbi) }); } catch { res.status(500).json({ error: 'Unable to load Rabbis' }); } });
app.get('/api/admin/categories', requireAdmin, async (_req, res) => { try { const content = await readContent(); res.json({ categories: content.categories.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)).map(publicCategory) }); } catch { res.status(500).json({ error: 'Unable to load categories' }); } });
app.get('/api/admin/recordings', requireAdmin, async (_req, res) => { try { const [content, covers, discovery] = await Promise.all([readContent(), readMapping(), getRecordingDiscovery()]); const files = discovery.entries.map(({ file, folder }) => ({ ...file, _folderContext: folder })); const recordings = buildHome(content, files, covers, discovery.rootContents.folders).recordings.map((recording) => ({ ...recording, description: recording.description || '', visible: recording.visible !== false, featured: Boolean(recording.featured), trending: Boolean(recording.trending), new: Boolean(recording.new), sortOrder: Number(recording.sortOrder || 0) })); res.json({ recordings }); } catch { res.status(500).json({ error: 'Unable to load recordings' }); } });
app.get('/api/admin/discovery-diagnostics', requireAdmin, async (_req, res) => {
  try {
    const discovery = await getRecordingDiscovery();
    const missingDriveDuration = discovery.entries.filter(({ file }) => !Number.isFinite(Number(file.videoMediaMetadata?.durationMillis))).length;
    const content = await readContent();
    const stillMissingDuration = discovery.entries.filter(({ file }) => {
      const saved = content.recordings[file.id];
      return asFiniteNumber(saved?.durationSeconds, null) === null && !Number.isFinite(Number(file.videoMediaMetadata?.durationMillis));
    }).length;
    res.json({
      totalFilesScanned: discovery.diagnostics.totalFiles,
      foldersDiscovered: discovery.diagnostics.folders,
      shortcutsSeen: discovery.diagnostics.shortcuts,
      shortcutsUnresolved: discovery.diagnostics.unresolvedShortcuts,
      audioRecordingsDiscovered: discovery.entries.length,
      rejectedByMimeType: discovery.diagnostics.rejectedByMimeType,
      recordingsMissingDriveDuration: missingDriveDuration,
      recordingsStillMissingDurationAfterCache: stillMissingDuration,
    });
  } catch (error) {
    console.error('discovery diagnostics failed', safeErrorCode(error));
    res.status(500).json({ error: 'Unable to load discovery diagnostics', code: safeErrorCode(error) });
  }
});
app.post('/api/admin/recordings/:id/analyze-shiur-start', requireAdmin, async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ error: 'Invalid recording ID' });
  let tempPath;
  try {
    const file = (await listRecordings()).find((entry) => entry.id === req.params.id);
    if (!file) return res.status(404).json({ error: 'Recording not found' });
    const content = await readContent();
    tempPath = path.join('/tmp', `torat-tsion-shiur-${req.params.id}-${Date.now()}.tmp`);
    const drive = await getDrive();
    const partialResponse = await drive.files.get(
      { fileId: file.id, alt: 'media' },
      { responseType: 'stream', headers: { Range: 'bytes=0-12582911' } },
    );
    await writeStreamToFile(partialResponse.data, tempPath);
    let analysis = await detectSpeechStartFromAudioFile(tempPath);

    // Some MP4/3GP recordings keep their index at the end; only those fall back to a full download.
    if (!analysis) {
      const completeResponse = await drive.files.get(
        { fileId: file.id, alt: 'media' },
        { responseType: 'stream' },
      );
      await writeStreamToFile(completeResponse.data, tempPath);
      analysis = await detectSpeechStartFromAudioFile(tempPath);
    }
    if (!analysis) return res.status(422).json({ error: 'Speech-start detection is not available for this recording.' });

    const current = content.recordings[req.params.id] || {};
    content.recordings[req.params.id] = {
      ...current,
      shiurStartSeconds: Number(analysis.startSeconds),
      shiurStartSource: 'automatic',
      shiurStartConfidence: Number(analysis.confidence),
      shiurSkipEnabled: analysis.startSeconds > 0,
      ...(analysis.durationSeconds ? { durationSeconds: analysis.durationSeconds } : {}),
      updatedAt: new Date().toISOString(),
    };
    await writeContent(content);
    res.json({ recording: recordingMetadata(content, file), detected: analysis });
  } catch (error) {
    console.error('shiur start analyze failed', error);
    res.status(500).json({ error: 'Unable to analyze shiur start' });
  } finally {
    if (tempPath) await fsp.unlink(tempPath).catch((error) => {
      if (error.code !== 'ENOENT') console.error('shiur analysis cleanup failed', error.message);
    });
  }
});
app.post('/api/admin/rabbis', requireAdmin, async (req, res) => { const name = String(req.body?.name || '').trim(); if (!name) return res.status(400).json({ error: 'Rabbi name is required' }); try { const content = await readContent(); const rabbi = { id: newContentId('rabbi'), name: name.slice(0, 160), description: String(req.body.description || '').slice(0, 500), biography: String(req.body.biography || '').slice(0, 5000), featured: Boolean(req.body.featured), enabled: req.body.enabled !== false, sortOrder: Number(req.body.sortOrder || content.rabbis.length), photoUrl: null, createdAt: new Date().toISOString() }; content.rabbis.push(rabbi); await writeContent(content); res.status(201).json({ rabbi: publicRabbi(rabbi) }); } catch { res.status(500).json({ error: 'Unable to create Rabbi' }); } });
app.patch('/api/admin/rabbis/:id', requireAdmin, async (req, res) => { try { const [content, rootContents] = await Promise.all([readContent(), listDriveContents(folderId)]); const folder = rootContents.folders.find((item) => item.id === req.params.id); const rabbi = findEntity(content.rabbis, req.params.id) || (folder ? ensureDiscoveredRabbi(content, folder) : null); if (!rabbi) return res.status(404).json({ error: 'Rabbi not found' }); Object.assign(rabbi, { ...req.body, name: req.body.name === undefined ? rabbi.name : String(req.body.name).trim().slice(0, 160), description: req.body.description === undefined ? rabbi.description : String(req.body.description).slice(0, 500), biography: req.body.biography === undefined ? rabbi.biography : String(req.body.biography).slice(0, 5000), sortOrder: req.body.sortOrder === undefined ? rabbi.sortOrder : Number(req.body.sortOrder), featured: req.body.featured === undefined ? rabbi.featured : Boolean(req.body.featured), enabled: req.body.enabled === undefined ? rabbi.enabled : Boolean(req.body.enabled), updatedAt: new Date().toISOString() }); if (!rabbi.name) return res.status(400).json({ error: 'Rabbi name is required' }); await writeContent(content); invalidateRecordingDiscovery(); res.json({ rabbi: publicRabbi(rabbi) }); } catch { res.status(500).json({ error: 'Unable to update Rabbi' }); } });
app.delete('/api/admin/rabbis/:id', requireAdmin, async (req, res) => { try { const [content, rootContents] = await Promise.all([readContent(), listDriveContents(folderId)]); const folder = rootContents.folders.find((item) => item.id === req.params.id); const rabbi = findEntity(content.rabbis, req.params.id) || (folder ? ensureDiscoveredRabbi(content, folder) : null); if (!rabbi) return res.status(404).json({ error: 'Rabbi not found' }); if (folder) { rabbi.enabled = false; rabbi.updatedAt = new Date().toISOString(); } else content.rabbis = content.rabbis.filter((item) => item.id !== req.params.id); await writeContent(content); invalidateRecordingDiscovery(); res.json({ deleted: true }); } catch { res.status(500).json({ error: 'Unable to delete Rabbi' }); } });
app.post('/api/admin/rabbis/:id/photo', requireAdmin, upload.single('image'), async (req, res) => { if (!req.file || !allowedMimeTypes.has(req.file.mimetype) || !validSignature(req.file.buffer, req.file.mimetype)) return res.status(400).json({ error: 'A valid image is required' }); try { const [content, rootContents] = await Promise.all([readContent(), listDriveContents(folderId)]); const folder = rootContents.folders.find((item) => item.id === req.params.id); const rabbi = findEntity(content.rabbis, req.params.id) || (folder ? ensureDiscoveredRabbi(content, folder) : null); if (!rabbi) return res.status(404).json({ error: 'Rabbi not found' }); await Promise.all([...allowedMimeTypes].map((mimeType) => deleteStoredFile(`rabbis/${rabbi.id}.${extension(mimeType)}`, 'Remove replaced Torat Tsion Rabbi cover'))); const ext = extension(req.file.mimetype); await writeStoredFile(`rabbis/${rabbi.id}.${ext}`, req.file.buffer, 'Update Torat Tsion Rabbi cover'); rabbi.photoUrl = `/api/rabbis/${encodeURIComponent(rabbi.id)}/photo`; rabbi.updatedAt = new Date().toISOString(); await writeContent(content); invalidateRecordingDiscovery(); res.json({ rabbi: publicRabbi(rabbi) }); } catch (error) { console.error('rabbi photo save failed', error.code || error.message); res.status(500).json({ error: 'Unable to save Rabbi photo' }); } });
app.delete('/api/admin/rabbis/:id/photo', requireAdmin, async (req, res) => { try { const content = await readContent(); const rabbi = findEntity(content.rabbis, req.params.id); if (!rabbi) return res.status(404).json({ error: 'Rabbi not found' }); await Promise.all([...allowedMimeTypes].map((mimeType) => deleteStoredFile(`rabbis/${rabbi.id}.${extension(mimeType)}`, 'Remove Torat Tsion Rabbi cover'))); rabbi.photoUrl = null; rabbi.updatedAt = new Date().toISOString(); await writeContent(content); invalidateRecordingDiscovery(); res.json({ rabbi: publicRabbi(rabbi) }); } catch (error) { console.error('rabbi photo removal failed', error.code || error.message); res.status(500).json({ error: 'Unable to remove Rabbi photo' }); } });
app.get('/api/rabbis/:id/photo', async (req, res) => { try { const content = await readContent(); const rabbi = findEntity(content.rabbis, req.params.id); if (!rabbi?.photoUrl) return res.status(404).end(); for (const mimeType of allowedMimeTypes) { const bytes = await readStoredFile(`rabbis/${rabbi.id}.${extension(mimeType)}`); if (bytes) return res.type(mimeType).set('Cache-Control', 'public, max-age=300').send(bytes); } return res.status(404).end(); } catch (error) { console.error('rabbi photo load failed', error.code || error.message); return res.status(404).end(); } });
app.get('/api/admin/carousel', requireAdmin, async (_req, res) => { try { const content = await readContent(); res.json({ carousel: [...(content.carousel || [])].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)) }); } catch { res.status(500).json({ error: 'Unable to load carousel' }); } });
app.post('/api/admin/carousel', requireAdmin, async (req, res) => { try { const content = await readContent(); content.carousel = content.carousel || []; const item = { id: newContentId('carousel'), title: String(req.body?.title || '').slice(0, 160), subtitle: String(req.body?.subtitle || '').slice(0, 160), kind: ['live', 'upcoming', 'recording', 'custom'].includes(req.body?.kind) ? req.body.kind : 'recording', recordingId: req.body?.recordingId || null, coverUrl: req.body?.coverUrl || null, link: req.body?.link || null, countdownAt: req.body?.countdownAt || null, enabled: req.body?.enabled !== false, sortOrder: Number(req.body?.sortOrder ?? content.carousel.length), createdAt: new Date().toISOString() }; content.carousel.push(item); await writeContent(content); res.status(201).json({ item }); } catch { res.status(500).json({ error: 'Unable to create carousel item' }); } });
app.patch('/api/admin/carousel/:id', requireAdmin, async (req, res) => { try { const content = await readContent(); const item = findEntity(content.carousel || [], req.params.id); if (!item) return res.status(404).json({ error: 'Carousel item not found' }); Object.assign(item, { ...req.body, id: item.id, updatedAt: new Date().toISOString() }); await writeContent(content); res.json({ item }); } catch { res.status(500).json({ error: 'Unable to update carousel item' }); } });
app.delete('/api/admin/carousel/:id', requireAdmin, async (req, res) => { try { const content = await readContent(); content.carousel = (content.carousel || []).filter((item) => item.id !== req.params.id); await writeContent(content); res.json({ deleted: true }); } catch { res.status(500).json({ error: 'Unable to delete carousel item' }); } });
app.post('/api/admin/categories', requireAdmin, async (req, res) => { const name = String(req.body?.name || '').trim(); if (!name) return res.status(400).json({ error: 'Category name is required' }); try { const content = await readContent(); const category = { id: newContentId('category'), name: name.slice(0, 100), description: String(req.body.description || '').slice(0, 500), folderIds: [], enabled: req.body.enabled !== false, sortOrder: Number(req.body.sortOrder || content.categories.length), createdAt: new Date().toISOString() }; content.categories.push(category); await writeContent(content); res.status(201).json({ category: publicCategory(category) }); } catch { res.status(500).json({ error: 'Unable to create category' }); } });
app.patch('/api/admin/categories/:id', requireAdmin, async (req, res) => { try { const content = await readContent(); const category = findEntity(content.categories, req.params.id); if (!category) return res.status(404).json({ error: 'Category not found' }); const requestedFolderIds = req.body.folderIds === undefined ? category.folderIds : (Array.isArray(req.body.folderIds) ? [...new Set(req.body.folderIds.filter(validId))] : []); Object.assign(category, { ...req.body, name: req.body.name === undefined ? category.name : String(req.body.name).trim().slice(0, 100), folderIds: requestedFolderIds, sortOrder: req.body.sortOrder === undefined ? category.sortOrder : Number(req.body.sortOrder), enabled: req.body.enabled === undefined ? category.enabled : Boolean(req.body.enabled), updatedAt: new Date().toISOString() }); if (!category.name) return res.status(400).json({ error: 'Category name is required' }); await writeContent(content); res.json({ category: publicCategory(category) }); } catch { res.status(500).json({ error: 'Unable to update category' }); } });
app.delete('/api/admin/categories/:id', requireAdmin, async (req, res) => { try { const content = await readContent(); const previousLength = content.categories.length; content.categories = content.categories.filter((category) => category.id !== req.params.id); if (content.categories.length === previousLength) return res.status(404).json({ error: 'Category not found' }); Object.values(content.recordings).forEach((recording) => { if (recording.categoryId === req.params.id) delete recording.categoryId; }); await writeContent(content); res.json({ deleted: true }); } catch { res.status(500).json({ error: 'Unable to delete category' }); } });
app.patch('/api/admin/recordings/:id', requireAdmin, async (req, res) => { if (!validId(req.params.id)) return res.status(400).json({ error: 'Invalid recording ID' }); try { const content = await readContent(); const current = content.recordings[req.params.id] || {}; content.recordings[req.params.id] = { ...current, ...req.body, title: req.body.title === undefined ? current.title : displayRecordingTitle(req.body.title, '', recordingTimeZone), updatedAt: new Date().toISOString() }; await writeContent(content); res.json({ recording: content.recordings[req.params.id] }); } catch { res.status(500).json({ error: 'Unable to save recording metadata' }); } });
async function getRecordingMetadata(drive, recordingId) {
  const response = await drive.files.get({
    fileId: recordingId,
    fields: 'id,name,mimeType,size,videoMediaMetadata',
    supportsAllDrives: false,
  });
  return response.data;
}
app.get('/api/recordings/:id', async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ error: 'Invalid recording ID' });
  try {
    const drive = await getDrive();
    const range = req.get('range');
    const metadata = await getRecordingMetadata(drive, req.params.id);
    const contentType = audioContentType(metadata);
    if (!contentType) return res.status(404).json({ error: 'Unable to stream recording' });

    const response = await drive.files.get(
      { fileId: req.params.id, alt: 'media', supportsAllDrives: false },
      { responseType: 'stream', headers: range ? { Range: range } : undefined },
    );
    const headers = {
      'Accept-Ranges': response.headers['accept-ranges'] || 'bytes',
      'Cache-Control': 'private, max-age=300',
      'Content-Type': contentType,
      'Content-Disposition': 'inline',
    };
    const length = response.headers['content-length'];
    const contentRange = response.headers['content-range'] ?? requestedContentRange(range, Number(metadata.size))?.value;
    if (length) headers['Content-Length'] = String(length);
    else if (!range && metadata.size) headers['Content-Length'] = String(metadata.size);
    else if (response.status === 206) {
      const rangeDetails = requestedContentRange(range, Number(metadata.size));
      if (rangeDetails) headers['Content-Length'] = String(rangeDetails.length);
    }
    if (contentRange) headers['Content-Range'] = contentRange;
    res.status(response.status === 206 ? 206 : 200).set(headers);
    response.data.pipe(res);
  } catch (error) {
    console.error('recording stream failed', driveErrorDetails(error));
    res.status(error?.response?.status === 416 ? 416 : 404).json({ error: 'Unable to stream recording' });
  }
});
app.get('/api/recordings/:id/download', async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ error: 'Invalid recording ID' });
  try {
    const drive = await getDrive();
    const metadata = await getRecordingMetadata(drive, req.params.id);
    if (!isAudioFile(metadata)) return res.status(404).json({ error: 'Recording not found' });
    const contentType = audioContentType(metadata) || 'application/octet-stream';
    const fileName = (metadata.name || 'torat-tsion-recording').replace(/[\\/]+/g, '_');
    const response = await drive.files.get(
      { fileId: req.params.id, alt: 'media', supportsAllDrives: false },
      { responseType: 'stream' },
    );

    res.set({
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'private, max-age=300',
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    });
    if (metadata.size) res.set('Content-Length', String(metadata.size));
    response.data.pipe(res);
  } catch (error) {
    console.error('recording download failed', driveErrorDetails(error));
    res.status(error?.response?.status === 416 ? 416 : 404).json({ error: 'Unable to download recording' });
  }
});
app.get('/api/covers', async (_req, res) => { try { res.json(await readMapping()); } catch { res.status(500).json({ error: 'Unable to load Shiur covers' }); } });
app.get('/api/covers/:id', async (req, res) => { if (!validId(req.params.id)) return res.status(400).json({ error: 'Invalid Shiur ID' }); try { const mapping = await readMapping(); const cover = mapping[req.params.id]; if (req.query.format === 'image') { if (!cover) return res.status(404).end(); const bytes = await readStoredFile(`covers/${req.params.id}.${extension(cover.mimeType)}`); if (!bytes) return res.status(404).end(); return res.type(cover.mimeType).set('Cache-Control', 'private, max-age=300').send(bytes); } res.json({ cover: cover || null, fallback: !cover }); } catch (error) { console.error('cover load failed', error.code || error.message); res.status(500).json({ error: 'Unable to load Shiur cover', fallback: true }); } });
app.post('/api/covers/:id', requireAdmin, upload.single('image'), async (req, res) => { if (!validId(req.params.id)) return res.status(400).json({ error: 'Invalid Shiur ID' }); const file = req.file; if (!file || !allowedMimeTypes.has(file.mimetype)) return res.status(400).json({ error: 'A valid image is required' }); if (!validSignature(file.buffer, file.mimetype)) return res.status(400).json({ error: 'The uploaded file is not a valid image' }); try { const mapping = await readMapping(); const previous = mapping[req.params.id]; if (previous) await deleteStoredFile(`covers/${req.params.id}.${extension(previous.mimeType)}`, 'Remove replaced Torat Tsion recording cover'); const ext = extension(file.mimetype); await writeStoredFile(`covers/${req.params.id}.${ext}`, file.buffer, 'Update Torat Tsion recording cover'); mapping[req.params.id] = { coverUrl: `/api/covers/${encodeURIComponent(req.params.id)}?format=image`, fileName: (file.originalname || `cover.${ext}`).slice(0, 160), mimeType: file.mimetype, updatedAt: new Date().toISOString() }; await writeMapping(mapping); res.json({ cover: mapping[req.params.id] }); } catch (error) { console.error('cover save failed', error.code || error.message); res.status(500).json({ error: 'Unable to save Shiur cover' }); } });
app.delete('/api/covers/:id', requireAdmin, async (req, res) => { if (!validId(req.params.id)) return res.status(400).json({ error: 'Invalid Shiur ID' }); try { const mapping = await readMapping(); const previous = mapping[req.params.id]; if (previous) { delete mapping[req.params.id]; await writeMapping(mapping); await deleteStoredFile(`covers/${req.params.id}.${extension(previous.mimeType)}`, 'Remove Torat Tsion recording cover'); } res.json({ cover: null, fallback: true }); } catch (error) { console.error('cover removal failed', error.code || error.message); res.status(500).json({ error: 'Unable to remove Shiur cover' }); } });
app.post('/api/admin/login', (req, res) => { if (typeof req.body?.username !== 'string' || typeof req.body?.password !== 'string') return res.status(400).json({ error: 'Username and password are required' }); if (!adminConfigurationValid()) return res.status(503).json({ error: 'Admin authentication is not configured' }); if (!constantTimeEqual(req.body.username, process.env.ADMIN_USERNAME) || !constantTimeEqual(req.body.password, process.env.ADMIN_PASSWORD)) return res.status(401).json({ error: 'Invalid admin credentials' }); const token = makeSession(process.env.ADMIN_USERNAME); res.set('Set-Cookie', `${cookieName}=${token}; Path=/; Max-Age=${sessionDurationSeconds}; HttpOnly; SameSite=Lax${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`); res.json({ authenticated: true, sessionToken: token }); });
app.use((error, _req, res, _next) => { if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'Image must be smaller than 5 MB' }); console.error('backend request failed'); res.status(500).json({ error: 'Server error' }); });
function startDurationHydrationWorker() {
  const refresh = () => {
    getRecordingDiscovery().catch((error) => console.error('duration hydration refresh failed', safeErrorCode(error)));
  };
  setTimeout(refresh, 5_000).unref();
  setInterval(refresh, durationHydrationRefreshMs).unref();
}

initializeRecordingCalendar().then(() => {
  app.listen(port, () => {
    console.log(`Torat Tsion backend listening on ${port}`);
    startDurationHydrationWorker();
  });
}).catch(() => {
  console.error('Unable to initialize recording calendar');
  process.exitCode = 1;
});
