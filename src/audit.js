// Journal des actions : qui a fait quoi, quand, depuis quelle adresse.
export function createAudit(db) {
  const ins = db.prepare('INSERT INTO audit (at, user_id, username, action, target, detail, ip) VALUES (?, ?, ?, ?, ?, ?, ?)');
  return function audit(req, action, target = '', detail = '') {
    ins.run(Date.now(), req.user?.id ?? null, req.user?.username ?? (req.body?.username ? String(req.body.username).slice(0, 40) : null),
      action, String(target).slice(0, 120), typeof detail === 'string' ? detail.slice(0, 500) : JSON.stringify(detail).slice(0, 500), req.ip || '');
  };
}

export const stamp = req => ({ at: Date.now(), by: req.user.id, byName: req.user.name });
