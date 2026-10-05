import { Readable } from 'node:stream';

import { getRecordingFile, recordingContentType, streamRecordingFile } from '@/lib/server/google-drive';

type RouteContext = {
  params: { id: string };
};

export async function GET(request: Request, context?: RouteContext) {
  const pathId = new URL(request.url).pathname.split('/').filter(Boolean).pop();
  const fileId = context?.params?.id ?? pathId;

  if (!fileId || !/^[A-Za-z0-9_-]+$/.test(fileId)) {
    return Response.json({ error: 'Invalid recording ID' }, { status: 400 });
  }

  try {
    const requestedRange = request.headers.get('range');
    const file = await getRecordingFile(fileId);
    const contentType = recordingContentType(file);
    if (!contentType) {
      return Response.json({ error: 'Unable to stream recording' }, { status: 404 });
    }
    const response = await streamRecordingFile(fileId, requestedRange ?? undefined);
    const body = Readable.toWeb(response.data as Readable) as ReadableStream<Uint8Array>;
    const contentLength = response.headers['content-length'];
    const headers = new Headers({
      'Accept-Ranges': response.headers['accept-ranges'] ?? 'bytes',
      'Cache-Control': 'private, max-age=300',
      'Content-Disposition': 'inline',
      'Content-Type': contentType,
    });

    if (contentLength) {
      headers.set('Content-Length', String(contentLength));
    }

    if (response.headers['content-range']) headers.set('Content-Range', response.headers['content-range']);

    return new Response(body, { status: response.status === 206 ? 206 : 200, headers });
  } catch (error) {
    console.error('Unable to stream Drive recording', error);
    const status = (error as { response?: { status?: number } })?.response?.status;
    return Response.json({ error: 'Unable to stream recording' }, { status: status === 416 ? 416 : 404 });
  }
}