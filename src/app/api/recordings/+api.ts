import { driveErrorCode, listDriveContents, RECORDINGS_FOLDER_ID } from '@/lib/server/google-drive';

function publicFolder(folder: { id?: string | null; name?: string | null }, parentId: string) {
	return { id: folder.id!, name: folder.name!, parentId };
}

export async function GET() {
	try {
		const contents = await listDriveContents();

		return Response.json({
			recordings: contents.recordings.map((file) => ({
				id: file.id,
				name: file.name,
				mimeType: file.mimeType,
				size: file.size ? Number(file.size) : null,
				createdTime: file.createdTime ?? null,
				modifiedTime: file.modifiedTime ?? null,
				streamUrl: `/api/recordings/${encodeURIComponent(file.id!)}`,
			})),
			folders: contents.folders.map((folder) => publicFolder(folder, RECORDINGS_FOLDER_ID)),
		});
	} catch (error) {
		console.error('Unable to list Drive recordings:', driveErrorCode(error));
		return Response.json({ error: 'Unable to load recordings', code: driveErrorCode(error) }, { status: 500 });
	}
}
