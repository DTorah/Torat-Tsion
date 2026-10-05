import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

type CoverRecord = {
  coverUrl: string;
  fileName: string;
  mimeType: string;
  updatedAt: string;
};

export type CoverMapping = Record<string, CoverRecord>;

export interface CoverStorage {
  listAssignments(): Promise<CoverMapping>;
  getCover(fileId: string): Promise<CoverRecord | null>;
  saveCover(fileId: string, bytes: Buffer, mimeType: string, fileName?: string): Promise<CoverRecord>;
  deleteCover(fileId: string): Promise<boolean>;
}

const dataDirectory = process.env.TORAT_TSION_DATA_DIR ?? '/home/codespace/.config/torat-tsion';
const coversDirectory = join(dataDirectory, 'covers');
const mappingPath = join(dataDirectory, 'covers.json');
const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const maxImageBytes = 5 * 1024 * 1024;

export function isValidDriveFileId(fileId: string) {
  return /^[A-Za-z0-9_-]+$/.test(fileId);
}

async function readMapping(): Promise<CoverMapping> {
  try {
    return JSON.parse(await readFile(mappingPath, 'utf8')) as CoverMapping;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {};
    throw error;
  }
}

async function writeMapping(mapping: CoverMapping) {
  await mkdir(dataDirectory, { recursive: true });
  const temporaryPath = `${mappingPath}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(mapping, null, 2)}\n`, 'utf8');
  await rename(temporaryPath, mappingPath);
}

export async function getCoverMapping() {
  return readMapping();
}

export async function getCover(fileId: string) {
  const mapping = await readMapping();
  return mapping[fileId] ?? null;
}

export async function getCoverImage(fileId: string) {
  const cover = await getCover(fileId);
  if (!cover) return null;
  return { ...cover, bytes: await readFile(join(coversDirectory, `${fileId}.${extensionFor(cover.mimeType)}`)) };
}

function extensionFor(mimeType: string) {
  return mimeType === 'image/jpeg' ? 'jpg' : mimeType.slice('image/'.length);
}

function hasImageSignature(bytes: Buffer, mimeType: string) {
  if (mimeType === 'image/png') return bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (mimeType === 'image/jpeg') return bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255]));
  return bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP';
}

export async function saveCover(fileId: string, bytes: Buffer, mimeType: string, fileName?: string) {
  if (!allowedMimeTypes.has(mimeType)) throw new Error('Unsupported image type');
  if (bytes.length === 0 || bytes.length > maxImageBytes) throw new Error('Image must be smaller than 5 MB');
  if (!hasImageSignature(bytes, mimeType)) throw new Error('The uploaded file is not a valid image');

  await mkdir(coversDirectory, { recursive: true });
  const extension = extensionFor(mimeType);
  const imagePath = join(coversDirectory, `${fileId}.${extension}`);
  await writeFile(`${imagePath}.tmp`, bytes);
  await rename(`${imagePath}.tmp`, imagePath);

  const mapping = await readMapping();
  const previous = mapping[fileId];
  mapping[fileId] = {
    coverUrl: `/api/covers/${encodeURIComponent(fileId)}?format=image`,
    fileName: fileName?.slice(0, 160) || `cover.${extension}`,
    mimeType,
    updatedAt: new Date().toISOString(),
  };
  await writeMapping(mapping);

  if (previous && previous.mimeType !== mimeType) {
    await unlink(join(coversDirectory, `${fileId}.${extensionFor(previous.mimeType)}`)).catch(() => undefined);
  }
  return mapping[fileId];
}

export async function removeCover(fileId: string) {
  const mapping = await readMapping();
  const previous = mapping[fileId];
  if (!previous) return false;
  delete mapping[fileId];
  await writeMapping(mapping);
  await unlink(join(coversDirectory, `${fileId}.${extensionFor(previous.mimeType)}`)).catch(() => undefined);
  return true;
}

// The filesystem adapter is suitable for Codespaces and a single persistent server.
// Use a database or durable object storage adapter for serverless production deployments.
export const fileSystemCoverStorage: CoverStorage = {
  listAssignments: getCoverMapping,
  getCover,
  saveCover,
  deleteCover: removeCover,
};

export const coverStorage = fileSystemCoverStorage;
