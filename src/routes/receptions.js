import express from 'express';
import crypto from 'node:crypto';
import { tx, getSetting, setSetting } from '../db.js';
import { stamp } from '../audit.js';
import { HttpError, bad, str, text, num, oneOf, bool, id } from '../validate.js';
import { CONFIG_DEFAULT } from './config.js';

// Circuit : arrivée → contrôle qualité → pesée entrée → déchargement → pesée sortie → stock
export const ACTIVE = ['attente_qc', 'attente_pesee1', 'dechargement', 'attente_pesee2'];
const MAX_KG = 100000; // portée max de la bascule
const newId = () => crypto.randomBytes(10).toString('hex');

export function receptionsRouter({ db, auth, audit, hub }) {
  const r = express.Router();
  const { requirePerm } = auth;
  const getRow = db.prepare('SELECT * FROM receptions WHERE id = ?');
  const save = db.prepare('UPDATE receptions SET status = ?, updated_at = ?, doc = ? WHERE id = ?');

  // Applique une étape seulement si la réception est encore au statut attendu (évite les doubles saisies).
  function step(recId, from, mutate) {
    id(recId, 'Réception');
    return tx(db, () => {
      const row = getRow.get(recId);
      if (!row) throw new HttpError(404, 'Réception introuvable.');
      const allowed = Array.isArray(from) ? from : [from];
      if (!allowed.includes(row.status)) throw new HttpError(409, 'Cette étape a déjà été faite par un autre poste. La page va se mettre à jour.');
      const doc = JSON.parse(row.doc);
      mutate(doc);
      const now = Date.now();
      save.run(doc.status, now, JSON.stringify(doc), recId);
      return doc;
    });
  }

  r.get('/', requirePerm('receptions.read'), (req, res) => {
    const rows = db.prepare('SELECT doc FROM receptions ORDER BY created_at DESC LIMIT 3000').all();
    res.json(rows.map(x => JSON.parse(x.doc)));
  });

  r.post('/', requirePerm('receptions.create'), (req, res) => {
    const b = req.body || {};
    const plate = str(b.plate, { name: 'Matricule', max: 24, req: true }).toUpperCase().replace(/\s+/g, ' ');
    const data = {
      plate,
      chauffeur: str(b.chauffeur, { name: 'Chauffeur', max: 80 }),
      tel: str(b.tel, { name: 'Téléphone', max: 30, pattern: /^[0-9+ ().-]*$/ }),
      fournisseur: str(b.fournisseur, { name: 'Fournisseur', max: 120, req: true }),
      matiere: str(b.matiere, { name: 'Matière', max: 120, req: true }),
      bl: str(b.bl, { name: 'N° BL', max: 60 }),
      poidsBL: num(b.poidsBL, { name: 'Poids BL', min: 1, max: MAX_KG }),
    };
    const doc = tx(db, () => {
      const norm = plate.replace(/\s/g, '');
      const active = db.prepare(`SELECT doc FROM receptions WHERE status IN (${ACTIVE.map(() => '?').join(',')})`).all(...ACTIVE).map(x => JSON.parse(x.doc));
      const dup = active.find(x => x.plate.replace(/\s/g, '') === norm);
      if (dup) throw new HttpError(409, `Ce camion est déjà sur site (${dup.ticket}). Terminez ou annulez sa réception d’abord.`);
      const d = new Date();
      const pre = 'R' + String(d.getFullYear()).slice(2) + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0') + '-';
      const last = db.prepare('SELECT ticket FROM receptions WHERE ticket LIKE ? ORDER BY ticket DESC LIMIT 1').get(pre + '%');
      const ticket = pre + String((last ? parseInt(last.ticket.slice(pre.length), 10) : 0) + 1).padStart(3, '0');
      const now = Date.now();
      const doc = { id: newId(), ticket, createdAt: now, status: 'attente_qc', ...data, arrivee: stamp(req) };
      db.prepare('INSERT INTO receptions (id, ticket, status, created_at, updated_at, doc) VALUES (?, ?, ?, ?, ?, ?)').run(doc.id, ticket, doc.status, now, now, JSON.stringify(doc));
      // Le fournisseur saisi rejoint la liste proposée
      const cfg = getSetting(db, 'config', CONFIG_DEFAULT);
      if (!cfg.fournisseurs.some(f => f.toLowerCase() === data.fournisseur.toLowerCase()) && cfg.fournisseurs.length < 500) {
        cfg.fournisseurs = [...cfg.fournisseurs, data.fournisseur].sort((a, b) => a.localeCompare(b, 'fr'));
        setSetting(db, 'config', cfg);
      }
      return doc;
    });
    audit(req, 'reception.arrivee', doc.ticket, `${plate} · ${data.fournisseur} · ${data.matiere}`);
    hub.emit('receptions'); hub.emit('config');
    res.status(201).json(doc);
  });

  r.post('/:id/qc', requirePerm('qc.decide'), (req, res) => {
    const b = req.body || {};
    const decision = oneOf(b.decision, ['accepte', 'reserve', 'refuse'], { name: 'Décision' });
    const commentaire = text(b.commentaire, { name: 'Commentaire', max: 1000, req: decision !== 'accepte' });
    const photos = Array.isArray(b.photos) ? b.photos : [];
    if (photos.length > 12) throw bad('12 photos maximum.');
    photos.forEach(p => id(p, 'Photo'));
    const resultats = (Array.isArray(b.resultats) ? b.resultats : []).slice(0, 30).map(x => ({
      test: str(x?.test, { name: 'Test', max: 120, req: true }), valeur: str(x?.valeur, { name: 'Résultat', max: 60, req: true }),
    }));
    const qc = { ...stamp(req), decision, photos, echantillon: str(b.echantillon, { name: 'N° échantillon', max: 60 }), coa: bool(b.coa), resultats, commentaire };
    const doc = step(req.params.id, 'attente_qc', d => {
      // Les photos doivent avoir été envoyées par ce contrôleur et ne pas appartenir à une autre réception
      for (const p of photos) {
        const ph = db.prepare('SELECT owner, reception_id FROM photos WHERE id = ?').get(p);
        if (!ph || ph.owner !== req.user.id || (ph.reception_id && ph.reception_id !== d.id)) throw bad('Photo invalide : renvoyez-la.');
        db.prepare('UPDATE photos SET reception_id = ? WHERE id = ?').run(d.id, p);
      }
      d.qc = qc;
      d.status = decision === 'refuse' ? 'refuse_qc' : 'attente_pesee1';
    });
    audit(req, 'reception.qc', doc.ticket, `${decision}${commentaire ? ' · ' + commentaire : ''}`);
    hub.emit('receptions');
    res.json(doc);
  });

  r.post('/:id/pesee1', requirePerm('pesee.write'), (req, res) => {
    const kg = num(req.body?.kg, { name: 'Poids brut', min: 1, max: MAX_KG, req: true });
    const ticketBascule = str(req.body?.ticketBascule, { name: 'N° ticket bascule', max: 40 });
    const row = getRow.get(id(req.params.id, 'Réception'));
    if (row?.status === 'attente_qc') throw new HttpError(409, 'Pesée bloquée : le contrôle qualité n’a pas encore validé ce camion.');
    const doc = step(req.params.id, 'attente_pesee1', d => { d.pesee1 = { ...stamp(req), kg, ticketBascule }; d.status = 'dechargement'; });
    audit(req, 'reception.pesee_entree', doc.ticket, `${kg} kg`);
    hub.emit('receptions');
    res.json(doc);
  });

  r.post('/:id/dechargement', requirePerm('dechargement.write'), (req, res) => {
    const b = req.body || {};
    const dech = {
      zone: str(b.zone, { name: 'Zone', max: 120, req: true }),
      colis: str(b.colis, { name: 'Balles / colis', max: 20 }),
      lot: str(b.lot, { name: 'N° lot', max: 60 }),
      qualite: oneOf(b.qualite, ['conforme', 'reserve', 'non_conforme'], { name: 'Contrôle visuel', req: false, def: 'conforme' }),
      remarque: text(b.remarque, { name: 'Remarque', max: 1000 }),
    };
    const doc = step(req.params.id, 'dechargement', d => { d.dechargement = { ...stamp(req), ...dech }; d.status = 'attente_pesee2'; });
    audit(req, 'reception.dechargement', doc.ticket, dech.zone);
    hub.emit('receptions');
    res.json(doc);
  });

  r.post('/:id/pesee2', requirePerm('pesee.write'), (req, res) => {
    const kg = num(req.body?.kg, { name: 'Tare', min: 1, max: MAX_KG, req: true });
    const ticketBascule = str(req.body?.ticketBascule, { name: 'N° ticket bascule', max: 40 });
    const doc = step(req.params.id, 'attente_pesee2', d => {
      if (kg >= d.pesee1.kg) throw bad(`La tare doit être inférieure au brut (${d.pesee1.kg} kg).`);
      d.pesee2 = { ...stamp(req), kg, ticketBascule };
      d.net = d.pesee1.kg - kg;
      d.status = 'cloture';
    });
    audit(req, 'reception.pesee_sortie', doc.ticket, `tare ${kg} kg · net ${doc.net} kg`);
    hub.emit('receptions'); hub.emit('achats');
    res.json(doc);
  });

  r.post('/:id/annuler', requirePerm('receptions.cancel'), (req, res) => {
    const motif = str(req.body?.motif, { name: 'Motif', max: 300, req: true });
    const doc = step(req.params.id, ACTIVE, d => { d.annulation = { ...stamp(req), motif }; d.status = 'annule'; });
    audit(req, 'reception.annulation', doc.ticket, motif);
    hub.emit('receptions');
    res.json(doc);
  });

  return r;
}
