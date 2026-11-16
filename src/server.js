import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import { createApp, loadConfig } from './app.js';

const cfg = loadConfig();
const { app, db } = createApp(cfg);

if (!db.prepare('SELECT 1 FROM users LIMIT 1').get()) {
  console.warn('\n⚠  Aucun utilisateur. Créez le premier administrateur :  npm run create-admin\n');
}

const server = cfg.httpsKey && cfg.httpsCert
  ? https.createServer({ key: fs.readFileSync(cfg.httpsKey), cert: fs.readFileSync(cfg.httpsCert) }, app)
  : http.createServer(app);

server.listen(cfg.port, cfg.host, () => {
  console.log(`Évia Réception démarré sur ${cfg.httpsKey ? 'https' : 'http'}://${cfg.host === '0.0.0.0' ? 'localhost' : cfg.host}:${cfg.port}`);
  console.log(`Données : ${cfg.dataDir}`);
});

const stop = () => { server.close(() => { db.close(); process.exit(0); }); setTimeout(() => process.exit(0), 3000).unref(); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
