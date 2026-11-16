// Sauvegarde à chaud de la base (cohérente même serveur démarré) + copie des photos.
// Usage : npm run backup            → data/backups/evia-AAAAMMJJ-HHMM/
// À planifier chaque jour (Planificateur de tâches Windows ou cron). Copiez ensuite le dossier hors du PC.
import fs from 'node:fs';
import path from 'node:path';
import { openDb } from '../src/db.js';
import { loadConfig } from '../src/app.js';

const cfg = loadConfig();
const d = new Date();
const stampStr = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`;
const out = path.join(process.env.BACKUP_DIR || path.join(cfg.dataDir, 'backups'), `evia-${stampStr}`);
fs.mkdirSync(out, { recursive: true });

const db = openDb(path.join(cfg.dataDir, 'evia.db'));
const target = path.join(out, 'evia.db').replace(/'/g, "''");
db.exec(`VACUUM INTO '${target}'`);
db.close();

const up = path.join(cfg.dataDir, 'uploads');
if (fs.existsSync(up)) fs.cpSync(up, path.join(out, 'uploads'), { recursive: true });

// Garde les 30 dernières sauvegardes
const root = path.dirname(out);
const all = fs.readdirSync(root).filter(n => n.startsWith('evia-')).sort();
for (const old of all.slice(0, Math.max(0, all.length - 30))) fs.rmSync(path.join(root, old), { recursive: true, force: true });

console.log(`Sauvegarde créée : ${out}`);
