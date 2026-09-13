import { createHmac, timingSafeEqual } from 'node:crypto';

export const ADMIN_SESSION_COOKIE = 'clan_admin_session';
export const ADMIN_SESSION_TTL_SECONDS = 60 * 60 * 8;

function encode(value) {
  return Buffer.from(value).toString('base64url');
}

function decode(value) {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function sign(value, secret) {
  return createHmac('sha256', secret).update(value).digest('base64url');
}

export function createSessionToken(
  username,
  secret,
  nowSeconds = Math.floor(Date.now() / 1000),
) {
  const payload = encode(
    JSON.stringify({ username, expiresAt: nowSeconds + ADMIN_SESSION_TTL_SECONDS }),
  );
  return `${payload}.${sign(payload, secret)}`;
}

export function verifySessionToken(
  token,
  secret,
  nowSeconds = Math.floor(Date.now() / 1000),
) {
  if (!token || !secret) return null;
  const [payload, signature, ...extra] = token.split('.');
  if (!payload || !signature || extra.length > 0) return null;

  const expectedSignature = sign(payload, secret);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const value = JSON.parse(decode(payload));
    if (
      !value ||
      typeof value.username !== 'string' ||
      !Number.isInteger(value.expiresAt) ||
      value.expiresAt <= nowSeconds
    ) {
      return null;
    }
    return value.username;
  } catch {
    return null;
  }
}

export function parseCookies(header = '') {
  return Object.fromEntries(
    header
      .split(';')
      .map((part) => part.trim().split('='))
      .filter(([name, value]) => name && value)
      .map(([name, ...value]) => [name, decodeURIComponent(value.join('='))]),
  );
}

export function getCookie(cookies, name) {
  return cookies[name] ?? null;
}

export function getAdminConfig(env = process.env) {
  const username = env.ADMIN_USERNAME?.trim();
  const password = env.ADMIN_PASSWORD;
  const sessionSecret = env.ADMIN_SESSION_SECRET?.trim() || password?.trim();
  if (!username || !password || !sessionSecret) return null;
  return { username, password, sessionSecret };
}

export function credentialsMatch(username, password, config) {
  if (!config || typeof username !== 'string' || typeof password !== 'string')
    return false;
  return username === config.username && password === config.password;
}
