import { createHmac, timingSafeEqual } from 'node:crypto';

const sessionDurationSeconds = 8 * 60 * 60;
const cookieName = 'torat_tsion_admin';

type Session = { username: string; expiresAt: number };

function configuredValue(name: 'ADMIN_USERNAME' | 'ADMIN_PASSWORD' | 'ADMIN_SESSION_SECRET') {
  return process.env[name]?.trim() ?? '';
}

function sign(value: string) {
  return createHmac('sha256', configuredValue('ADMIN_SESSION_SECRET')).update(value).digest('base64url');
}

function encodeSession(session: Session) {
  const payload = Buffer.from(JSON.stringify(session)).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

function decodeSession(token: string): Session | null {
  const [payload, signature] = token.split('.');
  if (!payload || !signature || !configuredValue('ADMIN_SESSION_SECRET')) return null;
  const expected = sign(payload);
  const receivedBytes = Buffer.from(signature);
  const expectedBytes = Buffer.from(expected);
  if (receivedBytes.length !== expectedBytes.length || !timingSafeEqual(receivedBytes, expectedBytes)) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Session;
    return session.expiresAt > Math.floor(Date.now() / 1000) ? session : null;
  } catch {
    return null;
  }
}

function cookieValue(request: Request) {
  return request.headers.get('cookie')?.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
}

function bearerValue(request: Request) {
  const value = request.headers.get('authorization');
  return value?.startsWith('Bearer ') ? value.slice(7) : undefined;
}

export function authenticateAdmin(username: string, password: string) {
  const expectedUsername = configuredValue('ADMIN_USERNAME');
  const expectedPassword = configuredValue('ADMIN_PASSWORD');
  if (!expectedUsername || !expectedPassword || !configuredValue('ADMIN_SESSION_SECRET')) return null;
  if (username !== expectedUsername || password !== expectedPassword) return null;
  return encodeSession({ username: expectedUsername, expiresAt: Math.floor(Date.now() / 1000) + sessionDurationSeconds });
}

export function isAdmin(request: Request) {
  const token = cookieValue(request) ?? bearerValue(request);
  return token ? decodeSession(token) : null;
}

export function adminCookie(token: string) {
  return `${cookieName}=${token}; Path=/; Max-Age=${sessionDurationSeconds}; HttpOnly; SameSite=Lax${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;
}

export function clearAdminCookie() {
  return `${cookieName}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;
}

export function unauthorizedResponse() {
  return Response.json({ error: 'Admin authentication required' }, { status: 401 });
}

export function serverAuthUnavailableResponse() {
  return Response.json({ error: 'Admin authentication is not configured on the server' }, { status: 503 });
}

export function requireAdmin(request: Request) {
  return isAdmin(request) ? null : unauthorizedResponse();
}

export { cookieName, sessionDurationSeconds };
