import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { can, permsOf, ROLES } from './permissions.js';
import { HttpError } from './validate.js';

const scrypt = promisify(crypto.scrypt);
const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const KEYLEN = 64;

export const COOKIE = 'evia_sid';
export const PASSWORD_MIN = 10;
const MAX_FAILED = 8;
const LOCK_MS = 15 * 60 * 1000;

export async function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(pw, salt, KEYLEN, SCRYPT);
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function verifyPassword(pw, stored) {
  const [alg, n, r, p, salt, key] = String(stored).split('$');
  if (alg !== 'scrypt') return false;
  const expected = Buffer.from(key, 'base64');
  const got = await scrypt(pw, Buffer.from(salt, 'base64'), expected.length, { N: +n, r: +r, p: +p, maxmem: SCRYPT.maxmem });
  return got.length === expected.length && crypto.timingSafeEqual(got, expected);
}

// Hash factice : un identifiant inconnu prend le même temps qu'un mauvais mot de passe.
let dummyHash;
const getDummy = async () => (dummyHash ??= await hashPassword(crypto.randomBytes(12).toString('hex')));

export function checkPasswordPolicy(pw, username) {
  if (typeof pw !== 'string' || pw.length < PASSWORD_MIN) throw new HttpError(400, `Le mot de passe doit contenir au moins ${PASSWORD_MIN} caractères.`);
  if (pw.length > 200) throw new HttpError(400, 'Mot de passe trop long.');
  if (username && pw.toLowerCase().includes(String(username).toLowerCase())) throw new HttpError(400, 'Le mot de passe ne doit pas contenir l’identifiant.');
  if (/^(.)\1+$/.test(pw) || /^(0123456789|1234567890|azertyuiop|qwertyuiop)/i.test(pw)) throw new HttpError(400, 'Mot de passe trop simple.');
}

const sha256 = s => crypto.createHash('sha256').update(s).digest('hex');

export function publicUser(u) {
  return {
    id: u.id, username: u.username, name: u.name, role: u.role,
    roleLabel: ROLES[u.role]?.label || u.role, active: !!u.active,
    mustChangePassword: !!u.must_change, perms: permsOf(u.role),
    createdAt: u.created_at, lastLogin: u.last_login,
  };
}

export function createAuth(db, cfg) {
  const idleMs = cfg.sessionIdleHours * 3600 * 1000;
  const absMs = cfg.sessionMaxDays * 86400 * 1000;

  function cookieOpts() {
    return `Path=/; HttpOnly; SameSite=Strict${cfg.cookieSecure ? '; Secure' : ''}`;
  }

  function setCookie(res, token) {
    res.setHeader('Set-Cookie', `${COOKIE}=${token}; ${cookieOpts()}; Max-Age=${Math.floor(absMs / 1000)}`);
  }
  function clearCookie(res) {
    res.setHeader('Set-Cookie', `${COOKIE}=; ${cookieOpts()}; Max-Age=0`);
  }
  function readToken(req) {
    const raw = req.headers.cookie || '';
    for (const part of raw.split(';')) {
      const [k, ...v] = part.trim().split('=');
      if (k === COOKIE) return v.join('=');
    }
    return null;
  }

  async function login(req, res, username, password) {
    const now = Date.now();
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(String(username || ''));
    if (!user) {
      await verifyPassword(String(password || ''), await getDummy());
      throw new HttpError(401, 'Identifiant ou mot de passe incorrect.');
    }
    if (user.locked_until > now) {
      const min = Math.ceil((user.locked_until - now) / 60000);
      throw new HttpError(429, `Compte bloqué après trop d’essais. Réessayez dans ${min} min.`);
    }
    const ok = await verifyPassword(String(password || ''), user.pass_hash);
    if (!ok) {
      const failed = user.failed + 1;
      const lock = failed >= MAX_FAILED ? now + LOCK_MS : 0;
      db.prepare('UPDATE users SET failed = ?, locked_until = ? WHERE id = ?').run(lock ? 0 : failed, lock, user.id);
      throw new HttpError(401, 'Identifiant ou mot de passe incorrect.');
    }
    if (!user.active) throw new HttpError(403, 'Ce compte est désactivé. Contactez l’administrateur.');
    db.prepare('UPDATE users SET failed = 0, locked_until = 0, last_login = ? WHERE id = ?').run(now, user.id);
    const token = crypto.randomBytes(32).toString('base64url');
    db.prepare('INSERT INTO sessions (token_hash, user_id, created_at, last_seen, ip, ua) VALUES (?, ?, ?, ?, ?, ?)')
      .run(sha256(token), user.id, now, now, req.ip || '', String(req.headers['user-agent'] || '').slice(0, 200));
    setCookie(res, token);
    return { ...user, last_login: now };
  }

  function logout(req, res) {
    const token = readToken(req);
    if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(token));
    clearCookie(res);
  }

  function revokeSessions(userId, exceptReq) {
    const keep = exceptReq ? readToken(exceptReq) : null;
    if (keep) db.prepare('DELETE FROM sessions WHERE user_id = ? AND token_hash <> ?').run(userId, sha256(keep));
    else db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
  }

  // Charge la session (si présente) et l'utilisateur dans req.user.
  function sessionMiddleware(req, res, next) {
    const token = readToken(req);
    if (!token) return next();
    const h = sha256(token);
    const s = db.prepare('SELECT * FROM sessions WHERE token_hash = ?').get(h);
    const now = Date.now();
    if (!s || now - s.last_seen > idleMs || now - s.created_at > absMs) {
      if (s) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(h);
      clearCookie(res);
      return next();
    }
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(s.user_id);
    if (!user || !user.active || !ROLES[user.role]) {
      db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(h);
      clearCookie(res);
      return next();
    }
    if (now - s.last_seen > 60000) db.prepare('UPDATE sessions SET last_seen = ? WHERE token_hash = ?').run(now, h);
    req.user = user;
    next();
  }

  function requireAuth(req, res, next) {
    if (!req.user) return next(new HttpError(401, 'Session expirée : reconnectez-vous.'));
    // Mot de passe provisoire : seules ces routes restent ouvertes tant qu'il n'est pas changé
    if (req.user.must_change && !['/api/me', '/api/me/password', '/api/auth/logout'].includes(req.originalUrl.split('?')[0])) {
      return next(new HttpError(403, 'Changez d’abord votre mot de passe provisoire.'));
    }
    next();
  }

  const requirePerm = (...perms) => (req, res, next) => {
    if (!req.user) return next(new HttpError(401, 'Session expirée : reconnectez-vous.'));
    if (!perms.every(p => can(req.user, p))) return next(new HttpError(403, 'Accès refusé : votre rôle ne permet pas cette action.'));
    next();
  };

  return { login, logout, revokeSessions, sessionMiddleware, requireAuth, requirePerm };
}

// Protection CSRF : en-tête personnalisé obligatoire (impossible à poser depuis un autre site
// sans pré-vol CORS, que le serveur refuse) + vérification de l'origine.
export function csrfGuard(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (req.headers['x-evia-csrf'] !== '1') return next(new HttpError(403, 'Requête refusée (protection CSRF).'));
  const origin = req.headers.origin;
  if (origin) {
    let host;
    try { host = new URL(origin).host; } catch { host = null; }
    if (!host || host !== req.headers.host) return next(new HttpError(403, 'Requête refusée (origine inconnue).'));
  }
  next();
}
