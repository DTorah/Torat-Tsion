import { adminCookie, authenticateAdmin, serverAuthUnavailableResponse } from '@/lib/server/admin-auth';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { username?: string; password?: string };
    if (typeof body.username !== 'string' || typeof body.password !== 'string') {
      return Response.json({ error: 'Username and password are required' }, { status: 400 });
    }
    const token = authenticateAdmin(body.username, body.password);
    if (!process.env.ADMIN_USERNAME || !process.env.ADMIN_PASSWORD || !process.env.ADMIN_SESSION_SECRET) {
      return serverAuthUnavailableResponse();
    }
    if (!token) return Response.json({ error: 'Invalid admin credentials' }, { status: 401 });
    return Response.json({ authenticated: true, sessionToken: token }, { headers: { 'Set-Cookie': adminCookie(token) } });
  } catch {
    return Response.json({ error: 'Invalid login request' }, { status: 400 });
  }
}
