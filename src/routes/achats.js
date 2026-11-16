import express from 'express';
import crypto from 'node:crypto';
import { tx, getSetting, setSetting } from '../db.js';
import { stamp } from '../audit.js';
import { HttpError, bad, str, text, num, oneOf, date, bool, strList, id } from '../validate.js';

// Achats : bon de commande → réceptions rattachées → factures → paiements.
// Toutes les routes exigent achats.read ou achats.write : les prix ne sortent jamais vers les autres rôles.

export const DEVISES = ['TND', 'EUR', 'USD'];
export const TVAS = [19, 13, 7, 0];
export const CONDS = ['Comptant', 'À la livraison', '30 jours', '60 jours', '90 jours', '30 jours fin de mois', '60 jours fin de mois', 'Crédit documentaire (LC)', 'Remise documentaire'];
export const MODES = ['virement', 'cheque', 'traite', 'lc', 'especes', 'autre'];
const AVEC_ECH = ['cheque', 'traite', 'lc'];
const ACHATS_CFG_DEFAULT = { banques: [], rsTaux: 1.5, rsSeuil: 1000 };
const r3 = n => Math.round(n * 1000) / 1000;
const newId = (n = 10) => crypto.randomBytes(n).toString('hex');

export function achatsRouter({ db, auth, audit, hub }) {
  const r = express.Router();
  const { requirePerm } = auth;
  const RW = requirePerm('achats.write');
  const getRow = db.prepare('SELECT * FROM commandes WHERE id = ?');
  const save = db.prepare('UPDATE commandes SET statut = ?, updated_at = ?, doc = ? WHERE id = ?');

  function mutate(cmdId, fn) {
    id(cmdId, 'Commande');
    return tx(db, () => {
      const row = getRow.get(cmdId);
      if (!row) throw new HttpError(404, 'Commande introuvable.');
      const c = JSON.parse(row.doc);
      fn(c);
      save.run(c.statut, Date.now(), JSON.stringify(c), cmdId);
      return c;
    });
  }
  const editable = c => { if (c.statut === 'annulee') throw new HttpError(409, 'Commande annulée : modification impossible.'); };
  const done = (req, res, c, action, detail) => { audit(req, action, c.numero, detail); hub.emit('achats'); res.json(c); };

  r.use(requirePerm('achats.read'));

  r.get('/', (req, res) => {
    res.json({
      commandes: db.prepare('SELECT doc FROM commandes ORDER BY created_at DESC LIMIT 3000').all().map(x => JSON.parse(x.doc)),
      config: getSetting(db, 'achats_config', ACHATS_CFG_DEFAULT),
    });
  });

  r.put('/config', RW, (req, res) => {
    const b = req.body || {};
    const cur = getSetting(db, 'achats_config', ACHATS_CFG_DEFAULT);
    const next = {
      banques: b.banques !== undefined ? strList(b.banques, { name: 'Banques', max: 50, itemMax: 80 }) : cur.banques,
      rsTaux: b.rsTaux !== undefined ? num(b.rsTaux, { name: 'Taux de retenue', min: 0, max: 25, req: true }) : cur.rsTaux,
      rsSeuil: b.rsSeuil !== undefined ? num(b.rsSeuil, { name: 'Seuil de retenue', min: 0, max: 1e9, req: true }) : cur.rsSeuil,
    };
    setSetting(db, 'achats_config', next);
    audit(req, 'achats.config', '', Object.keys(b).join(', '));
    hub.emit('achats');
    res.json(next);
  });

  r.post('/commandes', RW, (req, res) => {
    const b = req.body || {};
    const devise = oneOf(b.devise, DEVISES, { name: 'Devise', req: false, def: 'TND' });
    const c0 = {
      date: date(b.date, { name: 'Date de commande' }) || Date.now(),
      fournisseur: str(b.fournisseur, { name: 'Fournisseur', max: 120, req: true }),
      matiere: str(b.matiere, { name: 'Matière', max: 120, req: true }),
      qteKg: num(b.qteKg, { name: 'Quantité', min: 1, max: 1e8, req: true }),
      prix: num(b.prix, { name: 'Prix unitaire', min: 0.0001, max: 1e9, req: true }),
      unite: oneOf(b.unite, ['t', 'kg'], { name: 'Unité de prix', req: false, def: 't' }),
      devise,
      taux: devise === 'TND' ? null : num(b.taux, { name: 'Taux de change', min: 0.0001, max: 1000, req: true }),
      tva: oneOf(Number(b.tva), TVAS, { name: 'TVA' }),
      conditions: oneOf(b.conditions, CONDS, { name: 'Conditions de paiement', req: false, def: 'Comptant' }),
      livraisonPrevue: date(b.livraisonPrevue, { name: 'Livraison prévue' }),
      refFournisseur: str(b.refFournisseur, { name: 'Réf. fournisseur', max: 80 }),
      notes: text(b.notes, { name: 'Notes', max: 1000 }),
    };
    const c = tx(db, () => {
      const y = new Date().getFullYear(), pre = `BC-${y}-`;
      const last = db.prepare('SELECT numero FROM commandes WHERE numero LIKE ? ORDER BY numero DESC LIMIT 1').get(pre + '%');
      const numero = pre + String((last ? parseInt(last.numero.slice(pre.length), 10) : 0) + 1).padStart(3, '0');
      const now = Date.now();
      const c = { id: newId(), numero, createdAt: now, createdBy: req.user.id, createdByName: req.user.name, ...c0, statut: 'ouverte', receptions: [], factures: [], paiements: [] };
      db.prepare('INSERT INTO commandes (id, numero, statut, created_at, updated_at, doc) VALUES (?, ?, ?, ?, ?, ?)').run(c.id, numero, c.statut, now, now, JSON.stringify(c));
      return c;
    });
    audit(req, 'achats.commande', c.numero, `${c.fournisseur} · ${c.matiere} · ${c.qteKg} kg`);
    hub.emit('achats');
    res.status(201).json(c);
  });

  r.post('/commandes/:id/receptions', RW, (req, res) => {
    const recId = id(req.body?.receptionId, 'Réception');
    const c = mutate(req.params.id, c => {
      editable(c);
      const rec = db.prepare('SELECT status FROM receptions WHERE id = ?').get(recId);
      if (!rec) throw new HttpError(404, 'Réception introuvable.');
      if (rec.status !== 'cloture') throw bad('Seule une réception terminée (pesée sortie faite) peut être rattachée.');
      const others = db.prepare("SELECT doc FROM commandes WHERE id <> ? AND statut <> 'annulee'").all(c.id).map(x => JSON.parse(x.doc));
      const taken = others.find(o => (o.receptions || []).includes(recId));
      if (taken) throw new HttpError(409, `Réception déjà rattachée à ${taken.numero}.`);
      if (!c.receptions.includes(recId)) c.receptions.push(recId);
    });
    done(req, res, c, 'achats.rattachement', recId);
  });

  r.delete('/commandes/:id/receptions/:rid', RW, (req, res) => {
    const c = mutate(req.params.id, c => { editable(c); c.receptions = c.receptions.filter(x => x !== req.params.rid); });
    done(req, res, c, 'achats.detachement', req.params.rid);
  });

  r.post('/commandes/:id/factures', RW, (req, res) => {
    const b = req.body || {};
    const ht = num(b.ht, { name: 'Montant HT', min: 0.001, max: 1e10, req: true });
    const tva = oneOf(Number(b.tva), TVAS, { name: 'TVA' });
    const c = mutate(req.params.id, c => {
      editable(c);
      const timbre = c.devise === 'TND' && bool(b.timbre) ? 1 : 0;
      const numero = str(b.numero, { name: 'N° de facture', max: 60, req: true });
      if (c.factures.some(f => f.numero.toLowerCase() === numero.toLowerCase())) throw new HttpError(409, 'Cette facture est déjà enregistrée sur la commande.');
      c.factures.push({ id: newId(5), numero, date: date(b.date, { name: 'Date de facture', req: true }), ht: r3(ht), tva, timbre,
        ttc: r3(ht * (1 + tva / 100) + timbre), echeance: date(b.echeance, { name: 'Échéance' }), ...stamp(req) });
    });
    done(req, res, c, 'achats.facture', `${b.numero} · HT ${ht}`);
  });

  r.delete('/commandes/:id/factures/:fid', RW, (req, res) => {
    let removed;
    const c = mutate(req.params.id, c => { editable(c); removed = c.factures.find(f => f.id === req.params.fid); if (!removed) throw new HttpError(404, 'Facture introuvable.'); c.factures = c.factures.filter(f => f !== removed); });
    done(req, res, c, 'achats.facture_suppression', `${removed.numero} · TTC ${removed.ttc}`);
  });

  r.post('/commandes/:id/paiements', RW, (req, res) => {
    const b = req.body || {};
    const mode = oneOf(b.mode, MODES, { name: 'Mode de paiement' });
    const montant = num(b.montant, { name: 'Montant', min: 0.001, max: 1e10, req: true });
    const reference = str(b.reference, { name: 'Référence', max: 60, req: mode === 'cheque' || mode === 'traite' });
    const cfgA = getSetting(db, 'achats_config', ACHATS_CFG_DEFAULT);
    const c = mutate(req.params.id, c => {
      editable(c);
      const rs = c.devise === 'TND' && bool(b.retenue) ? r3(montant * cfgA.rsTaux / 100) : 0;
      const dt = date(b.date, { name: 'Date du paiement', req: true });
      c.paiements.push({ id: newId(5), date: dt, montant: r3(montant), rs, mode, reference, banque: str(b.banque, { name: 'Banque', max: 80 }),
        echeance: AVEC_ECH.includes(mode) ? (date(b.echeance, { name: 'Échéance' }) || dt) : null, statut: AVEC_ECH.includes(mode) ? 'emis' : 'debite', ...stamp(req) });
    });
    // La banque saisie rejoint la liste
    const banque = str(b.banque, { name: 'Banque', max: 80 });
    if (banque && !cfgA.banques.some(x => x.toLowerCase() === banque.toLowerCase()) && cfgA.banques.length < 50) setSetting(db, 'achats_config', { ...cfgA, banques: [...cfgA.banques, banque] });
    done(req, res, c, 'achats.paiement', `${mode} ${reference} · ${montant} ${c.devise}`);
  });

  r.post('/commandes/:id/paiements/:pid/debite', RW, (req, res) => {
    const c = mutate(req.params.id, c => {
      const p = c.paiements.find(x => x.id === req.params.pid);
      if (!p) throw new HttpError(404, 'Paiement introuvable.');
      p.statut = 'debite'; p.debiteAt = Date.now(); p.debiteBy = req.user.id;
    });
    done(req, res, c, 'achats.paiement_debite', req.params.pid);
  });

  r.delete('/commandes/:id/paiements/:pid', RW, (req, res) => {
    let removed;
    const c = mutate(req.params.id, c => { editable(c); removed = c.paiements.find(x => x.id === req.params.pid); if (!removed) throw new HttpError(404, 'Paiement introuvable.'); c.paiements = c.paiements.filter(x => x !== removed); });
    done(req, res, c, 'achats.paiement_suppression', `${removed.mode} ${removed.reference} · ${removed.montant}`);
  });

  r.post('/commandes/:id/statut', RW, (req, res) => {
    const statut = oneOf(req.body?.statut, ['ouverte', 'soldee', 'annulee'], { name: 'Statut' });
    const motif = statut === 'annulee' ? str(req.body?.motif, { name: 'Motif', max: 300, req: true }) : '';
    const c = mutate(req.params.id, c => {
      if (c.statut === 'annulee') throw new HttpError(409, 'Commande déjà annulée.');
      c.statut = statut;
      if (statut === 'annulee') c.annulation = { ...stamp(req), motif };
    });
    done(req, res, c, 'achats.statut', `${statut}${motif ? ' · ' + motif : ''}`);
  });

  return r;
}
