import { coverStorage, getCoverImage, isValidDriveFileId } from '@/lib/server/covers';
import { requireAdmin } from '@/lib/server/admin-auth';

type RouteContext = { params: { id: string } };

function fileIdFrom(request: Request, context?: RouteContext) {
  return context?.params?.id ?? new URL(request.url).pathname.split('/').filter(Boolean).pop() ?? '';
}

export async function GET(request: Request, context?: RouteContext) {
  const fileId = fileIdFrom(request, context);
  if (!isValidDriveFileId(fileId)) return Response.json({ error: 'Invalid Shiur ID' }, { status: 400 });

  try {
    const cover = await coverStorage.getCover(fileId);
    if (new URL(request.url).searchParams.get('format') === 'image') {
      const image = cover ? await getCoverImage(fileId) : null;
      if (!image) return new Response(null, { status: 404 });
      return new Response(image.bytes, {
        headers: { 'Cache-Control': 'private, max-age=300', 'Content-Type': image.mimeType },
      });
    }
    return Response.json({ cover, fallback: !cover });
  } catch (error) {
    console.error('Unable to load Shiur cover', error);
    return Response.json({ error: 'Unable to load Shiur cover', fallback: true }, { status: 500 });
  }
}

export async function POST(request: Request, context?: RouteContext) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const fileId = fileIdFrom(request, context);
  if (!isValidDriveFileId(fileId)) return Response.json({ error: 'Invalid Shiur ID' }, { status: 400 });
  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (contentLength > 5 * 1024 * 1024 + 64 * 1024) return Response.json({ error: 'Image must be smaller than 5 MB' }, { status: 413 });

  try {
    const form = await request.formData();
    const image = (form as unknown as { get(name: string): FormDataEntryValue | null }).get('image');
    if (!(image instanceof File)) return Response.json({ error: 'An image is required' }, { status: 400 });
    const cover = await coverStorage.saveCover(fileId, Buffer.from(await image.arrayBuffer()), image.type, image.name);
    return Response.json({ cover });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to save Shiur cover';
    return Response.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: Request, context?: RouteContext) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const fileId = fileIdFrom(request, context);
  if (!isValidDriveFileId(fileId)) return Response.json({ error: 'Invalid Shiur ID' }, { status: 400 });

  try {
    await coverStorage.deleteCover(fileId);
    return Response.json({ cover: null, fallback: true });
  } catch (error) {
    console.error('Unable to remove Shiur cover', error);
    return Response.json({ error: 'Unable to remove Shiur cover' }, { status: 500 });
  }
}
