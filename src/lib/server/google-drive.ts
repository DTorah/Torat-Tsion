import { readFile } from 'node:fs/promises';
import { google, type drive_v3 } from 'googleapis';

export const RECORDINGS_FOLDER_ID = process.env.TORAT_TSION_DRIVE_FOLDER_ID?.trim() || '';
export const DRIVE_FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder';
const AUDIO_FALLBACK_EXTENSIONS = new Set(['aac', 'flac', 'm4a', 'mp3', 'mp4', 'oga', 'ogg', 'opus', 'wav', 'webm']);
const AUDIO_ONLY_VIDEO_MIME_TYPES = new Set(['video/3gpp', 'video/3gpp2', 'video/mp4']);

const SERVICE_ACCOUNT_PATH =
  process.env.TORAT_TSION_SERVICE_ACCOUNT_PATH ||
  '/home/codespace/.config/torat-tsion/google-service-account.json';

let driveClient: drive_v3.Drive | undefined;

class DriveConfigurationError extends Error {
  constructor(public readonly code: 'missing' | 'invalid-json' | 'invalid-shape') {
    super('Drive configuration is invalid');
  }
}

class DriveRequestError extends Error {
  constructor(public readonly stage: 'authentication' | 'folder' | 'api', public readonly status?: number) {
    super('Drive request failed');
  }
}

const validDriveFileId = /^[A-Za-z0-9_-]{10,200}$/;

export function recordingsFolderStatus() {
  return {
    configured: Boolean(RECORDINGS_FOLDER_ID),
    formatValid: validDriveFileId.test(RECORDINGS_FOLDER_ID),
  };
}

function parseCredentials(value: string) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
    if (typeof parsed === 'string') parsed = JSON.parse(parsed);
  } catch {
    throw new DriveConfigurationError('invalid-json');
  }

  if (!parsed || typeof parsed !== 'object') throw new DriveConfigurationError('invalid-shape');
  const credentials = parsed as Record<string, unknown>;
  if (typeof credentials.client_email !== 'string' || typeof credentials.private_key !== 'string' || typeof credentials.project_id !== 'string') {
    throw new DriveConfigurationError('invalid-shape');
  }
  return { ...credentials, private_key: credentials.private_key.replace(/\\n/g, '\n') };
}

export function driveConfigurationStatus() {
  return process.env.GOOGLE_SERVICE_ACCOUNT_JSON ? 'environment' : 'local-file';
}

async function getDriveClient() {
  if (driveClient) {
    return driveClient;
  }

  const credentialsValue = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  const credentialsJson = credentialsValue?.startsWith('{') || credentialsValue?.startsWith('"')
    ? credentialsValue
    : credentialsValue
      ? await readFile(credentialsValue, 'utf8')
      : await readFile(SERVICE_ACCOUNT_PATH, 'utf8').catch(() => { throw new DriveConfigurationError('missing'); });
  const credentials = parseCredentials(credentialsJson);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });

  try {
    await auth.getAccessToken();
  } catch (error) {
    const status = (error as { response?: { status?: number } })?.response?.status;
    throw new DriveRequestError('authentication', status);
  }

  driveClient = google.drive({ version: 'v3', auth });
  return driveClient;
}

export function driveErrorCode(error: unknown) {
  if (error instanceof DriveConfigurationError) return `configuration_${error.code}`;
  if (error instanceof DriveRequestError) {
    if (error.stage === 'authentication') return 'drive_authentication';
    if (error.status === 403) return 'drive_authorization';
    if (error.status === 404) return 'drive_folder_not_found';
    return 'drive_api_error';
  }
  const response = (error as { response?: { status?: number; data?: { error?: { errors?: Array<{ reason?: string }> } } } })?.response;
  const status = response?.status;
  const reason = response?.data?.error?.errors?.[0]?.reason;
  if (status === 401) return 'drive_authentication';
  if (status === 403 || reason === 'insufficientPermissions') return 'drive_authorization';
  if (status === 404 || reason === 'notFound') return 'drive_folder_not_found';
  if (status && status >= 400) return 'drive_api_error';
  return 'unknown_drive_error';
}

function isAudioFile(file: drive_v3.Schema$File) {
  if (!file.id || !file.name || file.mimeType === DRIVE_FOLDER_MIME_TYPE) return false;
  if (file.mimeType?.startsWith('audio/')) return true;
  const name = file.name.toLowerCase();
  const audioOnlyVideo = AUDIO_ONLY_VIDEO_MIME_TYPES.has(file.mimeType || '') &&
    file.videoMediaMetadata?.width === 0 &&
    file.videoMediaMetadata?.height === 0 &&
    (name.endsWith('.ogg.ogx') || name.endsWith('.oga.ogx') || name.endsWith('.mp4'));
  if (audioOnlyVideo) return true;
  if (file.mimeType !== 'application/octet-stream' && file.mimeType !== 'binary/octet-stream') return false;
  const extension = name.split('.').pop();
  return Boolean(extension && AUDIO_FALLBACK_EXTENSIONS.has(extension));
}

export function recordingContentType(file: drive_v3.Schema$File) {
  if (!isAudioFile(file)) return null;
  if (file.mimeType?.startsWith('audio/')) return file.mimeType;
  if (file.mimeType === 'video/3gpp' || file.mimeType === 'video/3gpp2') return 'audio/3gpp';
  if (file.mimeType === 'video/mp4') return 'audio/mp4';
  return `audio/${file.name!.toLowerCase().split('.').pop()}`;
}

export async function listDriveContents(parentId = RECORDINGS_FOLDER_ID) {
  const drive = await getDriveClient();
  const files: drive_v3.Schema$File[] = [];
  let pageToken: string | undefined;

  do {
    let response: { data: drive_v3.Schema$FileList };
    try {
      response = await drive.files.list({
        q: `'${parentId}' in parents and trashed = false`,
        fields: 'nextPageToken, files(id, name, mimeType, size, createdTime, modifiedTime, videoMediaMetadata)',
        orderBy: 'createdTime desc',
        pageSize: 1000,
        pageToken,
        spaces: 'drive',
      });
    } catch (error) {
      const status = (error as { response?: { status?: number } })?.response?.status;
      throw new DriveRequestError('folder', status);
    }

    files.push(...(response.data.files ?? []));
    pageToken = response.data.nextPageToken ?? undefined;
  } while (pageToken);

  return {
    recordings: files.filter(isAudioFile),
    folders: files.filter((file) => file.id && file.name && file.mimeType === DRIVE_FOLDER_MIME_TYPE),
  };
}

export async function listRecordingFiles() {
  return (await listDriveContents()).recordings;
}

export async function assertFolderUnderRoot(folderId: string) {
  if (folderId === RECORDINGS_FOLDER_ID) return { id: folderId, name: 'Recordings', parentId: null };
  const drive = await getDriveClient();
  const visited = new Set<string>();
  let currentId: string | undefined = folderId;
  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);
    const folderResponse: { data: drive_v3.Schema$File } = await drive.files.get({
      fileId: currentId,
      fields: 'id,name,mimeType,parents',
      supportsAllDrives: false,
    });
    if (folderResponse.data.mimeType !== DRIVE_FOLDER_MIME_TYPE) throw new DriveRequestError('folder', 404);
    if (folderResponse.data.parents?.includes(RECORDINGS_FOLDER_ID)) return { id: folderResponse.data.id!, name: folderResponse.data.name!, parentId: RECORDINGS_FOLDER_ID };
    currentId = folderResponse.data.parents?.[0];
  }
  throw new DriveRequestError('folder', 404);
}

export async function getRecordingFile(fileId: string) {
  const drive = await getDriveClient();
  const response = await drive.files.get({
    fileId,
    fields: 'id, name, mimeType, size, videoMediaMetadata',
    supportsAllDrives: false,
  });

  const file = response.data;
  if (!recordingContentType(file)) {
    throw new Error('Requested file is not an audio recording');
  }

  return file;
}

export async function streamRecordingFile(fileId: string, range?: string) {
  const drive = await getDriveClient();
  return drive.files.get(
    { fileId, alt: 'media', supportsAllDrives: false },
    {
      responseType: 'stream',
      headers: range ? { Range: range } : undefined,
    },
  );
}
