import { coverStorage } from '@/lib/server/covers';

export async function GET() {
  try {
    return Response.json(await coverStorage.listAssignments());
  } catch (error) {
    console.error('Unable to load Shiur covers', error);
    return Response.json({ error: 'Unable to load Shiur covers' }, { status: 500 });
  }
}
