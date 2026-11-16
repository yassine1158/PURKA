import express from 'express';
import { getSetting, setSetting } from '../db.js';
import { num, strList } from '../validate.js';

export const CONFIG_DEFAULT = { fournisseurs: [], matieres: [], zones: [], qcTests: [], toleranceBL: 0.5 };

export function configRouter({ db, auth, audit, hub }) {
  const r = express.Router();

  // Les listes servent à remplir les formulaires : lisibles par tout utilisateur connecté.
  r.get('/', (req, res) => res.json(getSetting(db, 'config', CONFIG_DEFAULT)));

  r.put('/', auth.requirePerm('config.write'), (req, res) => {
    const b = req.body || {};
    const cur = getSetting(db, 'config', CONFIG_DEFAULT);
    const next = {
      fournisseurs: b.fournisseurs !== undefined ? strList(b.fournisseurs, { name: 'Fournisseurs', max: 500 }) : cur.fournisseurs,
      matieres: b.matieres !== undefined ? strList(b.matieres, { name: 'Matières' }) : cur.matieres,
      zones: b.zones !== undefined ? strList(b.zones, { name: 'Zones' }) : cur.zones,
      qcTests: b.qcTests !== undefined ? strList(b.qcTests, { name: 'Mesures qualité', max: 30 }) : cur.qcTests,
      toleranceBL: b.toleranceBL !== undefined ? num(b.toleranceBL, { name: 'Tolérance', min: 0, max: 20, req: true }) : cur.toleranceBL,
    };
    setSetting(db, 'config', next);
    audit(req, 'config.update', '', Object.keys(b).join(', '));
    hub.emit('config');
    res.json(next);
  });

  return r;
}
