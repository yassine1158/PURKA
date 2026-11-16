import { can } from './permissions.js';

// Diffusion en direct (Server-Sent Events) : chaque client ne reçoit que les sujets
// que son rôle a le droit de lire. Le message ne contient aucune donnée, seulement
// le nom du sujet ; le client relit ensuite l'API, qui applique les droits.
const TOPIC_PERM = { receptions: 'receptions.read', achats: 'achats.read', config: null, users: 'users.manage' };

export function createHub(db) {
  const clients = new Set();

  function handler(req, res) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.write('retry: 5000\n\n');
    const c = { res, userId: req.user.id };
    clients.add(c);
    const ping = setInterval(() => res.write(': ping\n\n'), 25000);
    // Fermeture régulière : la reconnexion repasse par la vérification de session.
    const maxAge = setTimeout(() => res.end(), 20 * 60 * 1000);
    req.on('close', () => { clearInterval(ping); clearTimeout(maxAge); clients.delete(c); });
  }

  function emit(topic) {
    const perm = TOPIC_PERM[topic];
    const getUser = db.prepare('SELECT * FROM users WHERE id = ?');
    for (const c of clients) {
      const u = getUser.get(c.userId);
      if (!u || !u.active) { c.res.end(); clients.delete(c); continue; }
      if (perm && !can(u, perm)) continue;
      c.res.write(`data: ${JSON.stringify({ topic })}\n\n`);
    }
  }

  function kick(userId) {
    for (const c of clients) if (c.userId === userId) { c.res.end(); clients.delete(c); }
  }

  return { handler, emit, kick };
}
