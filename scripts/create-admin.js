// Crée (ou réinitialise) un compte administrateur depuis la console du serveur.
// Usage : npm run create-admin
import readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import path from 'node:path';
import { openDb } from '../src/db.js';
import { loadConfig } from '../src/app.js';
import { hashPassword, checkPasswordPolicy, PASSWORD_MIN } from '../src/auth.js';

const cfg = loadConfig();
const db = openDb(path.join(cfg.dataDir, 'evia.db'));
const rl = readline.createInterface({ input: stdin, output: stdout });

try {
  const username = (await rl.question('Identifiant administrateur (ex. yassine) : ')).trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,32}$/.test(username)) throw new Error('Identifiant invalide : 3 à 32 caractères, lettres, chiffres, . _ -');
  const name = (await rl.question('Nom affiché : ')).trim() || username;
  const password = (await rl.question(`Mot de passe (${PASSWORD_MIN} caractères minimum) : `)).trim();
  checkPasswordPolicy(password, username);
  const hash = await hashPassword(password);
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) {
    db.prepare("UPDATE users SET name = ?, role = 'admin', pass_hash = ?, must_change = 0, active = 1, failed = 0, locked_until = 0 WHERE id = ?").run(name, hash, existing.id);
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(existing.id);
    console.log(`Compte « ${username} » réinitialisé en administrateur.`);
  } else {
    db.prepare("INSERT INTO users (username, name, role, pass_hash, must_change, active, created_at) VALUES (?, ?, 'admin', ?, 0, 1, ?)").run(username, name, hash, Date.now());
    console.log(`Administrateur « ${username} » créé. Connectez-vous puis créez les comptes de l’équipe dans Paramètres → Utilisateurs.`);
  }
  db.prepare("INSERT INTO audit (at, username, action, target, detail) VALUES (?, 'console', 'user.create_admin', ?, '')").run(Date.now(), username);
} catch (e) {
  console.error('Erreur :', e.message);
  process.exitCode = 1;
} finally {
  rl.close();
  db.close();
}
