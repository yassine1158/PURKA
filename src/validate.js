// Validation stricte des entrées : tout champ est typé, borné et nettoyé côté serveur.

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
export const bad = msg => new HttpError(400, msg);

export function str(v, { name = 'Champ', max = 200, req = false, pattern } = {}) {
  if (v === undefined || v === null || v === '') {
    if (req) throw bad(`${name} : obligatoire.`);
    return '';
  }
  if (typeof v !== 'string') throw bad(`${name} : valeur invalide.`);
  const s = v.replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
  if (req && !s) throw bad(`${name} : obligatoire.`);
  if (s.length > max) throw bad(`${name} : ${max} caractères maximum.`);
  if (pattern && s && !pattern.test(s)) throw bad(`${name} : format invalide.`);
  return s;
}

export function text(v, opts = {}) {
  // comme str mais conserve les retours à la ligne
  if (typeof v === 'string') v = v.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, ' ');
  if (v === undefined || v === null || v === '') {
    if (opts.req) throw bad(`${opts.name || 'Champ'} : obligatoire.`);
    return '';
  }
  if (typeof v !== 'string') throw bad(`${opts.name || 'Champ'} : valeur invalide.`);
  const s = v.trim();
  if (opts.req && !s) throw bad(`${opts.name || 'Champ'} : obligatoire.`);
  if (s.length > (opts.max || 1000)) throw bad(`${opts.name || 'Champ'} : ${opts.max || 1000} caractères maximum.`);
  return s;
}

export function num(v, { name = 'Nombre', min = -Infinity, max = Infinity, req = false } = {}) {
  if (v === undefined || v === null || v === '') {
    if (req) throw bad(`${name} : obligatoire.`);
    return null;
  }
  const n = typeof v === 'number' ? v : Number(String(v).replace(/\s/g, '').replace(',', '.'));
  if (!Number.isFinite(n)) throw bad(`${name} : nombre invalide.`);
  if (n < min || n > max) throw bad(`${name} : doit être entre ${min} et ${max}.`);
  return n;
}

export function oneOf(v, list, { name = 'Valeur', req = true, def } = {}) {
  if ((v === undefined || v === null || v === '') && !req) return def;
  if (!list.includes(v)) throw bad(`${name} : valeur non autorisée.`);
  return v;
}

const MIN_DATE = Date.UTC(2000, 0, 1), MAX_DATE = Date.UTC(2100, 0, 1);
export function date(v, { name = 'Date', req = false } = {}) {
  if (v === undefined || v === null || v === '') {
    if (req) throw bad(`${name} : obligatoire.`);
    return null;
  }
  if (typeof v !== 'number' || !Number.isInteger(v) || v < MIN_DATE || v > MAX_DATE) throw bad(`${name} : date invalide.`);
  return v;
}

export const bool = v => v === true;

export function strList(v, { name = 'Liste', max = 200, itemMax = 120 } = {}) {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v)) throw bad(`${name} : liste invalide.`);
  if (v.length > max) throw bad(`${name} : ${max} éléments maximum.`);
  const out = [];
  for (const x of v) {
    const s = str(x, { name, max: itemMax });
    if (s && !out.some(o => o.toLowerCase() === s.toLowerCase())) out.push(s);
  }
  return out;
}

export const ID_RE = /^[a-z0-9]{8,40}$/i;
export function id(v, name = 'Identifiant') {
  if (typeof v !== 'string' || !ID_RE.test(v)) throw bad(`${name} invalide.`);
  return v;
}
