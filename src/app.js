import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb } from './db.js';
import { createAuth, csrfGuard, publicUser } from './auth.js';
import { createAudit } from './audit.js';
import { createHub } from './events.js';
import { HttpError } from './validate.js';
import { receptionsRouter } from './routes/receptions.js';
import { configRouter } from './routes/config.js';
import { photosRouter } from './routes/photos.js';
import { achatsRouter } from './routes/achats.js';
import { meRouter, usersRouter, auditRouter } from './routes/users.js';

const here = path.dirname(fileURLToPath(import.meta.url));

export function loadConfig(env = process.env) {
  return {
    port: parseInt(env.PORT, 10) || 3000,
    host: env.HOST || '0.0.0.0',
    dataDir: path.resolve(env.DATA_DIR || path.join(here, '..', 'data')),
    cookieSecure: env.COOKIE_SECURE ? env.COOKIE_SECURE === 'true' : !!(env.HTTPS_KEY && env.HTTPS_CERT),
    trustProxy: env.TRUST_PROXY || false,
    sessionIdleHours: Number(env.SESSION_IDLE_HOURS) || 12,
    sessionMaxDays: Number(env.SESSION_MAX_DAYS) || 7,
    loginRateMax: Number(env.LOGIN_RATE_MAX) || 20,
    httpsKey: env.HTTPS_KEY, httpsCert: env.HTTPS_CERT,
  };
}

export function createApp(cfg, db = openDb(path.join(cfg.dataDir, 'evia.db'))) {
  const app = express();
  const auth = createAuth(db, cfg);
  const audit = createAudit(db);
  const hub = createHub(db);
  const ctx = { db, auth, audit, hub, cfg };

  app.disable('x-powered-by');
  if (cfg.trustProxy) app.set('trust proxy', cfg.trustProxy === 'true' ? 1 : cfg.trustProxy);

  app.use(helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        'default-src': ["'self'"],
        'script-src': ["'self'"],
        'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        'font-src': ["'self'", 'https://fonts.gstatic.com'],
        'img-src': ["'self'", 'data:', 'blob:'],
        'connect-src': ["'self'"],
        'object-src': ["'none'"],
        'frame-ancestors': ["'none'"],
        'form-action': ["'self'"],
        'upgrade-insecure-requests': cfg.cookieSecure ? [] : null,
      },
    },
    strictTransportSecurity: cfg.cookieSecure ? { maxAge: 15552000 } : false,
    crossOriginEmbedderPolicy: false,
  }));
  app.use((req, res, next) => { res.setHeader('Permissions-Policy', 'camera=(self), geolocation=(), microphone=()'); next(); });

  app.use('/api', express.json({ limit: '200kb' }));
  app.use('/api', (req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
  app.use('/api', csrfGuard);
  app.use('/api', auth.sessionMiddleware);

  const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: cfg.loginRateMax, standardHeaders: 'draft-7', legacyHeaders: false,
    message: { error: 'Trop de tentatives de connexion. Réessayez dans 15 minutes.' } });

  app.post('/api/auth/login', loginLimiter, async (req, res) => {
    try {
      const user = await auth.login(req, res, req.body?.username, req.body?.password);
      req.user = user;
      audit(req, 'auth.login', user.username);
      res.json(publicUser(user));
    } catch (e) {
      audit(req, 'auth.login_failed', String(req.body?.username || '').slice(0, 40), e.message);
      throw e;
    }
  });
  app.post('/api/auth/logout', (req, res) => {
    if (req.user) audit(req, 'auth.logout', req.user.username);
    auth.logout(req, res);
    res.json({ ok: true });
  });

  // Tout ce qui suit exige une session valide
  app.use('/api', auth.requireAuth);
  app.get('/api/health', (req, res) => res.json({ ok: true }));
  app.use('/api/me', meRouter(ctx));
  app.get('/api/events', hub.handler);
  app.use('/api/config', configRouter(ctx));
  app.use('/api/receptions', receptionsRouter(ctx));
  app.use('/api/photos', photosRouter(ctx));
  app.use('/api/achats', achatsRouter(ctx));
  app.use('/api/users', usersRouter(ctx));
  app.use('/api/audit', auditRouter(ctx));
  app.use('/api', (req, res) => { throw new HttpError(404, 'Route inconnue.'); });

  const pub = path.join(here, '..', 'public');
  app.use(express.static(pub, { index: false, maxAge: '1h', setHeaders(res, p) { if (p.endsWith('sw.js') || p.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache'); } }));
  app.get(/^\/(?!api\/).*/, (req, res) => { res.setHeader('Cache-Control', 'no-cache'); res.sendFile(path.join(pub, 'index.html')); });

  // Erreurs : message clair pour l'utilisateur, aucun détail technique divulgué
  app.use((err, req, res, next) => {
    const status = err.status || (err.type === 'entity.parse.failed' ? 400 : err.type === 'entity.too.large' ? 413 : 500);
    if (status >= 500) console.error(err);
    res.status(status).json({ error: status >= 500 ? 'Erreur interne du serveur.' : status === 413 ? 'Requête trop volumineuse.' : err.message || 'Requête invalide.' });
  });

  return { app, db, hub };
}
