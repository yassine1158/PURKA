import express from 'express';
import { hashPassword, verifyPassword, checkPasswordPolicy, publicUser } from '../auth.js';
import { ROLES, PERMS } from '../permissions.js';
import { HttpError, bad, str, oneOf, num } from '../validate.js';

const USERNAME_RE = /^[a-z0-9._-]{3,32}$/i;

export function meRouter({ db, auth, audit }) {
  const r = express.Router();
  r.get('/', (req, res) => res.json(publicUser(req.user)));
  r.post('/password', async (req, res) => {
    const { current, next } = req.body || {};
    if (!(await verifyPassword(String(current || ''), req.user.pass_hash))) throw new HttpError(400, 'Mot de passe actuel incorrect.');
    checkPasswordPolicy(next, req.user.username);
    if (next === current) throw bad('Choisissez un mot de passe différent de l’actuel.');
    db.prepare('UPDATE users SET pass_hash = ?, must_change = 0 WHERE id = ?').run(await hashPassword(next), req.user.id);
    auth.revokeSessions(req.user.id, req); // déconnecte les autres appareils
    audit(req, 'user.password_change', req.user.username);
    res.json(publicUser({ ...req.user, must_change: 0 }));
  });
  return r;
}

export function usersRouter({ db, auth, audit, hub }) {
  const r = express.Router();
  r.use(auth.requirePerm('users.manage'));
  const all = () => db.prepare('SELECT * FROM users ORDER BY active DESC, name COLLATE NOCASE').all().map(publicUser);
  const activeAdmins = () => db.prepare("SELECT COUNT(*) n FROM users WHERE role = 'admin' AND active = 1").get().n;

  r.get('/', (req, res) => res.json({
    users: all(),
    roles: Object.entries(ROLES).map(([k, v]) => ({ key: k, label: v.label, description: v.description, perms: v.perms })),
    perms: PERMS,
  }));

  r.post('/', async (req, res) => {
    const b = req.body || {};
    const username = str(b.username, { name: 'Identifiant', max: 32, req: true, pattern: USERNAME_RE }).toLowerCase();
    const name = str(b.name, { name: 'Nom', max: 80, req: true });
    const role = oneOf(b.role, Object.keys(ROLES), { name: 'Rôle' });
    checkPasswordPolicy(b.password, username);
    if (db.prepare('SELECT 1 FROM users WHERE username = ?').get(username)) throw new HttpError(409, 'Cet identifiant existe déjà.');
    const info = db.prepare('INSERT INTO users (username, name, role, pass_hash, must_change, active, created_at) VALUES (?, ?, ?, ?, 1, 1, ?)')
      .run(username, name, role, await hashPassword(b.password), Date.now());
    audit(req, 'user.create', username, role);
    hub.emit('users');
    res.status(201).json(publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid)));
  });

  r.patch('/:id', async (req, res) => {
    const uid = num(req.params.id, { name: 'Utilisateur', min: 1, req: true });
    const u = db.prepare('SELECT * FROM users WHERE id = ?').get(uid);
    if (!u) throw new HttpError(404, 'Utilisateur introuvable.');
    const b = req.body || {};
    const changes = [];
    let { name, role, active } = u;
    if (b.name !== undefined) { name = str(b.name, { name: 'Nom', max: 80, req: true }); changes.push('nom'); }
    if (b.role !== undefined) { role = oneOf(b.role, Object.keys(ROLES), { name: 'Rôle' }); if (role !== u.role) changes.push(`rôle ${u.role} → ${role}`); }
    if (b.active !== undefined) { active = b.active ? 1 : 0; if (active !== u.active) changes.push(active ? 'réactivé' : 'désactivé'); }
    // On ne peut pas retirer le dernier administrateur actif
    if (u.role === 'admin' && u.active && (role !== 'admin' || !active) && activeAdmins() <= 1) throw new HttpError(409, 'Impossible : c’est le dernier administrateur actif.');
    db.prepare('UPDATE users SET name = ?, role = ?, active = ? WHERE id = ?').run(name, role, active, uid);
    if (b.password !== undefined) {
      checkPasswordPolicy(b.password, u.username);
      db.prepare('UPDATE users SET pass_hash = ?, must_change = 1, failed = 0, locked_until = 0 WHERE id = ?').run(await hashPassword(b.password), uid);
      changes.push('mot de passe réinitialisé');
    }
    // Tout changement de rôle, désactivation ou nouveau mot de passe ferme ses sessions ouvertes
    if (role !== u.role || active !== u.active || b.password !== undefined) { auth.revokeSessions(uid); hub.kick(uid); }
    audit(req, 'user.update', u.username, changes.join(', ') || 'aucun changement');
    hub.emit('users');
    res.json(publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(uid)));
  });

  return r;
}

export function auditRouter({ db, auth }) {
  const r = express.Router();
  r.get('/', auth.requirePerm('audit.read'), (req, res) => {
    const limit = Math.min(1000, Math.max(1, parseInt(req.query.limit, 10) || 300));
    res.json(db.prepare('SELECT at, username, action, target, detail, ip FROM audit ORDER BY id DESC LIMIT ?').all(limit));
  });
  return r;
}
