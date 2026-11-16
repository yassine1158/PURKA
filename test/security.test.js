// Tests de sécurité : chaque rôle ne peut faire que ce que la matrice autorise,
// et le circuit ne peut pas être contourné. Lancer : npm test
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createApp, loadConfig } from '../src/app.js';
import { hashPassword } from '../src/auth.js';

const PW = 'MotDePasse-Test-2026';
let server, base, db, dir;

before(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'evia-test-'));
  const cfg = { ...loadConfig({}), dataDir: dir, loginRateMax: 1000 };
  const created = createApp(cfg);
  db = created.db;
  const { app } = created;
  const h = await hashPassword(PW);
  const ins = db.prepare('INSERT INTO users (username, name, role, pass_hash, must_change, active, created_at) VALUES (?, ?, ?, ?, 0, 1, ?)');
  for (const role of ['admin', 'comptable', 'controleur', 'bascule', 'magasinier']) ins.run(role, role.toUpperCase(), role, h, Date.now());
  ins.run('nouveau', 'Nouveau', 'bascule', h, Date.now());
  db.prepare("UPDATE users SET must_change = 1 WHERE username = 'nouveau'").run();
  await new Promise(r => { server = app.listen(0, '127.0.0.1', r); });
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => { server?.close(); db?.close(); fs.rmSync(dir, { recursive: true, force: true }); });

// Petit client HTTP avec cookie de session
function client() {
  let cookie = '';
  async function call(method, url, body, { csrf = true, headers = {} } = {}) {
    const h = { ...headers };
    if (csrf) h['x-evia-csrf'] = '1';
    if (cookie) h.cookie = cookie;
    let payload = body;
    if (body && !(body instanceof FormData)) { h['content-type'] = 'application/json'; payload = JSON.stringify(body); }
    const res = await fetch(base + url, { method, headers: h, body: payload });
    const sc = res.headers.get('set-cookie');
    if (sc) cookie = sc.split(';')[0].endsWith('=') ? '' : sc.split(';')[0];
    const ct = res.headers.get('content-type') || '';
    return { status: res.status, body: ct.includes('json') ? await res.json() : await res.arrayBuffer() };
  }
  return { call, get: u => call('GET', u), post: (u, b, o) => call('POST', u, b, o), put: (u, b) => call('PUT', u, b), patch: (u, b) => call('PATCH', u, b), del: u => call('DELETE', u) };
}
async function as(role) {
  const c = client();
  const r = await c.post('/api/auth/login', { username: role, password: PW });
  assert.equal(r.status, 200, `connexion ${role}`);
  return c;
}
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 0, 0, 0, 0, 0xff, 0xd9]);

test('sans session : tout est refusé', async () => {
  const c = client();
  for (const u of ['/api/receptions', '/api/achats', '/api/users', '/api/audit', '/api/me']) assert.equal((await c.get(u)).status, 401, u);
});

test('mauvais mot de passe refusé, message identique pour un identifiant inconnu', async () => {
  const c = client();
  const a = await c.post('/api/auth/login', { username: 'admin', password: 'faux-mot-de-passe' });
  const b = await c.post('/api/auth/login', { username: 'inconnu', password: 'faux-mot-de-passe' });
  assert.equal(a.status, 401); assert.equal(b.status, 401);
  assert.equal(a.body.error, b.body.error);
});

test('blocage du compte après 8 échecs', async () => {
  const h = await hashPassword(PW);
  db.prepare("INSERT INTO users (username, name, role, pass_hash, must_change, active, created_at) VALUES ('cible', 'Cible', 'bascule', ?, 0, 1, ?)").run(h, Date.now());
  const c = client();
  for (let i = 0; i < 8; i++) await c.post('/api/auth/login', { username: 'cible', password: 'mauvais-mdp-' + i });
  const r = await c.post('/api/auth/login', { username: 'cible', password: PW });
  assert.equal(r.status, 429, 'même le bon mot de passe est refusé pendant le blocage');
});

test('protection CSRF : écriture sans en-tête ou depuis une autre origine refusée', async () => {
  const c = await as('bascule');
  const body = { plate: '1 TU 1', fournisseur: 'F', matiere: 'M' };
  assert.equal((await c.post('/api/receptions', body, { csrf: false })).status, 403);
  assert.equal((await c.post('/api/receptions', body, { headers: { origin: 'https://pirate.example' } })).status, 403);
});

test('mot de passe provisoire : bloqué tant qu’il n’est pas changé', async () => {
  const c = await as('nouveau');
  assert.equal((await c.get('/api/receptions')).status, 403);
  assert.equal((await c.post('/api/me/password', { current: PW, next: 'court' })).status, 400);
  assert.equal((await c.post('/api/me/password', { current: PW, next: 'Bascule-Secret-2026!' })).status, 200);
  assert.equal((await c.get('/api/receptions')).status, 200);
});

test('contrôleur qualité : voit seulement la réception', async () => {
  const c = await as('controleur');
  const me = (await c.get('/api/me')).body;
  assert.deepEqual(me.perms.sort(), ['qc.decide', 'receptions.read']);
  assert.equal((await c.get('/api/receptions')).status, 200);
  assert.equal((await c.get('/api/achats')).status, 403, 'pas de prix ni de paiements');
  assert.equal((await c.get('/api/users')).status, 403);
  assert.equal((await c.get('/api/audit')).status, 403);
  assert.equal((await c.post('/api/receptions', { plate: '9 TU 9', fournisseur: 'F', matiere: 'M' })).status, 403);
  assert.equal((await c.put('/api/config', { matieres: ['X'] })).status, 403);
});

test('comptable : voit tout mais ne saisit pas le terrain', async () => {
  const c = await as('comptable');
  for (const u of ['/api/receptions', '/api/achats', '/api/audit']) assert.equal((await c.get(u)).status, 200, u);
  assert.equal((await c.get('/api/users')).status, 403);
  assert.equal((await c.post('/api/receptions', { plate: '9 TU 9', fournisseur: 'F', matiere: 'M' })).status, 403);
});

test('circuit complet + étapes réservées à chaque rôle', async () => {
  const bas = await as('bascule'), qc = await as('controleur'), mag = await as('magasinier'), cpt = await as('comptable');
  const rec = (await bas.post('/api/receptions', { plate: '245 tu 1234', fournisseur: 'Fournisseur A', matiere: 'SBR 1502', poidsBL: 18000 })).body;
  assert.equal(rec.status, 'attente_qc');
  assert.equal(rec.plate, '245 TU 1234');

  // Pesée impossible avant validation qualité
  const early = await bas.post(`/api/receptions/${rec.id}/pesee1`, { kg: 30000 });
  assert.equal(early.status, 409);
  // La bascule ne peut pas valider la qualité à la place du contrôleur
  assert.equal((await bas.post(`/api/receptions/${rec.id}/qc`, { decision: 'accepte' })).status, 403);

  // Photo : contrôle du contenu réel du fichier
  const fake = new FormData(); fake.append('photo', new Blob([Buffer.from('<script>alert(1)</script>')], { type: 'image/jpeg' }), 'x.jpg');
  assert.equal((await qc.post('/api/photos', fake)).status, 400);
  const fd = new FormData(); fd.append('photo', new Blob([JPEG], { type: 'image/jpeg' }), 'p.jpg');
  const ph = (await qc.post('/api/photos', fd)).body;
  assert.ok(ph.id);
  // Avant rattachement, la photo n'est visible que par son auteur
  assert.equal((await bas.get(`/api/photos/${ph.id}`)).status, 404);

  assert.equal((await qc.post(`/api/receptions/${rec.id}/qc`, { decision: 'reserve' })).status, 400, 'commentaire obligatoire pour une réserve');
  const ok = await qc.post(`/api/receptions/${rec.id}/qc`, { decision: 'accepte', photos: [ph.id], coa: true });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.status, 'attente_pesee1');
  assert.equal((await bas.get(`/api/photos/${ph.id}`)).status, 200, 'photo visible une fois rattachée');
  assert.equal((await qc.post(`/api/receptions/${rec.id}/qc`, { decision: 'accepte' })).status, 409, 'pas de double contrôle');

  assert.equal((await qc.post(`/api/receptions/${rec.id}/pesee1`, { kg: 30000 })).status, 403, 'le contrôleur ne pèse pas');
  assert.equal((await bas.post(`/api/receptions/${rec.id}/pesee1`, { kg: 200000 })).status, 400, 'au-delà de la portée de la bascule');
  assert.equal((await bas.post(`/api/receptions/${rec.id}/pesee1`, { kg: 32000, ticketBascule: 'T1' })).status, 200);
  assert.equal((await bas.post(`/api/receptions/${rec.id}/dechargement`, { zone: 'A' })).status, 403, 'la bascule ne valide pas le déchargement');
  assert.equal((await mag.post(`/api/receptions/${rec.id}/dechargement`, { zone: 'Zone A', qualite: 'conforme' })).status, 200);
  assert.equal((await bas.post(`/api/receptions/${rec.id}/pesee2`, { kg: 33000 })).status, 400, 'tare > brut refusée');
  const fin = await bas.post(`/api/receptions/${rec.id}/pesee2`, { kg: 14000 });
  assert.equal(fin.body.status, 'cloture');
  assert.equal(fin.body.net, 18000);

  // Achats : commande, rattachement, facture, paiement
  const cmd = (await cpt.post('/api/achats/commandes', { fournisseur: 'Fournisseur A', matiere: 'SBR 1502', qteKg: 40000, prix: 5200, unite: 't', devise: 'TND', tva: 19, conditions: '30 jours' })).body;
  assert.match(cmd.numero, /^BC-\d{4}-001$/);
  assert.equal((await cpt.post(`/api/achats/commandes/${cmd.id}/receptions`, { receptionId: rec.id })).status, 200);
  const f = await cpt.post(`/api/achats/commandes/${cmd.id}/factures`, { numero: 'FA-1', date: Date.now(), ht: 93600, tva: 19, timbre: true });
  assert.equal(f.body.factures[0].ttc, 111385);
  assert.equal((await cpt.post(`/api/achats/commandes/${cmd.id}/paiements`, { date: Date.now(), montant: 1000, mode: 'cheque' })).status, 400, 'n° de chèque obligatoire');
  const p = await cpt.post(`/api/achats/commandes/${cmd.id}/paiements`, { date: Date.now(), montant: 111385, mode: 'cheque', reference: '4471203', retenue: true });
  assert.equal(p.body.paiements[0].rs, 1670.775);
  assert.equal(p.body.paiements[0].statut, 'emis');

  // Le magasinier voit le stock mais pas les achats
  assert.equal((await mag.get('/api/achats')).status, 403);
  // Journal : chaque étape est tracée
  const log = (await cpt.get('/api/audit')).body.map(x => x.action);
  for (const a of ['reception.arrivee', 'reception.qc', 'reception.pesee_entree', 'reception.dechargement', 'reception.pesee_sortie', 'achats.commande', 'achats.paiement']) assert.ok(log.includes(a), a);
});

test('administrateur : gestion des utilisateurs, révocation immédiate', async () => {
  const adm = await as('admin');
  const u = (await adm.post('/api/users', { username: 'karim', name: 'Karim', role: 'controleur', password: 'Provisoire-2026!' })).body;
  assert.equal(u.mustChangePassword, true);
  assert.equal((await adm.post('/api/users', { username: 'k2', name: 'K', role: 'superuser', password: 'Provisoire-2026!' })).status, 400, 'rôle inconnu refusé');

  const k = client();
  await k.post('/api/auth/login', { username: 'karim', password: 'Provisoire-2026!' });
  await k.post('/api/me/password', { current: 'Provisoire-2026!', next: 'Qualite-Secret-2026' });
  assert.equal((await k.get('/api/receptions')).status, 200);
  // Désactivation : la session ouverte tombe tout de suite
  await adm.patch(`/api/users/${u.id}`, { active: false });
  assert.equal((await k.get('/api/receptions')).status, 401);

  // Impossible de retirer le dernier administrateur
  const me = (await adm.get('/api/me')).body;
  assert.equal((await adm.patch(`/api/users/${me.id}`, { role: 'comptable' })).status, 409);
});

test('les hash de mot de passe ne sortent jamais de l’API', async () => {
  const adm = await as('admin');
  const txt = JSON.stringify((await adm.get('/api/users')).body) + JSON.stringify((await adm.get('/api/me')).body);
  assert.ok(!txt.includes('scrypt$'));
  assert.ok(!txt.includes('pass_hash'));
});
