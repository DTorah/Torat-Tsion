import { assertFolderUnderRoot, driveErrorCode, listDriveContents } from '@/lib/server/google-drive';

type RouteContext = {
  params: { folderId: string };
};

const validDriveId = /^[A-Za-z0-9_-]{10,200}$/;

export async function GET(_request: Request, context: RouteContext) {
  const folderId = context.params.folderId;
  if (!validDriveId.test(folderId)) {
    return Response.json({ error: 'Invalid folder ID' }, { status: 400 });
  }

  try {
    const folder = await assertFolderUnderRoot(folderId);
    const contents = await listDriveContents(folderId);
    return Response.json({
      folder,
      recordings: contents.recordings.map((file) => ({
        id: file.id,
        name: file.name,
        mimeType: file.mimeType,
        size: file.size ? Number(file.size) : null,
        createdTime: file.createdTime ?? null,
        modifiedTime: file.modifiedTime ?? null,
        streamUrl: `/api/recordings/${encodeURIComponent(file.id!)}`,
      })),
      folders: contents.folders.map((childFolder) => ({
        id: childFolder.id,
        name: childFolder.name,
        parentId: folderId,
      })),
    });
  } catch (error) {
    const code = driveErrorCode(error);
    console.error('Unable to load Drive folder:', code);
    return Response.json({ error: 'Unable to load folder', code }, { status: code === 'drive_folder_not_found' ? 404 : 500 });
  }
}
