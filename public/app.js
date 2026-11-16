(() => {
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const nf0 = new Intl.NumberFormat('fr-FR', {maximumFractionDigits:0});
const nf3 = new Intl.NumberFormat('fr-FR', {minimumFractionDigits:3, maximumFractionDigits:3});
const nf2 = new Intl.NumberFormat('fr-FR', {minimumFractionDigits:2, maximumFractionDigits:2});
const kg = n => (n == null || !isFinite(n)) ? '—' : nf0.format(n) + ' kg';
const tn = n => nf3.format((n || 0) / 1000);
const hm = ms => new Date(ms).toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'});
const dmy = ms => new Date(ms).toLocaleDateString('fr-FR', {day:'2-digit', month:'2-digit', year:'numeric'});
const since = ms => { const m = Math.max(0, Math.round((Date.now() - ms) / 60000)); return m < 60 ? m + ' min' : Math.floor(m / 60) + ' h ' + String(m % 60).padStart(2, '0'); };
const dayStart = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
const monthStart = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).getTime(); };
const parseKg = v => { const n = Number(String(v ?? '').replace(/[\s  ]/g, '').replace(',', '.')); return isFinite(n) && String(v ?? '').trim() !== '' ? n : null; };

const ICON = {
  camions:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M2 6h11v10H2zM13 9h4l4 4v3h-8z"/><circle cx="6" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/></svg>',
  stock:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M3 9l9-5 9 5v11H3z"/><path d="M7 20v-7h10v7M7 16.5h10"/></svg>',
  historique:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M3.5 12a8.5 8.5 0 1 0 2.5-6"/><path d="M3 4v4h4M12 7.5V12l3 2"/></svg>',
  parametres:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/></svg>',
  qualite:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3h6M10 3v6l-5.2 9.2A1.9 1.9 0 0 0 6.5 21h11a1.9 1.9 0 0 0 1.7-2.8L14 9V3"/><path d="M7.3 15h9.4"/></svg>',
  achats:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6M9 16h3"/></svg>',
  x:'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  dl:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>',
};
const TABS = [['camions','Camions'],['qualite','Qualité'],['stock','Stock'],['achats','Achats'],['historique','Historique'],['parametres','Paramètres']];

// Flux : arrivée → contrôle qualité (photos + validation) → pesée entrée (brut) → déchargement au magasin → pesée sortie (tare) → entrée en stock
const ST = {
  attente_qc:    {label:'Attente contrôle qualité', cls:'qc', action:'Contrôler le chargement', idx:1},
  attente_pesee1:{label:'Attente pesée entrée', cls:'wait',  action:'Peser à l’entrée (brut)', idx:2},
  dechargement:  {label:'En déchargement',      cls:'unload',action:'Déchargement terminé',     idx:3},
  attente_pesee2:{label:'Attente pesée sortie', cls:'wait',  action:'Peser à la sortie (tare)', idx:4},
  cloture:       {label:'En stock',             cls:'ok',    idx:5},
  refuse_qc:     {label:'Refusé qualité',       cls:'bad',   idx:0},
  annule:        {label:'Annulé',               cls:'bad',   idx:0},
};
const ACT = {attente_qc:'qc', attente_pesee1:'pesee1', dechargement:'dech', attente_pesee2:'pesee2'};
const LANES = [
  ['attente_qc','Qualité · contrôle','var(--qc)','Aucun camion à contrôler.'],
  ['attente_pesee1','Bascule · entrée','var(--wait)','Aucun camion en attente de pesée.'],
  ['dechargement','Quai · déchargement','var(--unload)','Aucun camion en cours de déchargement.'],
  ['attente_pesee2','Bascule · sortie','var(--accent)','Aucun camion à repeser.'],
];
const QUAL = {conforme:['Conforme','ok'], reserve:['Avec réserve','wait'], non_conforme:['Non conforme','bad']};
const LATE_MIN = 60;
// Contrôle qualité à l'entrée : aucun camion ne passe à la bascule sans validation qualité
const QCD = {accepte:['Accepté','ok'], reserve:['Accepté avec réserve','wait'], refuse:['Refusé','bad']};
const QC_DEFAULT_TESTS = ['Viscosité Mooney ML(1+4) 100 °C', 'Matières volatiles (%)', 'Cendres (%)', 'Impuretés (%)', 'Densité (g/cm³)'];
const qcChip = r => { const q = QCD[r.qc?.decision]; return q ? `<span class="chip ${q[1]}">${q[0]}</span>` : r.status === 'attente_qc' ? '<span class="chip qc">À contrôler</span>' : '<span class="chip neutral">—</span>'; };
const qcPending = r => r.status === 'attente_qc';
const photoSrc = id => '/api/photos/' + encodeURIComponent(id);
const thumbs = ids => ids?.length ? `<div class="thumbs">${ids.map(id => `<button class="ph" type="button" data-photo="${esc(id)}" aria-label="Agrandir la photo"><img src="${photoSrc(id)}" alt="Photo du chargement" loading="lazy"></button>`).join('')}</div>` : '';
const can = perm => !!S.me?.perms?.includes(perm);
const ACT_PERM = {attente_qc:'qc.decide', attente_pesee1:'pesee.write', dechargement:'dechargement.write', attente_pesee2:'pesee.write'};
const TAB_PERM = {camions:'receptions.read', qualite:'receptions.read', stock:'stock.read', achats:'achats.read', historique:'historique.read', parametres:null};
const tabOk = k => !TAB_PERM[k] || can(TAB_PERM[k]);

const S = {
  db:null, user:null, uid:null, canWrite:true, recs:[], loaded:false, cfgLoaded:false,
  cfg:{fournisseurs:[], matieres:[], zones:[], toleranceBL:0.5, qcTests:[]},
  cmds:[], cmdLoaded:false, cmdErr:false, ccfg:{banques:[], rsTaux:1.5, rsSeuil:1000}, ach:{f:'ouvertes', q:''},
  me:null, users:[], roles:[], permsDesc:{}, audit:[], usersLoaded:false, auditLoaded:false,
  tab:'camions', stockRange:'all', hist:{range:'today', q:''}, names:{}, sheet:null, dl:null,
};

function plate(p){
  const m = String(p || '').trim().match(/^(\d{1,3})\s*(?:TU|TN|تونس)\s*(\d{1,4})$/i);
  if (m) return `<span class="plate" title="${esc(p)}"><span>${m[1]}</span><i lang="ar">تونس</i><span>${m[2]}</span></span>`;
  return `<span class="plate">${esc(p || '—')}</span>`;
}
function chip(status){ const s = ST[status] || {label:status, cls:'neutral'}; return `<span class="chip ${s.cls}">${esc(s.label)}</span>`; }
function steps(status){ const i = ST[status]?.idx ?? 0; return `<div class="steps" aria-label="Étape ${i} sur 5">${[1,2,3,4,5].map(k => `<i class="${k < i ? 'done' : k === i ? 'now' : ''}"></i>`).join('')}</div>`; }
function stageTime(r){ return r.status === 'attente_qc' ? r.arrivee?.at : r.status === 'attente_pesee1' ? (r.qc?.at || r.arrivee?.at) : r.status === 'dechargement' ? r.pesee1?.at : r.status === 'attente_pesee2' ? r.dechargement?.at : r.createdAt; }
function ecart(r){ if (!r.poidsBL || r.net == null) return null; return (r.net - r.poidsBL) / r.poidsBL * 100; }
const nameOf = step => step?.byName || '—';

/* ---------- Toast ---------- */
let toastT;
function toast(msg, bad){ clearTimeout(toastT); $('#toastRoot').innerHTML = `<div class="toast ${bad ? 'bad' : ''}" role="status">${esc(msg)}</div>`; toastT = setTimeout(() => $('#toastRoot').innerHTML = '', 3200); }
function dbErr(e){ return e?.message || 'Enregistrement impossible. Vérifiez la connexion et réessayez.'; }

/* ---------- Navigation ---------- */
function navHTML(bottom){
  const n = S.recs.filter(r => LANES.some(l => l[0] === r.status)).length, nq = S.recs.filter(qcPending).length;
  const b = {camions:n, qualite:can('qc.decide') ? nq : 0, achats:can('achats.read') ? S.cmds.filter(c => c.statut !== 'annulee' && cmdCalc(c).echu > 0).length : 0};
  return TABS.filter(([k]) => tabOk(k)).map(([k, l]) => `<button class="tab" type="button" data-tab="${k}" ${S.tab === k ? 'aria-current="page"' : ''}>${ICON[k]}<span>${bottom && k === 'parametres' ? 'Réglages' : l}</span>${b[k] ? `<span class="badge">${b[k]}</span>` : ''}</button>`).join('');
}
function go(tab){ if (!tabOk(tab)) tab = TABS.find(t => tabOk(t[0]))[0]; S.tab = tab; if (location.hash !== '#' + tab) history.replaceState(null, '', '#' + tab); render(); window.scrollTo(0, 0); }
document.addEventListener('click', e => { const t = e.target.closest('[data-tab]'); if (t) go(t.dataset.tab); });
window.addEventListener('hashchange', () => { const h = location.hash.slice(1); if (TABS.some(t => t[0] === h) && h !== S.tab && tabOk(h)) { S.tab = h; render(); } });
{ const h = location.hash.slice(1); if (TABS.some(t => t[0] === h)) S.tab = h; }

/* ---------- Views ---------- */
function render(){
  $('#navDesk').innerHTML = navHTML(); $('#navBot').innerHTML = navHTML(true);
  if (!S.me) return;
  if (!tabOk(S.tab)) S.tab = TABS.find(t => tabOk(t[0]))[0];
  $('#fab').hidden = !(can('receptions.create') && S.cfgLoaded && (S.tab === 'camions' || S.tab === 'historique'));
  $('#who').textContent = S.me.name; $('#whoRole').textContent = S.me.roleLabel;
  const m = $('#main');
  const v = {camions:vCamions, qualite:vQualite, stock:vStock, achats:vAchats, historique:vHist, parametres:vSettings}[S.tab]();
  // keep focus/caret in the history search box across re-renders
  const a = document.activeElement, keep = a && ['q', 'qcSearch', 'aq'].includes(a.id) ? [a.id, a.selectionStart] : null;
  m.innerHTML = v;
  if (keep) { const q = document.getElementById(keep[0]); if (q) { q.focus(); try { q.setSelectionRange(keep[1], keep[1]); } catch {} } }
}

function loadingOr(html){ return S.loaded ? html : `<div class="lane-empty">Chargement des réceptions…</div>`; }

function vCamions(){
  const t0 = dayStart();
  const active = S.recs.filter(r => LANES.some(l => l[0] === r.status));
  const today = S.recs.filter(r => r.status === 'cloture' && (r.pesee2?.at || 0) >= t0);
  const netToday = today.reduce((s, r) => s + (r.net || 0), 0);
  const setupNeeded = S.cfgLoaded && (!S.cfg.matieres.length || !S.cfg.zones.length);
  return `<div class="view">
    ${setupNeeded ? `<div class="notice">Avant la première réception, ajoutez vos <b>matières</b> et vos <b>zones de stockage</b> dans <button class="btn ghost" style="min-height:0;padding:0 2px;color:var(--accent)" data-tab="parametres">Paramètres</button>.</div>` : ''}
    <div class="strip">
      <div><span class="label">Sur site</span><b class="num">${active.length} <small>camion${active.length > 1 ? 's' : ''}</small></b></div>
      <div><span class="label">Reçus aujourd’hui</span><b class="num">${today.length}</b></div>
      <div><span class="label">Net entré aujourd’hui</span><b class="num">${tn(netToday)} <small>t</small></b></div>
      <div><span class="label">Bloqués &gt; ${LATE_MIN} min</span><b class="num" style="${active.some(r => Date.now() - stageTime(r) > LATE_MIN * 60000) ? 'color:var(--bad)' : ''}">${active.filter(r => Date.now() - stageTime(r) > LATE_MIN * 60000).length}</b></div>
    </div>
    <div class="board">${LANES.map(([st, title, col, emptyTxt]) => {
      const list = active.filter(r => r.status === st).sort((a, b) => stageTime(a) - stageTime(b));
      return `<section class="lane"><div class="lane-h"><span class="st" style="background:${col}"></span><h2>${title}</h2><span class="n">${list.length}</span></div>
        ${loadingOr(list.length ? list.map(card).join('') : `<div class="lane-empty">${emptyTxt}${st === 'attente_qc' && can('receptions.create') ? '<br>Un camion arrive ? Touchez « Nouvelle arrivée ».' : ''}</div>`)}</section>`;
    }).join('')}</div></div>`;
}

function card(r){
  const st = ST[r.status], t = stageTime(r), late = Date.now() - t > LATE_MIN * 60000;
  const line2 = r.status === 'dechargement' || r.status === 'attente_pesee2'
    ? `<span>Brut <b class="mono">${kg(r.pesee1?.kg)}</b></span>${r.dechargement?.zone ? `<span>→ ${esc(r.dechargement.zone)}</span>` : ''}`
    : `${r.bl ? `<span class="muted">BL ${esc(r.bl)}</span>` : ''}${r.poidsBL ? `<span class="muted">${kg(r.poidsBL)} annoncés</span>` : ''}`;
  return `<article class="card">
    <div class="card-top">
      <button class="open" type="button" data-open="${r.id}" aria-label="Détail ${esc(r.plate)}">
        ${plate(r.plate)}
        <span class="ticket">${esc(r.ticket)} · arrivé ${hm(r.arrivee?.at || r.createdAt)}</span>
      </button>
      <span class="elapsed ${late ? 'late' : ''}" title="Temps à cette étape">${since(t)}</span>
    </div>
    <div class="meta"><span><b>${esc(r.matiere)}</b></span><span>${esc(r.fournisseur)}</span>${r.qc?.decision ? qcChip(r) : ''}</div>
    <div class="meta">${line2}</div>
    ${steps(r.status)}
    ${!can(ACT_PERM[r.status]) ? (r.status === 'attente_qc' ? '<div class="muted" style="font-size:13px;text-align:center">En attente du contrôleur qualité · pesée bloquée</div>' : '')
      : `<button class="btn ${r.status === 'dechargement' ? 'dark' : 'primary'} block" type="button" data-act="${r.id}" ${r.status === 'attente_qc' ? 'style="background:var(--qc);border-color:var(--qc);color:var(--surface)"' : ''}>${st.action}</button>`}
  </article>`;
}

function vQualite(){
  const pend = S.recs.filter(qcPending).sort((a, b) => a.createdAt - b.createdAt);
  const done = S.recs.filter(r => r.qc?.decision).sort((a, b) => b.qc.at - a.qc.at);
  const t0 = dayStart(), today = done.filter(r => r.qc.at >= t0);
  const resM = done.filter(r => r.qc.decision === 'reserve' && r.qc.at >= monthStart()).length;
  return `<div class="view">
    ${S.cfgLoaded && !can('qc.decide') ? `<div class="notice">Vous voyez les camions, mais seul le contrôle qualité peut valider ou refuser un chargement.</div>` : ''}
    <div class="strip">
      <div><span class="label">À contrôler</span><b class="num" style="${pend.length ? 'color:var(--qc)' : ''}">${pend.length}</b></div>
      <div><span class="label">Contrôlés aujourd’hui</span><b class="num">${today.length}</b></div>
      <div><span class="label">Refusés aujourd’hui</span><b class="num" style="${today.some(r => r.qc.decision === 'refuse') ? 'color:var(--bad)' : ''}">${today.filter(r => r.qc.decision === 'refuse').length}</b></div>
      <div><span class="label">Avec réserve ce mois</span><b class="num">${resM}</b></div>
    </div>
    <section class="lane"><div class="lane-h"><span class="st" style="background:var(--qc)"></span><h2>Camions à contrôler</h2><span class="n">${pend.length}</span></div>
      ${loadingOr(pend.length ? `<div class="mat-grid">${pend.map(card).join('')}</div>` : `<div class="lane-empty">Aucun camion en attente. Les nouveaux camions arrivent ici avant la pesée.</div>`)}</section>
    <section class="lane"><div class="lane-h"><h2>Derniers contrôles</h2></div>
      ${done.length ? `<div class="panel recent">${done.slice(0, 15).map(r => `<button type="button" data-open="${r.id}"><span style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">${plate(r.plate)} <b>${esc(r.matiere)}</b> · ${esc(r.fournisseur)}</span>${qcChip(r)}<span class="ticket">${esc(r.ticket)} · ${dmy(r.qc.at)} ${hm(r.qc.at)} · ${esc(nameOf(r.qc))}${r.qc.photos?.length ? ' · ' + r.qc.photos.length + ' photo' + (r.qc.photos.length > 1 ? 's' : '') : ''}</span><span class="muted" style="font-size:12.5px">${esc(ST[r.status]?.label || '')}</span></button>`).join('')}</div>` : `<div class="lane-empty">Aucun contrôle pour l’instant.</div>`}
    </section>
  </div>`;
}

function inRange(ms, range){
  if (range === 'all') return true;
  if (range === 'today') return ms >= dayStart();
  if (range === '7d') return ms >= dayStart() - 6 * 864e5;
  if (range === 'month') return ms >= monthStart();
  return true;
}
const RANGES = [['today','Aujourd’hui'],['7d','7 jours'],['month','Ce mois'],['all','Tout']];
function pills(name, cur){ return `<div class="pills" role="group">${RANGES.map(([k, l]) => `<button type="button" data-range="${name}:${k}" aria-pressed="${cur === k}">${l}</button>`).join('')}</div>`; }

function vStock(){
  const recs = S.recs.filter(r => r.status === 'cloture' && inRange(r.pesee2?.at || r.createdAt, S.stockRange));
  const total = recs.reduce((s, r) => s + (r.net || 0), 0);
  const byMat = {};
  const tot = {ok:0, res:0};
  const qk = r => r.qc?.decision === 'reserve' || (r.dechargement?.qualite && r.dechargement.qualite !== 'conforme') ? 'res' : 'ok';
  recs.forEach(r => { const m = byMat[r.matiere] ||= {net:0, n:0, zones:{}, fourn:{}, ok:0, res:0}; m.net += r.net || 0; m.n++; m[qk(r)] += r.net || 0; tot[qk(r)] += r.net || 0; const z = r.dechargement?.zone || '—'; m.zones[z] = (m.zones[z] || 0) + (r.net || 0); m.fourn[r.fournisseur] = (m.fourn[r.fournisseur] || 0) + (r.net || 0); });
  const mats = Object.entries(byMat).sort((a, b) => b[1].net - a[1].net);
  return `<div class="view">
    <div class="sec-h"><div><h2>Entrées en stock</h2><div class="muted" style="font-size:13.5px">Poids net pesé (brut − tare) des camions validés par la qualité. « Avec réserve » = accepté sous réserve ou défaut signalé au déchargement. Les sorties vers la production ne sont pas encore suivies.</div></div><div class="sp">${pills('stock', S.stockRange)}</div></div>
    <div class="strip">
      <div><span class="label">Net total · ${recs.length} réception${recs.length > 1 ? 's' : ''}</span><b class="num">${tn(total)} <small>t</small></b></div>
      <div><span class="label">Conforme</span><b class="num" style="color:var(--ok)">${tn(tot.ok)} <small>t</small></b></div>
      <div><span class="label">Avec réserve</span><b class="num" style="${tot.res ? 'color:var(--wait)' : ''}">${tn(tot.res)} <small>t</small></b></div>
      <div><span class="label">Camions refusés</span><b class="num" style="color:var(--bad)">${S.recs.filter(r => r.status === 'refuse_qc' && inRange(r.qc?.at || r.createdAt, S.stockRange)).length}</b></div>
    </div>
    ${!S.loaded ? `<div class="lane-empty">Chargement…</div>` : mats.length ? `<div class="mat-grid">${mats.map(([name, m]) => {
      const zs = Object.entries(m.zones).sort((a, b) => b[1] - a[1]); const mx = Math.max(...zs.map(z => z[1]), 1);
      const fs = Object.entries(m.fourn).sort((a, b) => b[1] - a[1]).slice(0, 3);
      return `<section class="panel mat">
        <div style="display:flex;justify-content:space-between;gap:10px;align-items:baseline;flex-wrap:wrap"><h3>${esc(name)}</h3><span class="muted" style="font-size:13px">${m.n} réception${m.n > 1 ? 's' : ''}</span></div>
        <div class="big">${tn(m.net)} <small>t</small></div>
        <div class="stack" role="img" aria-label="Conforme ${tn(m.ok)} t, avec réserve ${tn(m.res)} t">${[['ok','var(--ok)'],['res','var(--wait)']].map(([k, c]) => m[k] ? `<i style="width:${(m[k] / (m.net || 1) * 100).toFixed(1)}%;background:${c}"></i>` : '').join('')}</div>
        <div class="legend"><span><i style="background:var(--ok)"></i>Conforme ${tn(m.ok)} t</span>${m.res ? `<span><i style="background:var(--wait)"></i>Avec réserve ${tn(m.res)} t</span>` : ''}</div>
        <div class="bars"><span class="label">Par zone</span>${zs.map(([z, v]) => `<div class="bar"><span>${esc(z)}</span><span class="mono num">${tn(v)} t</span><span class="track"><i style="width:${(v / mx * 100).toFixed(1)}%"></i></span></div>`).join('')}</div>
        <div class="muted" style="font-size:12.5px">Principaux fournisseurs : ${fs.map(([f, v]) => `${esc(f)} (${tn(v)} t)`).join(' · ')}</div>
      </section>`; }).join('')}</div>`
    : `<div class="panel empty"><h3>Aucune entrée sur cette période</h3><span>Le stock se remplit automatiquement quand un camion est pesé à la sortie.</span></div>`}
  </div>`;
}

function histRows(){
  const q = S.hist.q.trim().toLowerCase();
  return S.recs.filter(r => ['cloture', 'annule', 'refuse_qc'].includes(r.status) && inRange(r.pesee2?.at || r.qc?.at || r.annulation?.at || r.createdAt, S.hist.range))
    .filter(r => !q || [r.ticket, r.plate, r.fournisseur, r.matiere, r.bl, r.chauffeur, r.dechargement?.zone, r.dechargement?.lot].join(' ').toLowerCase().includes(q))
    .sort((a, b) => b.createdAt - a.createdAt);
}
function vHist(){
  const rows = histRows();
  const net = rows.filter(r => r.status === 'cloture').reduce((s, r) => s + (r.net || 0), 0);
  const tol = S.cfg.toleranceBL;
  return `<div class="view">
    <div class="sec-h"><div><h2>Historique des réceptions</h2><div class="muted" style="font-size:13.5px">${rows.length} ligne${rows.length > 1 ? 's' : ''} · ${tn(net)} t net</div></div>
      <div class="sp"><button class="btn" type="button" id="csv" ${!rows.length ? 'disabled' : ''} ${can('export') ? '' : 'hidden'}>${ICON.dl} Exporter (Excel/CSV)</button></div></div>
    <div class="filters">${pills('hist', S.hist.range)}<input class="input search" id="q" type="search" placeholder="Rechercher matricule, fournisseur, BL, lot…" value="${esc(S.hist.q)}" aria-label="Rechercher"></div>
    ${!S.loaded ? `<div class="lane-empty">Chargement…</div>` : rows.length ? `<div class="panel tbl-wrap"><table>
      <thead><tr><th>Date</th><th>Ticket</th><th>Matricule</th><th>Fournisseur</th><th>Matière</th><th>Zone</th><th class="r">Brut (kg)</th><th class="r">Tare (kg)</th><th class="r">Net (kg)</th><th class="r">Écart BL</th><th>Contrôle qualité</th><th>Visuel quai</th><th>Statut</th></tr></thead>
      <tbody>${rows.map(r => { const e = ecart(r); const ql = QUAL[r.dechargement?.qualite];
        return `<tr data-open="${r.id}"><td class="num">${dmy(r.createdAt)} ${hm(r.createdAt)}</td><td class="mono">${esc(r.ticket)}</td><td>${plate(r.plate)}</td><td>${esc(r.fournisseur)}</td><td>${esc(r.matiere)}</td><td>${esc(r.dechargement?.zone || '—')}</td>
        <td class="r mono">${r.pesee1 ? nf0.format(r.pesee1.kg) : '—'}</td><td class="r mono">${r.pesee2 ? nf0.format(r.pesee2.kg) : '—'}</td><td class="r mono"><b>${r.net != null ? nf0.format(r.net) : '—'}</b></td>
        <td class="r mono" style="${e != null && Math.abs(e) > tol ? 'color:var(--bad);font-weight:600' : ''}">${e == null ? '—' : (e > 0 ? '+' : '') + nf2.format(e) + ' %'}</td>
        <td>${qcChip(r)}</td><td>${ql ? `<span class="chip ${ql[1]}">${ql[0]}</span>` : '—'}</td><td>${chip(r.status)}</td></tr>`; }).join('')}</tbody></table></div>`
    : `<div class="panel empty"><h3>Aucune réception terminée${S.hist.q ? ' pour cette recherche' : ' sur cette période'}</h3><span>Les camions apparaissent ici une fois pesés à la sortie, refusés par la qualité ou annulés.</span></div>`}
  </div>`;
}

function vSettings(){
  const mine = `<section class="panel set"><h3>Mon compte</h3>
      <dl class="kv">${kvg('Nom', esc(S.me.name))}${kvg('Identifiant', esc(S.me.username))}${kvg('Rôle', esc(S.me.roleLabel))}</dl>
      <span class="label">Mes droits</span><ul style="margin:0;padding-left:18px;font-size:13.5px">${S.me.perms.map(x => `<li>${esc(S.permsDesc[x] || x)}</li>`).join('')}</ul>
      <form class="form" id="pwForm" autocomplete="off"><span class="label">Changer mon mot de passe</span>
        <input class="input" id="pw0" type="password" placeholder="Mot de passe actuel" autocomplete="current-password" aria-label="Mot de passe actuel">
        <input class="input" id="pw1" type="password" placeholder="Nouveau mot de passe (10 caractères min.)" autocomplete="new-password" aria-label="Nouveau mot de passe">
        <input class="input" id="pw2" type="password" placeholder="Confirmer le nouveau mot de passe" autocomplete="new-password" aria-label="Confirmer">
        <div class="err" id="pwErr"></div><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn dark" type="submit">Changer</button><button class="btn danger" type="button" data-logout>Se déconnecter</button></div></form></section>`;
  return `<div class="view">
    <div class="sec-h"><div><h2>Paramètres</h2><div class="muted" style="font-size:13.5px">Votre compte${can('config.write') ? ', les listes des formulaires' : ''}${can('users.manage') ? ', les utilisateurs' : ''}${can('audit.read') ? ' et le journal des actions' : ''}.</div></div></div>
    <div class="set-grid">${mine}${can('config.write') || can('achats.write') ? vSettingsLists() : ''}</div>
    ${can('users.manage') ? vUsers() : ''}
    ${can('audit.read') ? vAudit() : ''}
  </div>`;
}

const ROLE_COL = {admin:'bad', comptable:'unload', controleur:'qc', bascule:'wait', magasinier:'ok'};
function vUsers(){
  if (!S.usersLoaded) return '<div class="lane-empty">Chargement des utilisateurs…</div>';
  const roleOpts = sel => S.roles.map(r => `<option value="${r.key}" ${r.key === sel ? 'selected' : ''}>${esc(r.label)}</option>`).join('');
  const perms = Object.keys(S.permsDesc);
  return `<section class="stackcol">
    <div class="sec-h"><div><h2>Utilisateurs</h2><div class="muted" style="font-size:13.5px">Chaque personne a son identifiant et son rôle. Le serveur refuse toute action hors de son rôle.</div></div></div>
    <div class="panel tbl-wrap"><table style="min-width:760px"><thead><tr><th>Nom</th><th>Identifiant</th><th>Rôle</th><th>Dernière connexion</th><th>Statut</th><th></th></tr></thead><tbody>
      ${S.users.map(u => `<tr style="cursor:default"><td><b>${esc(u.name)}</b>${u.id === S.me.id ? ' <span class="chip neutral">vous</span>' : ''}</td><td class="mono">${esc(u.username)}</td>
        <td><select class="input" style="min-height:36px;padding:4px 8px;font-size:14px" data-urole="${u.id}" aria-label="Rôle de ${esc(u.name)}">${roleOpts(u.role)}</select></td>
        <td class="num">${u.lastLogin ? dmy(u.lastLogin) + ' ' + hm(u.lastLogin) : '<span class="muted">jamais</span>'}</td>
        <td>${u.active ? (u.mustChangePassword ? '<span class="chip wait">Mot de passe provisoire</span>' : '<span class="chip ok">Actif</span>') : '<span class="chip bad">Désactivé</span>'}</td>
        <td style="display:flex;gap:6px"><button class="btn sm" type="button" data-ureset="${u.id}">Nouveau mot de passe</button><button class="btn sm ${u.active ? 'danger' : ''}" type="button" data-uactive="${u.id}:${u.active ? 0 : 1}">${u.active ? 'Désactiver' : 'Réactiver'}</button></td></tr>`).join('')}
    </tbody></table></div>
    ${S.sheetReset ? `<form class="sub" id="resetForm"><b>Nouveau mot de passe provisoire pour ${esc(S.users.find(u => u.id === S.sheetReset)?.name || '')}</b>
      <div class="add"><input class="input mono" id="resetPw" autocomplete="off" value="${esc(tempPassword())}" aria-label="Mot de passe provisoire"><button class="btn dark" type="submit">Enregistrer</button><button class="btn ghost" type="button" data-ureset="">Annuler</button></div>
      <span class="hint">Communiquez-le en main propre. La personne devra le changer à sa prochaine connexion ; ses sessions ouvertes sont fermées.</span></form>` : ''}
    <form class="panel set" id="userForm" autocomplete="off"><h3>Ajouter un utilisateur</h3>
      <div class="row"><div class="field"><label for="nu_name">Nom complet <em>*</em></label><input class="input" id="nu_name" maxlength="80"></div>
        <div class="field"><label for="nu_user">Identifiant <em>*</em></label><input class="input mono" id="nu_user" maxlength="32" placeholder="ex. karim.qualite" autocapitalize="none"></div></div>
      <div class="row"><div class="field"><label for="nu_role">Rôle <em>*</em></label><select class="input" id="nu_role">${roleOpts('controleur')}</select><span class="hint" id="nu_roleDesc">${esc(S.roles.find(r => r.key === 'controleur')?.description || '')}</span></div>
        <div class="field"><label for="nu_pw">Mot de passe provisoire <em>*</em></label><input class="input mono" id="nu_pw" value="${esc(tempPassword())}"><span class="hint">À changer par la personne à sa première connexion.</span></div></div>
      <div class="err" id="nuErr"></div><button class="btn primary" type="submit" style="align-self:flex-start">Créer le compte</button></form>
    <div class="panel tbl-wrap"><table style="min-width:720px"><thead><tr><th>Droit</th>${S.roles.map(r => `<th style="text-align:center">${esc(r.label)}</th>`).join('')}</tr></thead><tbody>
      ${perms.map(pk => `<tr style="cursor:default"><td>${esc(S.permsDesc[pk])}</td>${S.roles.map(r => `<td style="text-align:center">${r.perms.includes(pk) ? '<b style="color:var(--ok)">✓</b>' : '<span class="muted">—</span>'}</td>`).join('')}</tr>`).join('')}
    </tbody></table></div>
  </section>`;
}
function tempPassword(){ const a = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'; const b = new Uint32Array(14); crypto.getRandomValues(b); return Array.from(b, x => a[x % a.length]).join(''); }
const AUDIT_LBL = {'auth.login':'Connexion', 'auth.login_failed':'Connexion refusée', 'auth.logout':'Déconnexion', 'reception.arrivee':'Arrivée', 'reception.qc':'Contrôle qualité', 'reception.pesee_entree':'Pesée entrée', 'reception.dechargement':'Déchargement', 'reception.pesee_sortie':'Pesée sortie', 'reception.annulation':'Annulation réception', 'photo.upload':'Photo envoyée', 'config.update':'Listes modifiées', 'achats.commande':'Commande créée', 'achats.rattachement':'Réception rattachée', 'achats.detachement':'Réception détachée', 'achats.facture':'Facture', 'achats.facture_suppression':'Facture supprimée', 'achats.paiement':'Paiement', 'achats.paiement_debite':'Paiement débité', 'achats.paiement_suppression':'Paiement supprimé', 'achats.statut':'Statut commande', 'achats.config':'Paramètres comptables', 'user.create':'Utilisateur créé', 'user.update':'Utilisateur modifié', 'user.password_change':'Mot de passe changé', 'user.create_admin':'Admin créé (console)'};
function vAudit(){
  return `<section class="stackcol"><div class="sec-h"><div><h2>Journal des actions</h2><div class="muted" style="font-size:13.5px">Les 300 dernières actions : qui, quoi, quand, depuis quelle adresse.</div></div><div class="sp"><button class="btn sm" type="button" data-auditload>Actualiser</button></div></div>
    ${!S.auditLoaded ? '<div class="lane-empty">Chargement…</div>' : `<div class="panel tbl-wrap" style="max-height:480px"><table style="min-width:760px"><thead><tr><th>Date</th><th>Utilisateur</th><th>Action</th><th>Objet</th><th>Détail</th><th>Adresse</th></tr></thead><tbody>
      ${S.audit.map(a => `<tr style="cursor:default"><td class="num">${dmy(a.at)} ${hm(a.at)}</td><td>${esc(a.username || '—')}</td><td>${a.action === 'auth.login_failed' ? '<span class="chip bad">Connexion refusée</span>' : esc(AUDIT_LBL[a.action] || a.action)}</td><td class="mono">${esc(a.target)}</td><td style="white-space:normal;min-width:200px">${esc(a.detail)}</td><td class="mono muted">${esc(a.ip)}</td></tr>`).join('')}
    </tbody></table></div>`}</section>`;
}

function vSettingsLists(){
  const list = (key, title, hint, ph, extra = '') => `<section class="panel set"><h3>${title}</h3><span class="muted" style="font-size:13px">${hint}</span>
    <div class="tags">${S.cfg[key].length ? S.cfg[key].map((v, i) => `<span class="tag"><span>${esc(v)}</span>${can('config.write') ? `<button type="button" data-del="${key}:${i}" aria-label="Retirer ${esc(v)}">${ICON.x}</button>` : ''}</span>`).join('') : '<span class="muted" style="font-size:13.5px">Liste vide.</span>'}</div>
    ${can('config.write') ? `<form class="add" data-add="${key}"><input class="input" id="add-${key}" placeholder="${ph}" maxlength="80" aria-label="Ajouter à ${title}"><button class="btn dark" type="submit">Ajouter</button></form>` : ''}${extra}</section>`;
  return `<div class="view">
    ${!S.cfgLoaded ? `<div class="lane-empty">Chargement…</div>` : `
      ${list('matieres', 'Matières premières', 'Types de caoutchouc et grades reçus.', 'ex. SBR 1502')}
      ${list('fournisseurs', 'Fournisseurs', 'Proposés à l’arrivée ; on peut aussi en saisir un nouveau directement.', 'Nom du fournisseur')}
      ${list('zones', 'Zones de stockage', 'Magasins, allées ou zones où l’on décharge.', 'ex. Magasin MP – Zone A')}
      ${list('qcTests', 'Mesures du contrôle qualité', 'Champs facultatifs proposés au contrôleur à l’entrée (humidité, dureté…).', 'ex. Dureté Shore A',
        can('config.write') && !S.cfg.qcTests.length ? `<button class="btn" type="button" data-qcdefaults>Ajouter les tests courants du caoutchouc</button>` : '')}
      ${can('achats.write') ? `<section class="panel set"><h3>Comptabilité</h3><span class="muted" style="font-size:13px">Visible seulement par la comptabilité et l’administrateur.</span>
        <span class="label">Banques d’Évia</span>
        <div class="tags">${S.ccfg.banques.length ? S.ccfg.banques.map((b, i) => `<span class="tag"><span>${esc(b)}</span><button type="button" data-delbank="${i}" aria-label="Retirer ${esc(b)}">${ICON.x}</button></span>`).join('') : '<span class="muted" style="font-size:13.5px">Aucune banque.</span>'}</div>
        <form class="add" id="bankForm"><input class="input" id="bankIn" placeholder="ex. BIAT – compte principal" maxlength="80" aria-label="Ajouter une banque"><button class="btn dark" type="submit">Ajouter</button></form>
        <span class="label" style="margin-top:6px">Retenue à la source</span>
        <form class="add" id="rsForm" style="flex-wrap:wrap"><input class="input" id="rsTaux" inputmode="decimal" style="max-width:90px" value="${esc(String(S.ccfg.rsTaux).replace('.', ','))}" aria-label="Taux de retenue en %"><span style="align-self:center">% dès</span><input class="input" id="rsSeuil" inputmode="decimal" style="max-width:120px" value="${esc(String(S.ccfg.rsSeuil).replace('.', ','))}" aria-label="Seuil en TND"><span style="align-self:center">TND TTC</span><button class="btn dark" type="submit">Enregistrer</button></form>
        <span class="hint">Proposée automatiquement sur les paiements en TND au-delà du seuil. Faites valider taux et seuil par votre expert-comptable.</span></section>` : ''}
      <section class="panel set"><h3>Tolérance écart BL</h3><span class="muted" style="font-size:13px">Au-delà, l’écart entre le poids net pesé et le poids du bon de livraison est signalé en rouge.</span>
        <form class="add" id="tolForm"><input class="input" id="tol" inputmode="decimal" value="${esc(String(S.cfg.toleranceBL).replace('.', ','))}" aria-label="Tolérance en pourcent" ${can('config.write') ? '' : 'disabled'}><span style="align-self:center">%</span>${can('config.write') ? '<button class="btn dark" type="submit">Enregistrer</button>' : ''}</form></section>
    </div>`}</div>`;
}

/* ---------- Achats & paiements (comptabilité) ----------
   Bon de commande → réceptions bascule rattachées → facture fournisseur → rapprochement → paiement → échéances.
   Stocké sous compta/… : lisible et modifiable seulement au niveau Éditeur (règle db). */
const DEVISES = ['TND', 'EUR', 'USD'];
const TVAS = [[19, '19 %'], [13, '13 %'], [7, '7 %'], [0, '0 % · suspension / exonération']];
const CONDS = [['Comptant', 0], ['À la livraison', 0], ['30 jours', 30], ['60 jours', 60], ['90 jours', 90], ['30 jours fin de mois', 30, 1], ['60 jours fin de mois', 60, 1], ['Crédit documentaire (LC)', 0], ['Remise documentaire', 0]];
const MODES = {virement:'Virement bancaire', cheque:'Chèque', traite:'Traite (lettre de change)', lc:'Crédit documentaire (LC)', especes:'Espèces', autre:'Autre'};
const REF_LBL = {cheque:'N° du chèque', virement:'Réf. du virement', traite:'N° de la traite', especes:'N° du reçu', lc:'N° de la LC', autre:'Référence'};
const AVEC_ECH = ['cheque', 'traite', 'lc'];
const r3 = n => Math.round(n * 1000) / 1000;
const money = (n, dev = 'TND') => (n == null || !isFinite(n)) ? '—' : (dev === 'TND' ? nf3 : nf2).format(n) + ' ' + dev;
const toISO = ms => { if (!ms) return ''; const d = new Date(ms); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const fromISO = v => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v || ''); return m ? new Date(+m[1], +m[2] - 1, +m[3]).getTime() : null; };
const uid8 = () => Math.random().toString(36).slice(2, 10);
const kvg = (k, v) => v == null || v === '' ? '' : `<dt>${k}</dt><dd>${v}</dd>`;
const tnd = (c, v) => c.devise === 'TND' ? v : (c.taux ? v * c.taux : null);
function dueDate(ms, cond){ const c = CONDS.find(x => x[0] === cond); if (!c || !ms) return ms; const d = new Date(ms); d.setDate(d.getDate() + c[1]); if (c[2]) d.setMonth(d.getMonth() + 1, 0); return dayStart(d); }
function nextBC(){ const y = new Date().getFullYear(), pre = `BC-${y}-`; const mx = S.cmds.reduce((m, c) => c.numero?.startsWith(pre) ? Math.max(m, parseInt(c.numero.slice(pre.length), 10) || 0) : m, 0); return pre + String(mx + 1).padStart(3, '0'); }

function cmdCalc(c){
  const pk = (c.unite === 't' ? (c.prix || 0) / 1000 : (c.prix || 0));
  const recs = (c.receptions || []).map(id => S.recs.find(r => r.id === id)).filter(Boolean);
  const recu = recs.filter(r => r.status === 'cloture').reduce((s, r) => s + (r.net || 0), 0);
  const ht = (c.qteKg || 0) * pk, ttc = ht * (1 + (c.tva || 0) / 100), recuHT = recu * pk;
  const fact = c.factures || [], pay = c.paiements || [];
  const factHT = fact.reduce((s, f) => s + (f.ht || 0), 0), factTTC = fact.reduce((s, f) => s + (f.ttc || 0), 0);
  const paye = pay.reduce((s, x) => s + (x.montant || 0), 0);
  const eps = c.devise === 'TND' ? 0.0005 : 0.005;
  const reste = Math.max(0, factTTC - paye), avance = Math.max(0, paye - factTTC);
  // Les paiements soldent d'abord les factures les plus anciennes (échéance la plus proche)
  let left = paye, echu = 0; const dues = [], today = dayStart();
  [...fact].sort((a, b) => (a.echeance || 0) - (b.echeance || 0)).forEach(f => { const cov = Math.min(left, f.ttc || 0); left -= cov; const rest = (f.ttc || 0) - cov; if (rest > eps) { dues.push({f, rest}); if (f.echeance && f.echeance < today) echu += rest; } });
  const liv = recu <= 0 ? ['Non livrée', 'neutral'] : recu < (c.qteKg || 0) * 0.98 ? ['Livraison partielle', 'unload'] : ['Livrée', 'ok'];
  const payS = c.statut === 'annulee' ? ['Annulée', 'bad'] : !fact.length && !paye ? ['Non facturée', 'neutral'] : !fact.length ? ['Avance versée', 'unload'] : reste <= eps ? ['Payée', 'ok'] : echu > eps ? ['En retard', 'bad'] : paye > 0 ? ['Partiellement payée', 'wait'] : ['À payer', 'wait'];
  const ecart3 = factHT > 0 && recuHT > 0 ? (factHT - recuHT) / recuHT * 100 : null;
  return {pk, recs, recu, ht, ttc, recuHT, factHT, factTTC, paye, reste, avance, echu: echu > eps ? echu : 0, dues, liv, payS, ecart3, eps, resteLiv: Math.max(0, (c.qteKg || 0) - recu)};
}

function cmdRow(c, k){
  const pct = c.qteKg ? Math.min(100, k.recu / c.qteKg * 100) : 0;
  const st = c.statut === 'soldee' ? '<span class="chip ok">Soldée</span>' : c.statut === 'annulee' ? '' : `<span class="chip ${k.liv[1]}">${k.liv[0]}</span>`;
  return `<button class="cmdrow" type="button" data-cmd="${c.id}">
    <div class="cr-top"><b class="mono">${esc(c.numero)}</b><span class="cr-f">${esc(c.fournisseur)}</span>${st}<span class="chip ${k.payS[1]}">${k.payS[0]}</span></div>
    <div class="meta"><span><b>${esc(c.matiere)}</b></span><span class="mono">${tn(k.recu)} / ${tn(c.qteKg)} t reçues</span>${c.livraisonPrevue && k.liv[0] !== 'Livrée' && c.statut === 'ouverte' ? `<span class="muted">livraison prévue ${dmy(c.livraisonPrevue)}</span>` : ''}</div>
    <div class="track"><i style="width:${pct.toFixed(1)}%"></i></div>
    <div class="cr-money"><span><span class="label">Commande TTC</span><b>${money(k.ttc, c.devise)}</b></span><span><span class="label">Payé</span><b>${money(k.paye, c.devise)}</b></span><span><span class="label">Reste à payer</span><b style="${k.echu ? 'color:var(--bad)' : ''}">${money(k.reste, c.devise)}</b></span></div>
  </button>`;
}

function vAchats(){
  if (!can('achats.read')) return `<div class="view"><div class="notice">Section réservée à la comptabilité.</div></div>`;
  if (S.cmdErr) return `<div class="view"><div class="notice bad">Impossible de lire les commandes. Vérifiez la connexion.</div></div>`;
  const K = new Map(S.cmds.map(c => [c.id, cmdCalc(c)]));
  const live = S.cmds.filter(c => c.statut !== 'annulee');
  const t0 = dayStart(), t7 = t0 + 7 * 864e5;
  let resteLiv = 0, reste = 0, echu = 0, semaine = 0, noRate = 0;
  live.forEach(c => { const k = K.get(c.id); if (c.statut === 'ouverte') resteLiv += k.resteLiv; if (k.reste > 0 && !c.taux && c.devise !== 'TND') { noRate++; return; }
    reste += tnd(c, k.reste) || 0; echu += tnd(c, k.echu) || 0; k.dues.forEach(d => { if (d.f.echeance >= t0 && d.f.echeance < t7) semaine += tnd(c, d.rest) || 0; }); });
  const q = S.ach.q.trim().toLowerCase();
  const list = S.cmds.filter(c => { const k = K.get(c.id); return S.ach.f === 'ouvertes' ? c.statut === 'ouverte' : S.ach.f === 'apayer' ? c.statut !== 'annulee' && (k.reste > k.eps) : S.ach.f === 'soldees' ? c.statut === 'soldee' : true; })
    .filter(c => !q || [c.numero, c.fournisseur, c.matiere, c.refFournisseur, ...(c.factures || []).map(f => f.numero), ...(c.paiements || []).map(x => x.reference)].join(' ').toLowerCase().includes(q));
  const items = [];
  live.forEach(c => { const k = K.get(c.id);
    k.dues.forEach(d => items.push({c, at:d.f.echeance, lbl:'Facture ' + d.f.numero, amt:d.rest}));
    (c.paiements || []).forEach(x => { if (AVEC_ECH.includes(x.mode) && x.statut === 'emis') items.push({c, at:x.echeance || x.date, lbl:MODES[x.mode] + (x.reference ? ' n° ' + x.reference : '') + (x.banque ? ' · ' + x.banque : ''), amt:(x.montant || 0) - (x.rs || 0), p:x}); }); });
  items.sort((a, b) => (a.at || 9e15) - (b.at || 9e15));
  const linked = new Set(live.flatMap(c => c.receptions || []));
  const orphans = S.recs.filter(r => r.status === 'cloture' && !linked.has(r.id)).sort((a, b) => b.createdAt - a.createdAt);
  const F = [['ouvertes', 'Ouvertes'], ['apayer', 'À payer'], ['soldees', 'Soldées'], ['toutes', 'Toutes']];
  return `<div class="view">
    <div class="sec-h"><div><h2>Achats &amp; paiements</h2><div class="muted" style="font-size:13.5px">Commandes fournisseurs, livraisons pesées, factures et règlements. Visible seulement par la comptabilité et la direction.</div></div>
      <div class="sp" style="display:flex;gap:8px;flex-wrap:wrap">${can('export') ? `<button class="btn" type="button" data-exp="cmds" ${S.cmds.length ? '' : 'disabled'}>${ICON.dl} Commandes</button><button class="btn" type="button" data-exp="pays" ${S.cmds.length ? '' : 'disabled'}>${ICON.dl} Paiements</button>` : ''}${can('achats.write') ? '<button class="btn primary" type="button" data-newcmd>+ Nouvelle commande</button>' : ''}</div></div>
    <div class="strip">
      <div><span class="label">Commandes ouvertes</span><b class="num">${S.cmds.filter(c => c.statut === 'ouverte').length}</b></div>
      <div><span class="label">Reste à livrer</span><b class="num">${tn(resteLiv)} <small>t</small></b></div>
      <div><span class="label">Reste à payer</span><b class="num">${nf3.format(reste)} <small>TND</small></b></div>
      <div><span class="label">Échu non payé</span><b class="num" style="${echu ? 'color:var(--bad)' : ''}">${nf3.format(echu)} <small>TND</small></b></div>
      <div><span class="label">À payer sous 7 jours</span><b class="num">${nf3.format(semaine)} <small>TND</small></b></div>
    </div>
    ${noRate ? `<div class="notice">${noRate} commande(s) en devise sans taux de change ne sont pas comptées dans les totaux en TND.</div>` : ''}
    <div class="split">
      <section class="stackcol">
        <div class="filters"><div class="pills" role="group">${F.map(([k, l]) => `<button type="button" data-af="${k}" aria-pressed="${S.ach.f === k}">${l}</button>`).join('')}</div>
          <input class="input search" id="aq" type="search" placeholder="N° BC, fournisseur, facture, chèque…" value="${esc(S.ach.q)}" aria-label="Rechercher une commande"></div>
        ${!S.cmdLoaded ? '<div class="lane-empty">Chargement des commandes…</div>' : list.length ? list.map(c => cmdRow(c, K.get(c.id))).join('')
          : `<div class="panel empty"><h3>${S.cmds.length ? 'Aucune commande dans ce filtre' : 'Aucune commande enregistrée'}</h3><span>Créez un bon de commande pour chaque achat de matière : les réceptions pesées s’y rattachent, puis les factures et les paiements.</span>${S.cmds.length || !can('achats.write') ? '' : '<button class="btn primary" type="button" data-newcmd>+ Nouvelle commande</button>'}</div>`}
      </section>
      <aside class="stackcol">
        <div class="lane-h"><h2>Échéances</h2><span class="n">${items.length}</span></div>
        ${items.length ? `<div class="panel echs">${items.slice(0, 14).map(it => `<div class="ech ${it.at && it.at < t0 ? 'late' : ''}"><button class="go" type="button" data-cmd="${it.c.id}"><span class="d">${it.at ? dmy(it.at) : 'sans date'}</span><span style="min-width:0"><b>${esc(it.lbl)}</b><br><span class="muted" style="font-size:12.5px">${esc(it.c.numero)} · ${esc(it.c.fournisseur)}</span></span><span class="a">${money(it.amt, it.c.devise)}</span></button>${it.p && can('achats.write') ? `<button class="btn sm" type="button" data-debit="${it.c.id}:${it.p.id}" title="Le montant a été débité du compte bancaire">Débité</button>` : ''}</div>`).join('')}</div>`
          : '<div class="lane-empty">Aucune facture à régler ni chèque en circulation.</div>'}
        <div class="lane-h" style="margin-top:8px"><h2>Réceptions sans commande</h2><span class="n">${orphans.length}</span></div>
        ${orphans.length ? `<div class="panel orphs">${orphans.slice(0, 8).map(r => { const cands = S.cmds.filter(c => c.statut === 'ouverte' && c.fournisseur.trim().toLowerCase() === (r.fournisseur || '').trim().toLowerCase());
          return `<div class="orph"><div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">${plate(r.plate)}<span class="ticket">${esc(r.ticket)} · ${dmy(r.createdAt)}</span></div>
            <div class="meta"><b>${esc(r.matiere)}</b><span>${esc(r.fournisseur)}</span><span class="mono">${kg(r.net)}</span>${r.bl ? `<span class="muted">BL ${esc(r.bl)}</span>` : ''}</div>
            ${!can('achats.write') ? '' : cands.length ? `<form class="add" data-linkrec="${r.id}"><select class="input" id="lk-${r.id}" aria-label="Commande à rattacher">${cands.map(c => `<option value="${c.id}">${esc(c.numero)} · ${esc(c.matiere)}</option>`).join('')}</select><button class="btn dark" type="submit">Rattacher</button></form>` : '<span class="hint">Aucune commande ouverte pour ce fournisseur.</span>'}</div>`; }).join('')}${orphans.length > 8 ? `<div class="orph muted" style="font-size:13px">+ ${orphans.length - 8} autres réceptions</div>` : ''}</div>`
          : '<div class="lane-empty">Toutes les réceptions sont rattachées à une commande.</div>'}
      </aside>
    </div>
  </div>`;
}

function cmdForm(){
  const today = toISO(Date.now());
  return `<form class="form" id="f">
    <div class="row"><div class="field"><label for="cf_fourn">Fournisseur <em>*</em></label><input class="input" id="cf_fourn" list="dl-f2" required autocomplete="off"><datalist id="dl-f2">${S.cfg.fournisseurs.map(x => `<option value="${esc(x)}">`).join('')}</datalist></div>
      <div class="field"><label for="cf_date">Date de commande</label><input class="input" id="cf_date" type="date" value="${today}"></div></div>
    <div class="field"><label for="cf_mat">Matière <em>*</em></label>${S.cfg.matieres.length ? `<select class="input" id="cf_mat" required><option value="">Choisir…</option>${opts(S.cfg.matieres)}</select>` : '<input class="input" id="cf_mat" required>'}</div>
    <div class="row"><div class="field"><label for="cf_qte">Quantité commandée (kg) <em>*</em></label><input class="input mono" id="cf_qte" inputmode="decimal" autocomplete="off" placeholder="ex. 20000"></div>
      <div class="field"><label for="cf_liv">Livraison prévue</label><input class="input" id="cf_liv" type="date"></div></div>
    <div class="row"><div class="field"><label for="cf_prix">Prix unitaire HT <em>*</em></label><input class="input mono" id="cf_prix" inputmode="decimal" autocomplete="off"></div>
      <div class="field"><label for="cf_unite">Unité de prix</label><select class="input" id="cf_unite"><option value="t">par tonne</option><option value="kg">par kg</option></select></div></div>
    <div class="row"><div class="field"><label for="cf_dev">Devise</label><select class="input" id="cf_dev">${DEVISES.map(d => `<option>${d}</option>`).join('')}</select></div>
      <div class="field" id="cf_tauxw" hidden><label for="cf_taux">Taux de change (1 devise = ? TND) <em>*</em></label><input class="input mono" id="cf_taux" inputmode="decimal" autocomplete="off"></div></div>
    <div class="row"><div class="field"><label for="cf_tva">TVA</label><select class="input" id="cf_tva">${TVAS.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select></div>
      <div class="field"><label for="cf_cond">Conditions de paiement</label><select class="input" id="cf_cond">${CONDS.map(c => `<option>${c[0]}</option>`).join('')}</select></div></div>
    <div class="field"><label for="cf_ref">Réf. proforma / contrat fournisseur</label><input class="input mono" id="cf_ref" autocomplete="off"></div>
    <div class="field"><label for="cf_notes">Notes</label><textarea class="input" id="cf_notes" placeholder="Incoterm, transitaire, conditions particulières…"></textarea></div>
    <div class="calc"><div><span class="label">Montant HT</span><b id="cf_ht">—</b></div><div><span class="label">TVA</span><b id="cf_tv">—</b></div><div><span class="label">Montant TTC</span><b id="cf_ttc">—</b></div></div>
    <div class="err" id="err"></div>
    <button class="btn primary block" type="submit">Créer le bon de commande</button></form>`;
}
function updCmdForm(){
  const dev = $('#cf_dev')?.value; if (!dev) return;
  $('#cf_tauxw').hidden = dev === 'TND';
  const q = parseKg($('#cf_qte').value), pr = parseKg($('#cf_prix').value), tva = +$('#cf_tva').value;
  const ht = q != null && pr != null ? q * ($('#cf_unite').value === 't' ? pr / 1000 : pr) : null;
  $('#cf_ht').textContent = money(ht, dev); $('#cf_tv').textContent = ht == null ? '—' : money(ht * tva / 100, dev); $('#cf_ttc').textContent = ht == null ? '—' : money(ht * (1 + tva / 100), dev);
}

function cmdBody(c){
  const k = cmdCalc(c), dev = c.devise, sh = S.sheet, editable = c.statut !== 'annulee' && can('achats.write');
  const cands = editable ? S.recs.filter(r => r.status === 'cloture' && !(c.receptions || []).includes(r.id) && !S.cmds.some(o => o.id !== c.id && o.statut !== 'annulee' && (o.receptions || []).includes(r.id)) && (r.fournisseur || '').trim().toLowerCase() === c.fournisseur.trim().toLowerCase()) : [];
  const del = (kind, id) => sh.del === kind + ':' + id ? `<button class="btn danger sm" type="button" data-del${kind}="${id}">Supprimer ?</button>` : `<button class="x" type="button" data-del${kind}="${id}" aria-label="Supprimer">${ICON.x}</button>`;
  const e3 = k.ecart3, today = toISO(Date.now());
  const defHT = Math.max(0, k.recuHT - k.factHT), defPay = (c.factures || []).length ? k.reste : Math.max(0, k.ttc - k.paye);
  return `
  <div class="calc wide">
    <div><span class="label">Commandé</span><b>${tn(c.qteKg)} t</b></div><div><span class="label">Reçu (bascule)</span><b>${tn(k.recu)} t</b></div>
    <div><span class="label">Commande TTC</span><b>${money(k.ttc, dev)}</b></div><div><span class="label">Facturé TTC</span><b>${money(k.factTTC, dev)}</b></div>
    <div><span class="label">Payé</span><b>${money(k.paye, dev)}</b></div><div><span class="label">Reste à payer</span><b style="${k.echu ? 'color:var(--bad)' : ''}">${money(k.reste, dev)}</b></div>
  </div>
  ${k.echu ? `<div class="notice bad"><b>${money(k.echu, dev)}</b> échus et non payés.</div>` : ''}
  ${k.avance > k.eps ? `<div class="notice">Avance de ${money(k.avance, dev)} versée au-delà des factures reçues.</div>` : ''}
  ${e3 != null ? (Math.abs(e3) > 1 ? `<div class="notice">Rapprochement : le HT facturé (${money(k.factHT, dev)}) s’écarte de <b>${(e3 > 0 ? '+' : '') + nf2.format(e3)} %</b> de la valeur pesée à la bascule (${money(k.recuHT, dev)}). Vérifiez la facture avant de payer.</div>`
    : `<div class="muted" style="font-size:13px">Rapprochement commande / réception / facture : écart ${(e3 > 0 ? '+' : '') + nf2.format(e3)} %, conforme.</div>`) : ''}
  <dl class="kv">${kvg('Date', dmy(c.date))}${kvg('Matière', esc(c.matiere))}${kvg('Prix HT', money(c.prix, dev) + (c.unite === 't' ? ' / tonne' : ' / kg'))}${kvg('TVA', c.tva + ' %')}${dev !== 'TND' ? kvg('Taux de change', c.taux ? `1 ${dev} = ${nf3.format(c.taux)} TND` : 'non renseigné') : ''}${kvg('Conditions', esc(c.conditions))}${kvg('Livraison prévue', c.livraisonPrevue ? dmy(c.livraisonPrevue) : '')}${kvg('Réf. fournisseur', esc(c.refFournisseur))}${kvg('Notes', esc(c.notes))}${kvg('Créée par', esc((c.createdByName || '—')))}</dl>

  <section class="stackcol"><div class="sec-t"><h3>Livraisons pesées</h3><span class="muted">${k.recs.length} réception${k.recs.length > 1 ? 's' : ''}</span></div>
    ${k.recs.length ? `<div class="lines">${k.recs.map(r => `<div class="line"><span><b class="mono">${esc(r.ticket)}</b> · ${dmy(r.createdAt)} · ${esc(r.plate)}<br><span class="muted">${esc(ST[r.status]?.label || '')}${r.bl ? ' · BL ' + esc(r.bl) : ''}${r.qc?.decision === 'reserve' ? ' · accepté avec réserve' : ''}</span></span><span class="mono">${r.net != null ? kg(r.net) : '—'}</span>${editable ? `<button class="x" type="button" data-unlink="${r.id}" aria-label="Détacher la réception">${ICON.x}</button>` : '<span></span>'}</div>`).join('')}</div>` : '<span class="muted" style="font-size:13.5px">Aucune réception rattachée.</span>'}
    ${cands.length ? `<form class="add" id="linkForm"><select class="input" id="lk" aria-label="Réception à rattacher">${cands.map(r => `<option value="${r.id}">${esc(r.ticket)} · ${dmy(r.createdAt)} · ${esc(r.matiere)} · ${kg(r.net)}</option>`).join('')}</select><button class="btn dark" type="submit">Rattacher</button></form>` : ''}
  </section>

  <section class="stackcol"><div class="sec-t"><h3>Factures fournisseur</h3>${editable && sh.sub !== 'fact' ? '<button class="btn sm" type="button" data-sub="fact">+ Ajouter une facture</button>' : ''}</div>
    ${(c.factures || []).length ? `<div class="lines">${c.factures.map(f => `<div class="line"><span><b>N° ${esc(f.numero)}</b> · ${dmy(f.date)}<br><span class="muted">HT ${money(f.ht, dev)} · TVA ${f.tva} %${f.timbre ? ' · timbre ' + money(f.timbre, dev) : ''} · échéance ${f.echeance ? dmy(f.echeance) : '—'}</span></span><span class="mono">${money(f.ttc, dev)}</span>${editable ? del('fact', f.id) : '<span></span>'}</div>`).join('')}</div>` : (sh.sub === 'fact' ? '' : '<span class="muted" style="font-size:13.5px">Aucune facture reçue.</span>')}
    ${sh.sub === 'fact' ? `<form class="sub" id="factForm">
      <div class="row"><div class="field"><label for="ff_num">N° de facture <em>*</em></label><input class="input mono" id="ff_num" autocomplete="off"></div><div class="field"><label for="ff_date">Date de facture <em>*</em></label><input class="input" id="ff_date" type="date" value="${today}"></div></div>
      <div class="row"><div class="field"><label for="ff_ht">Montant HT (${dev}) <em>*</em></label><input class="input mono" id="ff_ht" inputmode="decimal" autocomplete="off" value="${defHT ? (dev === 'TND' ? defHT.toFixed(3) : defHT.toFixed(2)).replace('.', ',') : ''}"><span class="hint">Proposé : quantité pesée non facturée × prix.</span></div>
        <div class="field"><label for="ff_tva">TVA</label><select class="input" id="ff_tva">${TVAS.map(([v, l]) => `<option value="${v}" ${v === c.tva ? 'selected' : ''}>${l}</option>`).join('')}</select></div></div>
      <div class="row">${dev === 'TND' ? '<label class="check" style="align-self:end;min-height:44px"><input type="checkbox" id="ff_timbre" checked> Timbre fiscal 1,000 TND</label>' : '<span></span>'}
        <div class="field"><label for="ff_ech">Échéance</label><input class="input" id="ff_ech" type="date" value="${toISO(dueDate(Date.now(), c.conditions))}"><span class="hint">Calculée selon « ${esc(c.conditions)} ».</span></div></div>
      <div class="calc"><div><span class="label">HT</span><b id="ff_v1">—</b></div><div><span class="label">TVA</span><b id="ff_v2">—</b></div><div><span class="label">TTC</span><b id="ff_v3">—</b></div></div>
      <div class="err" id="ferr"></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn primary" type="submit">Enregistrer la facture</button><button class="btn ghost" type="button" data-sub="">Annuler</button></div></form>` : ''}
  </section>

  <section class="stackcol"><div class="sec-t"><h3>Paiements</h3>${editable && sh.sub !== 'pay' ? '<button class="btn sm" type="button" data-sub="pay">+ Enregistrer un paiement</button>' : ''}</div>
    ${(c.paiements || []).length ? `<div class="lines">${c.paiements.map(x => `<div class="line"><span><b>${MODES[x.mode] || esc(x.mode)}</b>${x.reference ? ' n° ' + esc(x.reference) : ''} · ${dmy(x.date)}<br><span class="muted">${x.banque ? esc(x.banque) + ' · ' : ''}${x.echeance ? 'échéance ' + dmy(x.echeance) + ' · ' : ''}${x.rs ? 'retenue ' + money(x.rs, dev) + ' · ' : ''}${x.statut === 'emis' ? '<b style="color:var(--wait)">émis, pas encore débité</b>' : 'débité'}</span></span><span class="mono">${money(x.montant, dev)}</span><span style="display:flex;gap:4px;align-items:center">${x.statut === 'emis' && editable ? `<button class="btn sm" type="button" data-debit="${c.id}:${x.id}">Débité</button>` : ''}${editable ? del('pay', x.id) : ''}</span></div>`).join('')}</div>` : (sh.sub === 'pay' ? '' : '<span class="muted" style="font-size:13.5px">Aucun paiement enregistré.</span>')}
    ${sh.sub === 'pay' ? `<form class="sub" id="payForm">
      <div class="row"><div class="field"><label for="fp_date">Date du paiement <em>*</em></label><input class="input" id="fp_date" type="date" value="${today}"></div>
        <div class="field"><label for="fp_mont">Montant réglé TTC (${dev}) <em>*</em></label><input class="input mono" id="fp_mont" inputmode="decimal" autocomplete="off" value="${defPay > k.eps ? (dev === 'TND' ? defPay.toFixed(3) : defPay.toFixed(2)).replace('.', ',') : ''}"></div></div>
      <div class="row"><div class="field"><label for="fp_mode">Mode de paiement <em>*</em></label><select class="input" id="fp_mode">${Object.entries(MODES).map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select></div>
        <div class="field"><label for="fp_ref" id="fp_refl">Réf. du virement</label><input class="input mono" id="fp_ref" autocomplete="off"></div></div>
      <div class="row"><div class="field"><label for="fp_bank">Banque</label><input class="input" id="fp_bank" list="dl-bank" autocomplete="off"><datalist id="dl-bank">${S.ccfg.banques.map(b => `<option value="${esc(b)}">`).join('')}</datalist></div>
        <div class="field" id="fp_echw" hidden><label for="fp_ech">Date d’échéance (encaissement)</label><input class="input" id="fp_ech" type="date" value="${today}"></div></div>
      ${dev === 'TND' ? `<label class="check"><input type="checkbox" id="fp_rs"> Retenue à la source ${nf2.format(S.ccfg.rsTaux)} % (certificat à remettre au fournisseur)</label>` : ''}
      <div class="calc"><div><span class="label">Montant réglé</span><b id="fp_v1">—</b></div><div><span class="label">Retenue</span><b id="fp_v2">—</b></div><div><span class="label">Net à décaisser</span><b id="fp_v3">—</b></div></div>
      <div class="err" id="perr"></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn primary" type="submit">Enregistrer le paiement</button><button class="btn ghost" type="button" data-sub="">Annuler</button></div></form>` : ''}
  </section>

  ${!can('achats.write') ? '' : `<div style="display:flex;gap:8px;flex-wrap:wrap">
    ${c.statut === 'ouverte' ? `<button class="btn" type="button" data-cmdstat="soldee" title="Livraison et paiement terminés">Marquer la commande soldée</button>` : c.statut === 'soldee' ? '<button class="btn" type="button" data-cmdstat="ouverte">Rouvrir la commande</button>' : ''}
  </div>
  ${c.statut === 'annulee' ? `<div class="notice bad">Commande annulée${c.annulation?.motif ? ' : ' + esc(c.annulation.motif) : ''}.</div>`
    : sh.confirm ? `<form class="confirm" id="cancelCmdForm"><b>Annuler la commande ${esc(c.numero)} ?</b><span style="font-size:13.5px">Les réceptions rattachées redeviennent « sans commande ». L’historique est conservé.</span><input class="input" id="cmotif" required placeholder="Motif (ex. fournisseur n’a pas livré)"><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn danger" type="submit">Confirmer l’annulation</button><button class="btn ghost" type="button" data-cmdcancel="no">Garder</button></div></form>`
    : '<button class="btn ghost" type="button" data-cmdcancel="ask" style="color:var(--bad);align-self:flex-start">Annuler la commande…</button>'}`}`;
}
function curCmd(){ return S.sheet?.kind === 'cmd' ? S.cmds.find(x => x.id === S.sheet.id) : null; }
function updFact(){
  const c = curCmd(); if (!c || !$('#ff_ht')) return;
  const ht = parseKg($('#ff_ht').value), tva = +$('#ff_tva').value, tb = $('#ff_timbre')?.checked ? 1 : 0;
  $('#ff_v1').textContent = money(ht, c.devise); $('#ff_v2').textContent = ht == null ? '—' : money(ht * tva / 100, c.devise); $('#ff_v3').textContent = ht == null ? '—' : money(r3(ht * (1 + tva / 100) + tb), c.devise);
}
function updPay(){
  const c = curCmd(); if (!c || !$('#fp_mont')) return;
  const m = parseKg($('#fp_mont').value), mode = $('#fp_mode').value, rs = $('#fp_rs')?.checked ? r3((m || 0) * S.ccfg.rsTaux / 100) : 0;
  $('#fp_refl').textContent = REF_LBL[mode]; $('#fp_echw').hidden = !AVEC_ECH.includes(mode);
  $('#fp_v1').textContent = money(m, c.devise); $('#fp_v2').textContent = money(rs, c.devise); $('#fp_v3').textContent = m == null ? '—' : money(m - rs, c.devise);
}
async function run(fn, msg){
  try { await fn(); if (msg) toast(msg); return true; }
  catch (e) { if (e.status !== 401) toast(e.message || 'Erreur', true); return false; }
}
const cmdUrl = (c, rest = '') => `/api/achats/commandes/${encodeURIComponent(c.id)}${rest}`;
async function cmdCall(method, url, body, msg){ const ok = await run(() => api(method, url, body), msg); if (ok) await loadAchats(); return ok; }
async function saveCcfg(patch){ if (await run(() => api('PUT', '/api/achats/config', patch), 'Paramètres comptables enregistrés')) await loadAchats(); }
function downloadFile(name, data, type = 'text/csv;charset=utf-8'){
  const url = URL.createObjectURL(new Blob([data], {type})); const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
}
const csvCell = v => { const x = v == null ? '' : String(v); return /[;"\n]/.test(x) ? '"' + x.replace(/"/g, '""') + '"' : x; };
const csvNum = v => v == null || !isFinite(v) ? '' : String(r3(v)).replace('.', ',');
async function saveCsv(name, head, rows){
  const csv = '﻿' + [head.join(';'), ...rows.map(r => r.map(csvCell).join(';'))].join('\r\n');
  const d = new Date(), st = d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
  downloadFile(`evia-${name}-${st}.csv`, csv); toast('Fichier exporté');
}
function exportAchats(kind){
  if (kind === 'cmds') {
    saveCsv('commandes', ['N° BC','Date','Fournisseur','Matière','Qté commandée (kg)','Prix HT','Unité','Devise','Taux TND','TVA %','Conditions','Montant HT','Montant TTC','Qté reçue (kg)','Valeur reçue HT','Facturé HT','Facturé TTC','Payé','Reste à payer','Échu','Livraison','Paiement','Statut','Factures','Réf. fournisseur'],
      S.cmds.map(c => { const k = cmdCalc(c); return [c.numero, dmy(c.date), c.fournisseur, c.matiere, csvNum(c.qteKg), csvNum(c.prix), c.unite === 't' ? 'tonne' : 'kg', c.devise, csvNum(c.taux), c.tva, c.conditions, csvNum(k.ht), csvNum(k.ttc), csvNum(k.recu), csvNum(k.recuHT), csvNum(k.factHT), csvNum(k.factTTC), csvNum(k.paye), csvNum(k.reste), csvNum(k.echu), k.liv[0], k.payS[0], {ouverte:'Ouverte', soldee:'Soldée', annulee:'Annulée'}[c.statut], (c.factures || []).map(f => f.numero).join(' | '), c.refFournisseur]; }));
  } else {
    const rows = []; S.cmds.forEach(c => (c.paiements || []).forEach(x => rows.push([dmy(x.date), c.numero, c.fournisseur, MODES[x.mode] || x.mode, x.reference, x.banque, x.echeance ? dmy(x.echeance) : '', x.statut === 'emis' ? 'Émis' : 'Débité', csvNum(x.montant), csvNum(x.rs || 0), csvNum((x.montant || 0) - (x.rs || 0)), c.devise])));
    saveCsv('paiements', ['Date','N° BC','Fournisseur','Mode','Référence','Banque','Échéance','Statut','Montant réglé','Retenue à la source','Net décaissé','Devise'], rows);
  }
}

/* ---------- Sheets (forms) ---------- */
function openSheet(kind, id){ S.sheet = {kind, id, confirm:false}; drawSheet(); }
function closeSheet(){ S.sheet = null; $('#sheetRoot').innerHTML = ''; }
function sheetWrap(title, sub, body){ return `<div class="scrim" data-scrim><div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="sheet-h"><div><h2>${title}</h2>${sub ? `<div style="margin-top:6px;display:flex;gap:8px;align-items:center;flex-wrap:wrap">${sub}</div>` : ''}</div><button class="x" type="button" data-close aria-label="Fermer">${ICON.x}</button></div>${body}</div></div>`; }
const opts = (arr, sel) => arr.map(v => `<option ${v === sel ? 'selected' : ''}>${esc(v)}</option>`).join('');
function lcd(cap, id, val, right){ return `<div class="lcd"><div class="cap"><span>${cap}</span><span>${right || 'kg'}</span></div><div class="val ${val == null ? 'ghost' : ''}" id="${id}">${val == null ? '0' : nf0.format(val)}<span class="u">kg</span></div></div>`; }

function drawSheet(){
  const sh = S.sheet; if (!sh) return;
  const isCmd = sh.kind === 'cmd';
  const r = sh.id && !isCmd ? S.recs.find(x => x.id === sh.id) : null;
  const c = isCmd ? S.cmds.find(x => x.id === sh.id) : null;
  if (sh.id && !r && !c) { closeSheet(); return; }
  let html = '';
  if (sh.kind === 'arrivee') {
    html = sheetWrap('Nouvelle arrivée', '<span class="muted">Le camion se présente au poste de garde.</span>', `<form class="form" id="f">
      <div class="field"><label for="plate">Matricule du camion <em>*</em></label><input class="input mono" id="plate" required autocomplete="off" placeholder="ex. 245 TU 1234" style="text-transform:uppercase"><span class="hint">Saisissez « série TU numéro » pour l’afficher comme une plaque tunisienne.</span></div>
      <div class="row"><div class="field"><label for="chauffeur">Chauffeur</label><input class="input" id="chauffeur" autocomplete="off"></div>
      <div class="field"><label for="tel">Téléphone</label><input class="input" id="tel" inputmode="tel" autocomplete="off"></div></div>
      <div class="field"><label for="fournisseur">Fournisseur <em>*</em></label><input class="input" id="fournisseur" list="dl-f" required autocomplete="off"><datalist id="dl-f">${S.cfg.fournisseurs.map(f => `<option value="${esc(f)}">`).join('')}</datalist></div>
      <div class="field"><label for="matiere">Matière première <em>*</em></label>${S.cfg.matieres.length ? `<select class="input" id="matiere" required><option value="">Choisir…</option>${opts(S.cfg.matieres)}</select>` : `<input class="input" id="matiere" required placeholder="Ajoutez la liste dans Paramètres">`}</div>
      <div class="row"><div class="field"><label for="bl">N° bon de livraison</label><input class="input mono" id="bl" autocomplete="off"></div>
      <div class="field"><label for="poidsBL">Poids net annoncé (BL)</label><input class="input mono" id="poidsBL" inputmode="numeric" placeholder="kg"></div></div>
      <div class="err" id="err"></div>
      <button class="btn primary block" type="submit">Enregistrer l’arrivée</button></form>`);
  } else if (sh.kind === 'pesee1') {
    html = sheetWrap('Pesée à l’entrée', `${plate(r.plate)} <span class="ticket">${esc(r.ticket)}</span>`, `<form class="form" id="f">
      <div class="meta"><span><b>${esc(r.matiere)}</b></span><span>${esc(r.fournisseur)}</span>${r.poidsBL ? `<span class="muted">BL ${kg(r.poidsBL)}</span>` : ''}</div>
      ${lcd('Poids brut · camion chargé', 'lcdv', null, 'Bascule')}
      <div class="row"><div class="field"><label for="kg">Poids brut affiché <em>*</em></label><input class="input mono" id="kg" inputmode="numeric" required placeholder="kg" autocomplete="off"></div>
      <div class="field"><label for="tb">N° ticket bascule</label><input class="input mono" id="tb" autocomplete="off"></div></div>
      <div class="err" id="err"></div>
      <button class="btn primary block" type="submit">Valider la pesée · envoyer au quai</button></form>`);
  } else if (sh.kind === 'dech') {
    html = sheetWrap('Déchargement au magasin', `${plate(r.plate)} <span class="ticket">${esc(r.ticket)}</span>`, `<form class="form" id="f">
      <div class="meta"><span><b>${esc(r.matiere)}</b></span><span>${esc(r.fournisseur)}</span><span>Brut <b class="mono">${kg(r.pesee1?.kg)}</b></span></div>
      <div class="field"><label for="zone">Zone de stockage <em>*</em></label>${S.cfg.zones.length ? `<select class="input" id="zone" required><option value="">Choisir…</option>${opts(S.cfg.zones)}</select>` : `<input class="input" id="zone" required>`}</div>
      <div class="row"><div class="field"><label for="colis">Nombre de balles / colis</label><input class="input mono" id="colis" inputmode="numeric" autocomplete="off"></div>
      <div class="field"><label for="lot">N° lot fournisseur</label><input class="input mono" id="lot" autocomplete="off"></div></div>
      <div class="field"><span style="font-size:13px;font-weight:600">Contrôle visuel <em style="color:var(--accent);font-style:normal">*</em></span><div class="seg" role="radiogroup">
        <input type="radio" name="q" id="q1" value="conforme" checked><label for="q1" class="q-ok">Conforme</label>
        <input type="radio" name="q" id="q2" value="reserve"><label for="q2" class="q-res">Avec réserve</label>
        <input type="radio" name="q" id="q3" value="non_conforme"><label for="q3" class="q-nc">Non conforme</label></div></div>
      <div class="field"><label for="rem">Remarque</label><textarea class="input" id="rem" placeholder="Emballage abîmé, humidité, balles manquantes…"></textarea></div>
      <div class="err" id="err"></div>
      <button class="btn dark block" type="submit">Déchargement terminé · renvoyer à la bascule</button></form>`);
  } else if (sh.kind === 'pesee2') {
    html = sheetWrap('Pesée à la sortie', `${plate(r.plate)} <span class="ticket">${esc(r.ticket)}</span>`, `<form class="form" id="f">
      ${lcd('Tare · camion vide', 'lcdv', null, 'Bascule')}
      <div class="row"><div class="field"><label for="kg">Tare affichée <em>*</em></label><input class="input mono" id="kg" inputmode="numeric" required placeholder="kg" autocomplete="off"></div>
      <div class="field"><label for="tb">N° ticket bascule</label><input class="input mono" id="tb" autocomplete="off"></div></div>
      <div class="calc"><div><span class="label">Brut</span><b>${kg(r.pesee1?.kg)}</b></div><div><span class="label">Net</span><b id="netv">—</b></div><div><span class="label">Écart BL</span><b id="ecv">${r.poidsBL ? '—' : 'pas de BL'}</b></div></div>
      <div class="muted" style="font-size:13px">${esc(r.matiere)} · ${esc(r.fournisseur)} → ${esc(r.dechargement?.zone)}</div>
      <div class="err" id="err"></div>
      <button class="btn primary block" type="submit">Valider · entrer en stock</button></form>`);
  } else if (sh.kind === 'cmdnew') {
    html = sheetWrap('Nouveau bon de commande', `<span class="ticket">${esc(nextBC())}</span>`, cmdForm());
  } else if (isCmd) {
    const k = cmdCalc(c);
    html = sheetWrap('Commande ' + esc(c.numero), `<b>${esc(c.fournisseur)}</b>${c.statut === 'soldee' ? '<span class="chip ok">Soldée</span>' : c.statut === 'annulee' ? '' : `<span class="chip ${k.liv[1]}">${k.liv[0]}</span>`}<span class="chip ${k.payS[1]}">${k.payS[0]}</span>`, cmdBody(c));
  } else if (sh.kind === 'qc') {
    html = sheetWrap('Contrôle qualité à l’entrée', `${plate(r.plate)} <span class="ticket">${esc(r.ticket)}</span>`, `<form class="form" id="f">
      <div class="meta"><span><b>${esc(r.matiere)}</b></span><span>${esc(r.fournisseur)}</span>${r.bl ? `<span class="muted">BL ${esc(r.bl)}</span>` : ''}${r.poidsBL ? `<span class="muted">${kg(r.poidsBL)} annoncés</span>` : ''}</div>
      <div class="field"><span style="font-size:13px;font-weight:600">Photos du chargement</span>
        ${can('qc.decide') ? `<div class="photos" id="ph"></div>
        <label class="btn" for="phIn" style="align-self:flex-start"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg> Prendre une photo</label>
        <input type="file" id="phIn" accept="image/*" capture="environment" multiple hidden>
        <span class="hint">Chargement, bâche, balles, plaque du camion. Plusieurs photos possibles.</span>`
        : `<span class="hint">Photos indisponibles sur cet appareil ou pour votre niveau d’accès.</span>`}</div>
      <div class="row"><div class="field"><label for="ech">N° échantillon (si prélevé)</label><input class="input mono" id="ech" autocomplete="off"></div>
        <label class="check" style="align-self:end;min-height:44px"><input type="checkbox" id="coa"> Certificat d’analyse (COA) fourni</label></div>
      ${S.cfg.qcTests.length ? `<div class="row">${S.cfg.qcTests.map((t, i) => `<div class="field"><label for="t${i}">${esc(t)}</label><input class="input mono" id="t${i}" autocomplete="off"></div>`).join('')}</div>` : ''}
      <div class="field"><span style="font-size:13px;font-weight:600">Décision <em style="color:var(--accent);font-style:normal">*</em></span><div class="seg" role="radiogroup">
        <input type="radio" name="d" id="d1" value="accepte"><label for="d1" class="q-ok">Accepter</label>
        <input type="radio" name="d" id="d2" value="reserve"><label for="d2" class="q-res">Avec réserve</label>
        <input type="radio" name="d" id="d3" value="refuse"><label for="d3" class="q-nc">Refuser</label></div></div>
      <div class="field"><label for="com">Commentaire</label><textarea class="input" id="com" placeholder="Obligatoire pour une réserve ou un refus"></textarea></div>
      <div class="err" id="err"></div>
      <button class="btn primary block" type="submit" style="background:var(--qc);border-color:var(--qc);color:var(--surface)">Valider le contrôle</button></form>`);
  } else if (sh.kind === 'detail') {
    html = sheetWrap('Réception ' + esc(r.ticket), `${plate(r.plate)} ${chip(r.status)}`, detailBody(r));
  }
  const prevFocus = document.activeElement?.id;
  $('#sheetRoot').innerHTML = html;
  const f = $('#f');
  if (f) {
    f.addEventListener('submit', onSubmit);
    const k = $('#kg');
    if (k) k.addEventListener('input', () => updateLcd(r));
    if (sh.kind === 'qc') { sh.photos = sh.photos || []; sh.uploading = 0; drawPhotos(); $('#phIn')?.addEventListener('change', onPhotos); }
    if (sh.kind === 'cmdnew') { f.addEventListener('input', updCmdForm); f.addEventListener('change', updCmdForm); updCmdForm(); }
    (f.querySelector('input:not([type=radio]),select'))?.focus({preventScroll:true});
  } else if (isCmd && sh.sub) {
    const sf = $(sh.sub === 'fact' ? '#factForm' : '#payForm');
    if (sf) { sf.addEventListener('input', sh.sub === 'fact' ? updFact : updPay); sf.addEventListener('change', sh.sub === 'fact' ? updFact : updPay); (sh.sub === 'fact' ? updFact : updPay)(); sf.querySelector('input')?.focus({preventScroll:true}); sf.scrollIntoView({block:'nearest'}); }
  } else if (prevFocus && document.getElementById(prevFocus)) document.getElementById(prevFocus).focus();
}

function updateLcd(r){
  const v = parseKg($('#kg').value), el = $('#lcdv');
  el.classList.toggle('ghost', v == null); el.innerHTML = (v == null ? '0' : nf0.format(v)) + '<span class="u">kg</span>';
  if (S.sheet.kind === 'pesee2') {
    const net = v == null ? null : r.pesee1.kg - v;
    $('#netv').textContent = net == null ? '—' : kg(net);
    if (r.poidsBL) { const e = net == null ? null : (net - r.poidsBL) / r.poidsBL * 100; const ev = $('#ecv');
      ev.textContent = e == null ? '—' : (e > 0 ? '+' : '') + nf2.format(e) + ' %'; ev.className = e == null ? '' : Math.abs(e) > S.cfg.toleranceBL ? 'ecart-bad' : 'ecart-ok'; }
  }
}

function detailBody(r){
  const ws = (lbl, step, cls, rows, extra) => `<div class="${cls}"><h3>${lbl}${step ? `<span>${dmy(step.at)} ${hm(step.at)} · ${esc(nameOf(step))}</span>` : ''}</h3>${rows ? `<dl class="kv">${rows}</dl>` : ''}${extra ? `<div style="margin-top:8px">${extra}</div>` : ''}</div>`;
  const kv = (k, v) => v == null || v === '' ? '' : `<dt>${k}</dt><dd>${v}</dd>`;
  const e = ecart(r), ql = QUAL[r.dechargement?.qualite];
  let tl = ws('Arrivée', r.arrivee, 'done', kv('Fournisseur', esc(r.fournisseur)) + kv('Matière', esc(r.matiere)) + kv('Chauffeur', esc(r.chauffeur)) + kv('Téléphone', esc(r.tel)) + kv('Bon de livraison', esc(r.bl)) + kv('Poids BL', r.poidsBL ? kg(r.poidsBL) : ''));
  const q = r.qc;
  tl += ws('Contrôle qualité', q, q ? (q.decision === 'refuse' ? 'bad' : 'done') : '', q ? kv('Décision', qcChip(r)) + kv('Commentaire', esc(q.commentaire)) + kv('Échantillon', esc(q.echantillon)) + kv('COA', q.coa ? 'Fourni' : 'Non fourni') + (q.resultats || []).map(x => kv(esc(x.test), `<span class="mono">${esc(x.valeur)}</span>`)).join('') : '', q?.photos?.length ? thumbs(q.photos) : '');
  tl += ws('Pesée entrée (brut)', r.pesee1, r.pesee1 ? 'done' : '', r.pesee1 ? kv('Brut', `<b class="mono">${kg(r.pesee1.kg)}</b>`) + kv('Ticket bascule', esc(r.pesee1.ticketBascule)) : '');
  tl += ws('Déchargement', r.dechargement, r.dechargement ? 'done' : '', r.dechargement ? kv('Zone', esc(r.dechargement.zone)) + kv('Balles / colis', esc(r.dechargement.colis)) + kv('Lot', esc(r.dechargement.lot)) + kv('Contrôle', ql ? `<span class="chip ${ql[1]}">${ql[0]}</span>` : '') + kv('Remarque', esc(r.dechargement.remarque)) : '');
  tl += ws('Pesée sortie (tare) · stock', r.pesee2, r.pesee2 ? 'done' : '', r.pesee2 ? kv('Tare', `<span class="mono">${kg(r.pesee2.kg)}</span>`) + kv('Net', `<b class="mono">${kg(r.net)}</b>`) + kv('Écart BL', e == null ? '' : `<span style="${Math.abs(e) > S.cfg.toleranceBL ? 'color:var(--bad);font-weight:600' : ''}">${(e > 0 ? '+' : '') + nf2.format(e)} %</span>`) + kv('Ticket bascule', esc(r.pesee2.ticketBascule)) : '');
  if (r.annulation) tl += ws('Annulée', r.annulation, 'bad', kv('Motif', esc(r.annulation.motif)));
  const bc = can('achats.read') ? S.cmds.find(c => c.statut !== 'annulee' && (c.receptions || []).includes(r.id)) : null;
  if (bc) tl += `<div class="done"><h3>Commande <button class="btn ghost sm" type="button" data-cmd="${bc.id}" style="min-height:0;padding:0 4px;color:var(--accent)">${esc(bc.numero)}</button></h3></div>`;
  const canAct = ST[r.status]?.action && can(ACT_PERM[r.status]);
  const canCancel = can('receptions.cancel') && ['attente_qc', 'attente_pesee1', 'dechargement', 'attente_pesee2'].includes(r.status);
  return `<div class="tl">${tl}</div>
    ${canAct ? `<button class="btn primary block" type="button" data-act="${r.id}">${ST[r.status].action}</button>` : ''}
    ${canCancel ? (S.sheet.confirm ? `<form class="confirm" id="cancelForm"><b>Annuler cette réception ?</b><span style="font-size:13.5px">Le camion sort de la file. Cette action reste visible dans l’historique.</span>
        <input class="input" id="motif" required placeholder="Motif (ex. marchandise refusée)"><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn danger" type="submit">Confirmer l’annulation</button><button class="btn ghost" type="button" data-cancel-no>Garder</button></div></form>`
      : `<button class="btn ghost" type="button" data-cancel-ask style="color:var(--bad)">Annuler la réception…</button>`) : ''}`;
}

/* ---------- Photos (contrôle qualité) ---------- */
function drawPhotos(){
  const el = $('#ph'), sh = S.sheet; if (!el || !sh) return;
  el.innerHTML = sh.photos.map((p, i) => `<div class="ph"><img src="${esc(p.url)}" alt="Photo ${i + 1}"><button class="rm" type="button" data-rmph="${i}" aria-label="Retirer la photo">${ICON.x}</button></div>`).join('')
    + Array.from({length: sh.uploading}, () => '<div class="ph up">Envoi…</div>').join('');
}
function shrink(file){
  return new Promise(res => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => { const k = Math.min(1, 1600 / Math.max(img.width, img.height)); const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url); c.toBlob(b => res(b || file), 'image/jpeg', 0.8); };
    img.onerror = () => { URL.revokeObjectURL(url); res(file); };
    img.src = url;
  });
}
async function onPhotos(e){
  const sh = S.sheet, files = [...e.target.files]; e.target.value = '';
  for (const f of files) {
    if (!f.type.startsWith('image/')) continue;
    sh.uploading++; drawPhotos();
    try { const b = await shrink(f); const fd = new FormData(); fd.append('photo', b, 'photo.jpg'); const up = await api('POST', '/api/photos', fd); if (S.sheet === sh) sh.photos.push({id:up.id, url:up.url}); }
    catch (ex) { toast(ex?.message || 'Envoi de la photo impossible. Réessayez.', true); }
    finally { sh.uploading--; drawPhotos(); }
  }
}

/* ---------- Writes ---------- */
function nextTicket(){
  const d = new Date(), t0 = dayStart(d);
  const pre = 'R' + String(d.getFullYear()).slice(2) + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0') + '-';
  const max = S.recs.filter(r => r.createdAt >= t0 && r.ticket?.startsWith(pre)).reduce((m, r) => Math.max(m, parseInt(r.ticket.slice(pre.length), 10) || 0), 0);
  return pre + String(max + 1).padStart(3, '0');
}
const val = id => ($('#' + id)?.value ?? '').trim();

async function onSubmit(e){
  e.preventDefault();
  const sh = S.sheet, btn = e.target.querySelector('button[type=submit]'), err = $('#err');
  const r = sh.id ? S.recs.find(x => x.id === sh.id) : null;
  const fail = m => { err.textContent = m; btn.disabled = false; };
  btn.disabled = true; err.textContent = '';
  try {
    if (sh.kind === 'arrivee') {
      const p = val('plate').toUpperCase().replace(/\s+/g, ' ');
      const fourn = val('fournisseur'), mat = val('matiere');
      if (!p || !fourn || !mat) return fail('Matricule, fournisseur et matière sont obligatoires.');
      const dup = S.recs.find(x => LANES.some(l => l[0] === x.status) && x.plate.replace(/\s/g, '') === p.replace(/\s/g, ''));
      if (dup) return fail(`Ce camion est déjà sur site (${dup.ticket}). Terminez ou annulez sa réception d’abord.`);
      const pbl = val('poidsBL') ? parseKg(val('poidsBL')) : null;
      if (val('poidsBL') && (pbl == null || pbl <= 0)) return fail('Poids BL invalide : saisissez un nombre en kg.');
      await api('POST', '/api/receptions', {plate:p, chauffeur:val('chauffeur'), tel:val('tel'), fournisseur:fourn, matiere:mat, bl:val('bl'), poidsBL:pbl});
      await loadRecs(); closeSheet(); toast(`Arrivée enregistrée · ${p} attend le contrôle qualité`);
    } else if (sh.kind === 'pesee1') {
      if (r.status === 'attente_qc') return fail('Pesée bloquée : le contrôle qualité n’a pas encore validé ce camion.');
      if (r.status !== 'attente_pesee1') return fail('Ce camion a déjà été pesé par un autre poste.');
      const v = parseKg(val('kg'));
      if (v == null || v <= 0) return fail('Saisissez le poids brut en kg.');
      if (v > 100000) return fail('Poids supérieur à la portée de la bascule (100 000 kg) : vérifiez la saisie.');
      await api('POST', `/api/receptions/${r.id}/pesee1`, {kg:v, ticketBascule:val('tb')});
      await loadRecs(); closeSheet(); toast(`Brut ${kg(v)} · ${r.plate} part au quai`);
    } else if (sh.kind === 'dech') {
      if (r.status !== 'dechargement') return fail('Ce déchargement a déjà été validé.');
      const z = val('zone'); if (!z) return fail('Choisissez la zone de stockage.');
      const q = document.querySelector('input[name=q]:checked')?.value || 'conforme';
      await api('POST', `/api/receptions/${r.id}/dechargement`, {zone:z, colis:val('colis'), lot:val('lot'), qualite:q, remarque:val('rem')});
      await loadRecs(); closeSheet(); toast(`${r.plate} déchargé en ${z} · retour à la bascule`);
    } else if (sh.kind === 'pesee2') {
      if (r.status !== 'attente_pesee2') return fail('Ce camion a déjà été pesé à la sortie.');
      const v = parseKg(val('kg'));
      if (v == null || v <= 0) return fail('Saisissez la tare en kg.');
      if (v >= r.pesee1.kg) return fail(`La tare doit être inférieure au brut (${kg(r.pesee1.kg)}).`);
      const net = r.pesee1.kg - v;
      await api('POST', `/api/receptions/${r.id}/pesee2`, {kg:v, ticketBascule:val('tb')});
      await loadRecs(); closeSheet(); toast(`${kg(net)} de ${r.matiere} entrés en stock`);
    } else if (sh.kind === 'cmdnew') {
      const fourn = val('cf_fourn'), mat = val('cf_mat'), qte = parseKg(val('cf_qte')), prix = parseKg(val('cf_prix')), dev = val('cf_dev'), taux = parseKg(val('cf_taux'));
      if (!fourn || !mat) return fail('Fournisseur et matière sont obligatoires.');
      if (qte == null || qte <= 0) return fail('Saisissez la quantité commandée en kg.');
      if (prix == null || prix <= 0) return fail('Saisissez le prix unitaire HT.');
      if (dev !== 'TND' && (taux == null || taux <= 0)) return fail(`Indiquez le taux de change : 1 ${dev} = combien de TND ?`);
      const c = await api('POST', '/api/achats/commandes', {date:fromISO(val('cf_date')) || dayStart(), fournisseur:fourn, matiere:mat, qteKg:qte, prix, unite:val('cf_unite'), devise:dev, taux:dev === 'TND' ? null : taux,
        tva:+val('cf_tva'), conditions:val('cf_cond'), livraisonPrevue:fromISO(val('cf_liv')), refFournisseur:val('cf_ref'), notes:val('cf_notes')});
      await loadAchats(); closeSheet(); toast(`Bon de commande ${c.numero} créé`);
    } else if (sh.kind === 'qc') {
      if (!can('qc.decide')) return fail('Seule l’équipe qualité peut valider un camion.');
      if (r.status !== 'attente_qc') return fail('Ce camion a déjà été contrôlé.');
      if (sh.uploading) return fail('Attendez la fin de l’envoi des photos.');
      const d = document.querySelector('input[name=d]:checked')?.value;
      if (!d) return fail('Choisissez une décision : accepter, avec réserve ou refuser.');
      const com = val('com');
      if (d !== 'accepte' && !com) return fail('Expliquez la réserve ou le refus dans le commentaire.');
      const res = S.cfg.qcTests.map((t, i) => ({test:t, valeur:val('t' + i)})).filter(x => x.valeur);
      await api('POST', `/api/receptions/${r.id}/qc`, {decision:d, photos:sh.photos.map(x => x.id), echantillon:val('ech'), coa:$('#coa').checked, resultats:res, commentaire:com});
      await loadRecs(); closeSheet(); toast(d === 'refuse' ? `${r.plate} refusé par la qualité · ne pas peser` : `${r.plate} validé · peut passer à la bascule`);
    }
  } catch (ex) { if (ex?.status === 409) loadRecs(); fail(dbErr(ex)); }
}

async function saveCfg(patch, quiet){
  try { S.cfg = await api('PUT', '/api/config', patch); render(); if (!quiet) toast('Paramètres enregistrés'); }
  catch (ex) { if (ex.status !== 401) toast(dbErr(ex), true); }
}

/* ---------- Events ---------- */
document.addEventListener('click', async e => {
  const t = e.target;
  if (t.closest('#fab')) return openSheet('arrivee');
  if (t.closest('[data-close]') || t.matches('[data-scrim]')) return closeSheet();
  if (t.closest('[data-newcmd]')) return openSheet('cmdnew');
  const cm = t.closest('[data-cmd]'); if (cm) { openSheet('cmd', cm.dataset.cmd); return; }
  const af = t.closest('[data-af]'); if (af) { S.ach.f = af.dataset.af; render(); return; }
  const ex = t.closest('[data-exp]'); if (ex) { exportAchats(ex.dataset.exp); return; }
  const db_ = t.closest('[data-debit]'); if (db_) { const [cid, pid] = db_.dataset.debit.split(':'); const c = S.cmds.find(x => x.id === cid); if (c) await cmdCall('POST', cmdUrl(c, `/paiements/${pid}/debite`), null, 'Paiement marqué débité'); return; }
  const sb = t.closest('[data-sub]'); if (sb && S.sheet) { S.sheet.sub = sb.dataset.sub || null; S.sheet.del = null; drawSheet(); return; }
  const ul = t.closest('[data-unlink]'); if (ul) { const c = curCmd(); if (c) await cmdCall('DELETE', cmdUrl(c, `/receptions/${ul.dataset.unlink}`), null, 'Réception détachée'); return; }
  for (const kind of ['fact', 'pay']) { const d = t.closest(`[data-del${kind}]`); if (!d) continue; const id = d.getAttribute(`data-del${kind}`), key = kind + ':' + id, c = curCmd(); if (!c) return;
    if (S.sheet.del !== key) { S.sheet.del = key; drawSheet(); return; }
    S.sheet.del = null; await cmdCall('DELETE', cmdUrl(c, `/${kind === 'fact' ? 'factures' : 'paiements'}/${id}`), null, kind === 'fact' ? 'Facture supprimée' : 'Paiement supprimé'); return; }
  const cs = t.closest('[data-cmdstat]'); if (cs) { const c = curCmd(); if (c) await cmdCall('POST', cmdUrl(c, '/statut'), {statut:cs.dataset.cmdstat}, cs.dataset.cmdstat === 'soldee' ? 'Commande soldée' : 'Commande rouverte'); return; }
  const cc = t.closest('[data-cmdcancel]'); if (cc) { S.sheet.confirm = cc.dataset.cmdcancel === 'ask'; drawSheet(); if (S.sheet.confirm) $('#cmotif')?.focus(); return; }
  const dbk = t.closest('[data-delbank]'); if (dbk) { saveCcfg({banques:S.ccfg.banques.filter((_, i) => i !== +dbk.dataset.delbank)}); return; }
  const ph = t.closest('[data-photo]'); if (ph) { $('#lightRoot').innerHTML = `<div class="light" data-light><img src="${photoSrc(ph.dataset.photo)}" alt="Photo du chargement"></div>`; return; }
  if (t.closest('[data-light]')) { $('#lightRoot').innerHTML = ''; return; }
  const rm = t.closest('[data-rmph]'); if (rm && S.sheet?.photos) { const [x] = S.sheet.photos.splice(+rm.dataset.rmph, 1); drawPhotos(); try { await api('DELETE', '/api/photos/' + x.id); } catch {} return; }
  const act = t.closest('[data-act]');
  if (act) { const r = S.recs.find(x => x.id === act.dataset.act); if (!r || !ACT[r.status]) return; if (r.status === 'attente_qc' && !can('qc.decide')) { toast('Seule l’équipe qualité peut contrôler ce camion.'); return; } return openSheet(ACT[r.status], r.id); }
  if (t.closest('[data-qcdefaults]')) { saveCfg({qcTests:[...QC_DEFAULT_TESTS]}); return; }
  if (t.closest('[data-logout]')) { try { await api('POST', '/api/auth/logout'); } catch {} location.reload(); return; }
  if (t.closest('[data-auditload]')) { loadAudit(); return; }
  const ur = t.closest('[data-ureset]'); if (ur && ur.tagName === 'BUTTON') { S.sheetReset = ur.dataset.ureset ? +ur.dataset.ureset : null; render(); $('#resetPw')?.select(); return; }
  const ua = t.closest('[data-uactive]'); if (ua) { const [uid, on] = ua.dataset.uactive.split(':'); if (await run(() => api('PATCH', `/api/users/${uid}`, {active:on === '1'}), on === '1' ? 'Compte réactivé' : 'Compte désactivé · sessions fermées')) loadUsers(); return; }
  const op = t.closest('[data-open]'); if (op) { openSheet('detail', op.dataset.open); return; }
  if (t.closest('[data-cancel-ask]')) { S.sheet.confirm = true; drawSheet(); $('#motif')?.focus(); return; }
  if (t.closest('[data-cancel-no]')) { S.sheet.confirm = false; drawSheet(); return; }
  const rg = t.closest('[data-range]'); if (rg) { const [n, k] = rg.dataset.range.split(':'); if (n === 'stock') S.stockRange = k; else S.hist.range = k; render(); return; }
  const del = t.closest('[data-del]'); if (del) { const [key, i] = del.dataset.del.split(':'); const arr = S.cfg[key].filter((_, j) => j !== +i); saveCfg({[key]:arr}); return; }
  if (t.closest('#csv')) exportCsv();
});
document.addEventListener('submit', async e => {
  if (e.target.id === 'pwForm') { e.preventDefault(); const err = $('#pwErr'); err.textContent = '';
    if (val('pw1') !== val('pw2')) { err.textContent = 'Les deux nouveaux mots de passe ne correspondent pas.'; return; }
    try { S.me = await api('POST', '/api/me/password', {current:$('#pw0').value, next:$('#pw1').value}); toast('Mot de passe changé · vos autres appareils sont déconnectés'); render(); } catch (ex) { err.textContent = ex.message; } return; }
  if (e.target.id === 'userForm') { e.preventDefault(); const err = $('#nuErr'); err.textContent = '';
    try { const u = await api('POST', '/api/users', {name:val('nu_name'), username:val('nu_user'), role:val('nu_role'), password:val('nu_pw')}); toast(`Compte ${u.username} créé · mot de passe provisoire à lui remettre`); await loadUsers(); } catch (ex) { err.textContent = ex.message; } return; }
  if (e.target.id === 'resetForm') { e.preventDefault(); const uid = S.sheetReset;
    if (await run(() => api('PATCH', `/api/users/${uid}`, {password:val('resetPw')}), 'Mot de passe provisoire enregistré · sessions fermées')) { S.sheetReset = null; loadUsers(); } return; }
  if (e.target.id === 'linkForm') { e.preventDefault(); const c = curCmd(); if (c) await cmdCall('POST', cmdUrl(c, '/receptions'), {receptionId:$('#lk').value}, 'Réception rattachée'); return; }
  const lr = e.target.closest('[data-linkrec]'); if (lr) { e.preventDefault(); const rid = lr.dataset.linkrec, c = S.cmds.find(x => x.id === $('#lk-' + rid).value); if (c) await cmdCall('POST', cmdUrl(c, '/receptions'), {receptionId:rid}, `Réception rattachée à ${c.numero}`); return; }
  if (e.target.id === 'factForm') { e.preventDefault(); const c = curCmd(), err = $('#ferr'); if (!c) return;
    const num = val('ff_num'), date = fromISO(val('ff_date')), ht = parseKg(val('ff_ht')), tva = +val('ff_tva'), timbre = $('#ff_timbre')?.checked ? 1 : 0;
    if (!num || !date) { err.textContent = 'N° et date de facture sont obligatoires.'; return; }
    if (ht == null || ht <= 0) { err.textContent = 'Saisissez le montant HT de la facture.'; return; }
    if ((c.factures || []).some(f => f.numero.toLowerCase() === num.toLowerCase())) { err.textContent = 'Cette facture est déjà enregistrée sur la commande.'; return; }
    const ttc = r3(ht * (1 + tva / 100) + timbre);
    if (await cmdCall('POST', cmdUrl(c, '/factures'), {numero:num, date, ht, tva, timbre:!!timbre, echeance:fromISO(val('ff_ech')) || dueDate(date, c.conditions)}, `Facture ${num} enregistrée · ${money(ttc, c.devise)}`)) { S.sheet.sub = null; drawSheet(); } return; }
  if (e.target.id === 'payForm') { e.preventDefault(); const c = curCmd(), err = $('#perr'); if (!c) return;
    const date = fromISO(val('fp_date')), m = parseKg(val('fp_mont')), mode = val('fp_mode');
    if (!date) { err.textContent = 'Indiquez la date du paiement.'; return; }
    if (m == null || m <= 0) { err.textContent = 'Saisissez le montant réglé.'; return; }
    if ((mode === 'cheque' || mode === 'traite') && !val('fp_ref')) { err.textContent = `Indiquez le ${REF_LBL[mode].toLowerCase()} pour pouvoir le suivre.`; return; }
    const body = {date, montant:m, mode, reference:val('fp_ref'), banque:val('fp_bank'), echeance:AVEC_ECH.includes(mode) ? (fromISO(val('fp_ech')) || date) : null, retenue:!!$('#fp_rs')?.checked};
    if (await cmdCall('POST', cmdUrl(c, '/paiements'), body, `${MODES[mode]} de ${money(m, c.devise)} enregistré`)) { S.sheet.sub = null; drawSheet(); } return; }
  if (e.target.id === 'cancelCmdForm') { e.preventDefault(); const c = curCmd(), mo = val('cmotif'); if (!c || !mo) return; if (await cmdCall('POST', cmdUrl(c, '/statut'), {statut:'annulee', motif:mo}, `Commande ${c.numero} annulée`)) { S.sheet.confirm = false; drawSheet(); } return; }
  if (e.target.id === 'bankForm') { e.preventDefault(); const v = val('bankIn'); if (v && !S.ccfg.banques.some(b => b.toLowerCase() === v.toLowerCase())) saveCcfg({banques:[...S.ccfg.banques, v]}); return; }
  if (e.target.id === 'rsForm') { e.preventDefault(); const tx = parseKg(val('rsTaux')), se = parseKg(val('rsSeuil')); if (tx == null || tx < 0 || tx > 25 || se == null || se < 0) { toast('Taux ou seuil invalide', true); return; } saveCcfg({rsTaux:tx, rsSeuil:se}); return; }
  const add = e.target.closest('[data-add]');
  if (add) { e.preventDefault(); const key = add.dataset.add, inp = $('#add-' + key), v = inp.value.trim().replace(/\s+/g, ' ');
    if (!v) return; if (S.cfg[key].some(x => x.toLowerCase() === v.toLowerCase())) { toast('Déjà dans la liste'); return; }
    inp.value = ''; await saveCfg({[key]:[...S.cfg[key], v]}); return; }
  if (e.target.id === 'tolForm') { e.preventDefault(); const v = parseKg($('#tol').value); if (v == null || v < 0 || v > 20) { toast('Tolérance invalide (0 à 20 %)', true); return; } await saveCfg({toleranceBL:v}); return; }
  if (e.target.id === 'cancelForm') { e.preventDefault(); const r = S.recs.find(x => x.id === S.sheet.id); const m = val('motif'); if (!m) return;
    try { await api('POST', `/api/receptions/${r.id}/annuler`, {motif:m}); S.sheet.confirm = false; await loadRecs(); toast('Réception annulée'); }
    catch (ex) { toast(dbErr(ex), true); } }
});
document.addEventListener('input', e => {
  if (e.target.id === 'q') { S.hist.q = e.target.value; render(); }
  if (e.target.id === 'aq') { S.ach.q = e.target.value; render(); }
  if (e.target.id === 'fp_mont' && $('#fp_rs')) { const m = parseKg(e.target.value); $('#fp_rs').checked = m != null && m >= S.ccfg.rsSeuil; updPay(); }
});
document.addEventListener('change', async e => {
  const ur = e.target.closest('[data-urole]'); if (ur) { if (await run(() => api('PATCH', `/api/users/${ur.dataset.urole}`, {role:ur.value}), 'Rôle modifié · ses sessions sont fermées')) loadUsers(); else loadUsers(); }
  if (e.target.id === 'nu_role') { const d = $('#nu_roleDesc'); if (d) d.textContent = S.roles.find(r => r.key === e.target.value)?.description || ''; }
});
document.addEventListener('keydown', e => { if (e.key !== 'Escape') return; if ($('#lightRoot').innerHTML) $('#lightRoot').innerHTML = ''; else if (S.sheet) closeSheet(); });

async function exportCsv(){
  const rows = histRows();
  const head = ['Date','Heure','Ticket','Statut','Matricule','Chauffeur','Fournisseur','Matière','N° BL','Poids BL (kg)','Brut (kg)','Ticket bascule entrée','Zone','Balles/colis','Lot','Qualité','Remarque','Tare (kg)','Ticket bascule sortie','Net (kg)','Écart BL (%)','Contrôle qualité','Date contrôle','Contrôleur','Photos','N° échantillon','COA reçu','Mesures','Commentaire QC','Motif annulation'];
  const c = v => { const s = v == null ? '' : String(v); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const n = v => v == null ? '' : String(v).replace('.', ',');
  const lines = rows.map(r => { const e = ecart(r); return [dmy(r.createdAt), hm(r.createdAt), r.ticket, ST[r.status]?.label, r.plate, r.chauffeur, r.fournisseur, r.matiere, r.bl, n(r.poidsBL), n(r.pesee1?.kg), r.pesee1?.ticketBascule, r.dechargement?.zone, r.dechargement?.colis, r.dechargement?.lot, QUAL[r.dechargement?.qualite]?.[0], r.dechargement?.remarque, n(r.pesee2?.kg), r.pesee2?.ticketBascule, n(r.net), e == null ? '' : n(e.toFixed(2)), QCD[r.qc?.decision]?.[0], r.qc?.at ? dmy(r.qc.at) + ' ' + hm(r.qc.at) : '', r.qc?.by ? nameOf(r.qc) : '', r.qc?.photos?.length || '', r.qc?.echantillon, r.qc ? (r.qc.coa ? 'Oui' : 'Non') : '', (r.qc?.resultats || []).map(x => x.test + ' = ' + x.valeur).join(' | '), r.qc?.commentaire, r.annulation?.motif].map(c).join(';'); });
  const csv = '﻿' + [head.join(';'), ...lines].join('\r\n');
  const d = new Date(), stampStr = d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
  try { downloadFile(`evia-receptions-${S.hist.range}-${stampStr}.csv`, csv); toast('Fichier exporté'); }
  catch (ex) { if (ex?.code !== 'declined') toast('Export impossible pour le moment.', true); }
}

function setLive(s, txt){ const l = $('#live'); l.dataset.s = s; $('#liveTxt').textContent = txt; }

/* ---------- API & session ---------- */
async function api(method, url, body){
  const isForm = body instanceof FormData;
  const headers = {'x-evia-csrf':'1'};
  if (body != null && !isForm) headers['content-type'] = 'application/json';
  let res;
  try { res = await fetch(url, {method, headers, body: body == null ? undefined : isForm ? body : JSON.stringify(body), credentials:'same-origin'}); }
  catch { setLive('off', 'Hors ligne'); throw Object.assign(new Error('Serveur injoignable : vérifiez le réseau.'), {status:0}); }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && url !== '/api/auth/login' && url !== '/api/me') { showGate('login', 'Votre session a expiré. Reconnectez-vous.'); }
  if (!res.ok) throw Object.assign(new Error(data.error || `Erreur ${res.status}`), {status:res.status});
  return data;
}
async function loadRecs(){ if (!can('receptions.read')) return; try { S.recs = await api('GET', '/api/receptions'); S.loaded = true; render(); if (S.sheet?.kind === 'detail' && !S.sheet.confirm) drawSheet(); } catch {} }
async function loadCfg(){ try { S.cfg = await api('GET', '/api/config'); S.cfgLoaded = true; render(); } catch {} }
async function loadAchats(){ if (!can('achats.read')) return; try { const d = await api('GET', '/api/achats'); S.cmds = d.commandes; S.ccfg = d.config; S.cmdLoaded = true; S.cmdErr = false; render(); if (S.sheet?.kind === 'cmd' && !S.sheet.sub && !S.sheet.del && !S.sheet.confirm) drawSheet(); } catch (e) { if (e.status) { S.cmdLoaded = true; S.cmdErr = true; render(); } } }
async function loadUsers(){ if (!can('users.manage')) return; try { const d = await api('GET', '/api/users'); S.users = d.users; S.roles = d.roles; S.permsDesc = d.perms; S.usersLoaded = true; render(); } catch {} }
async function loadAudit(){ if (!can('audit.read')) return; try { S.audit = await api('GET', '/api/audit?limit=300'); S.auditLoaded = true; render(); } catch {} }
const PERMS_FR = {'receptions.read':'Voir les camions et les réceptions', 'receptions.create':'Enregistrer une arrivée', 'receptions.cancel':'Annuler une réception en cours', 'qc.decide':'Contrôle qualité : photos, accepter ou refuser un camion', 'pesee.write':'Saisir les pesées', 'dechargement.write':'Valider un déchargement', 'stock.read':'Voir le stock', 'historique.read':'Voir l’historique', 'export':'Exporter en Excel / CSV', 'config.write':'Modifier les listes', 'achats.read':'Voir commandes, prix et paiements', 'achats.write':'Gérer commandes, factures et paiements', 'users.manage':'Gérer les utilisateurs', 'audit.read':'Consulter le journal'};

let es, esTimers = {};
function openEvents(){
  es?.close();
  es = new EventSource('/api/events');
  es.onopen = () => setLive('on', 'En direct');
  es.onerror = () => setLive('warn', 'Reconnexion…');
  es.onmessage = ev => {
    let topic; try { topic = JSON.parse(ev.data).topic; } catch { return; }
    clearTimeout(esTimers[topic]);
    esTimers[topic] = setTimeout(() => ({receptions:loadRecs, achats:loadAchats, config:loadCfg, users:loadUsers})[topic]?.(), 150);
  };
}

function showGate(mode, msg){
  es?.close(); S.me = mode === 'password' ? S.me : null;
  document.body.classList.add('locked'); closeSheet();
  const g = $('#gate');
  g.hidden = false;
  g.innerHTML = mode === 'login' ? `<form class="gate-card" id="loginForm" autocomplete="on">
      <div class="brand"><div class="mark" aria-hidden="true">É</div><div><h1>Évia · Réception MP</h1><small>Caoutchouc — bascule &amp; stock</small></div></div>
      ${msg ? `<div class="notice">${esc(msg)}</div>` : ''}
      <div class="field"><label for="lg_u">Identifiant</label><input class="input" id="lg_u" autocomplete="username" autocapitalize="none" required></div>
      <div class="field"><label for="lg_p">Mot de passe</label><input class="input" id="lg_p" type="password" autocomplete="current-password" required></div>
      <div class="err" id="lgErr"></div>
      <button class="btn primary block" type="submit">Se connecter</button>
      <span class="hint">Mot de passe oublié : demandez à l’administrateur un mot de passe provisoire.</span></form>`
    : `<form class="gate-card" id="firstPwForm" autocomplete="off">
      <div class="brand"><div class="mark" aria-hidden="true">É</div><div><h1>Bienvenue ${esc(S.me?.name || '')}</h1><small>${esc(S.me?.roleLabel || '')}</small></div></div>
      <div class="notice">Choisissez votre mot de passe personnel. Ne le communiquez à personne.</div>
      <div class="field"><label for="fp0">Mot de passe provisoire reçu</label><input class="input" id="fp0" type="password" autocomplete="current-password" required></div>
      <div class="field"><label for="fp1">Nouveau mot de passe</label><input class="input" id="fp1" type="password" autocomplete="new-password" required><span class="hint">10 caractères minimum, sans votre identifiant.</span></div>
      <div class="field"><label for="fp2">Confirmer</label><input class="input" id="fp2" type="password" autocomplete="new-password" required></div>
      <div class="err" id="fpErr"></div>
      <button class="btn primary block" type="submit">Enregistrer et continuer</button>
      <button class="btn ghost block" type="button" data-logout>Se déconnecter</button></form>`;
  g.querySelector('input')?.focus();
}
document.addEventListener('submit', async e => {
  if (e.target.id === 'loginForm') { e.preventDefault(); const err = $('#lgErr'), b = e.target.querySelector('button[type=submit]'); err.textContent = ''; b.disabled = true;
    try { S.me = await api('POST', '/api/auth/login', {username:$('#lg_u').value.trim(), password:$('#lg_p').value}); startApp(); } catch (ex) { err.textContent = ex.message; b.disabled = false; } }
  if (e.target.id === 'firstPwForm') { e.preventDefault(); const err = $('#fpErr'); err.textContent = '';
    if ($('#fp1').value !== $('#fp2').value) { err.textContent = 'Les deux mots de passe ne correspondent pas.'; return; }
    try { S.me = await api('POST', '/api/me/password', {current:$('#fp0').value, next:$('#fp1').value}); startApp(); } catch (ex) { err.textContent = ex.message; } }
});

function startApp(){
  if (S.me.mustChangePassword) return showGate('password');
  S.permsDesc = {...PERMS_FR, ...S.permsDesc};
  $('#gate').hidden = true; $('#gate').innerHTML = ''; document.body.classList.remove('locked');
  if (!tabOk(S.tab)) S.tab = TABS.find(t => tabOk(t[0]))[0];
  render();
  Promise.all([loadCfg(), loadRecs(), loadAchats(), loadUsers(), loadAudit()]);
  openEvents();
}

setInterval(() => { if (S.me && (S.tab === 'camions' || S.tab === 'qualite') && !S.sheet) render(); }, 30000);
// Filet de sécurité si le flux en direct est coupé par un proxy
setInterval(() => { if (S.me && document.visibilityState === 'visible' && es?.readyState !== 1) { loadRecs(); loadAchats(); } }, 30000);
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});

(async () => {
  try { S.me = await api('GET', '/api/me'); startApp(); }
  catch (e) { showGate('login', e.status === 0 ? 'Serveur injoignable : vérifiez le réseau.' : ''); }
})();
})();
