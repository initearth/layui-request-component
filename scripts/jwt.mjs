import { createHmac } from 'node:crypto';

export const JWT_SECRET = 'layui-request-demo-secret';
export const ACCESS_TTL = 120;
export const REFRESH_TTL = 3600;

export function base64url(input) {
  return Buffer.from(input).toString('base64url');
}

export function signJWT(payload, expiresIn, secret = JWT_SECRET) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'HS256', typ: 'JWT' };
  const body = Object.assign({}, payload, { iat: now, exp: now + expiresIn });
  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(body));
  const signature = createHmac('sha256', secret)
    .update(encodedHeader + '.' + encodedPayload)
    .digest('base64url');
  return encodedHeader + '.' + encodedPayload + '.' + signature;
}

export function verifyJWT(token, secret = JWT_SECRET) {
  if (!token) return { valid: false, reason: 'missing' };

  const parts = token.split('.');
  if (parts.length !== 3) return { valid: false, reason: 'malformed' };

  const expected = createHmac('sha256', secret)
    .update(parts[0] + '.' + parts[1])
    .digest('base64url');
  if (parts[2] !== expected) return { valid: false, reason: 'invalid_signature' };

  let payload;
  try {
    payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  } catch (e) {
    return { valid: false, reason: 'invalid_payload' };
  }

  if (payload.exp && Math.floor(Date.now() / 1000) >= payload.exp) {
    return { valid: false, reason: 'expired', payload: payload };
  }

  return { valid: true, payload: payload };
}

export function bearerOf(header) {
  const match = /^Bearer\s+(.+)$/i.exec(header || '');
  return match ? match[1] : null;
}
