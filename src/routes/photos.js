import express from 'express';
import multer from 'multer';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { HttpError, bad } from '../validate.js';

const MAX_BYTES = 8 * 1024 * 1024;

// Le type est déterminé par le contenu du fichier, jamais par son nom ou ce que déclare le navigateur.
function sniff(buf) {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.length > 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

export function photosRouter({ db, auth, audit, cfg }) {
  const r = express.Router();
  const dir = path.join(cfg.dataDir, 'uploads');
  fs.mkdirSync(dir, { recursive: true });
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_BYTES, files: 1, fields: 2 } });
  const fileOf = phId => path.join(dir, phId);

  // Photos envoyées mais jamais rattachées à un contrôle : supprimées après 24 h
  function cleanup() {
    const old = db.prepare('SELECT id FROM photos WHERE reception_id IS NULL AND created_at < ?').all(Date.now() - 86400000);
    for (const p of old) {
      fs.rmSync(fileOf(p.id), { force: true });
      db.prepare('DELETE FROM photos WHERE id = ?').run(p.id);
    }
  }
  cleanup();
  setInterval(cleanup, 3600000).unref();

  r.post('/', auth.requirePerm('qc.decide'), (req, res, next) => {
    upload.single('photo')(req, res, err => {
      if (err) return next(err.code === 'LIMIT_FILE_SIZE' ? bad('Photo trop lourde (8 Mo maximum).') : bad('Envoi de la photo invalide.'));
      if (!req.file) return next(bad('Aucune photo reçue.'));
      const mime = sniff(req.file.buffer);
      if (!mime) return next(bad('Format non accepté : JPEG, PNG ou WebP uniquement.'));
      const phId = crypto.randomBytes(16).toString('hex');
      fs.writeFileSync(fileOf(phId), req.file.buffer, { mode: 0o600 });
      db.prepare('INSERT INTO photos (id, mime, size, owner, reception_id, created_at) VALUES (?, ?, ?, ?, NULL, ?)').run(phId, mime, req.file.size, req.user.id, Date.now());
      audit(req, 'photo.upload', phId, `${Math.round(req.file.size / 1024)} Ko`);
      res.status(201).json({ id: phId, url: `/api/photos/${phId}` });
    });
  });

  r.get('/:id', auth.requirePerm('receptions.read'), (req, res) => {
    if (!/^[a-f0-9]{32}$/.test(req.params.id)) throw new HttpError(404, 'Photo introuvable.');
    const ph = db.prepare('SELECT * FROM photos WHERE id = ?').get(req.params.id);
    // Une photo pas encore rattachée n'est visible que par celui qui l'a envoyée
    if (!ph || (!ph.reception_id && ph.owner !== req.user.id)) throw new HttpError(404, 'Photo introuvable.');
    res.setHeader('Content-Type', ph.mime);
    res.setHeader('Cache-Control', 'private, max-age=86400');
    res.setHeader('Content-Disposition', 'inline');
    fs.createReadStream(fileOf(ph.id)).on('error', () => res.status(404).end()).pipe(res);
  });

  r.delete('/:id', auth.requirePerm('qc.decide'), (req, res) => {
    if (!/^[a-f0-9]{32}$/.test(req.params.id)) throw new HttpError(404, 'Photo introuvable.');
    const ph = db.prepare('SELECT * FROM photos WHERE id = ?').get(req.params.id);
    if (!ph || ph.owner !== req.user.id || ph.reception_id) throw new HttpError(404, 'Photo introuvable.');
    fs.rmSync(fileOf(ph.id), { force: true });
    db.prepare('DELETE FROM photos WHERE id = ?').run(ph.id);
    res.json({ ok: true });
  });

  return r;
}
