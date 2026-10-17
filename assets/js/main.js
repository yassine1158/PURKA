(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const on = (sel, ev, fn) => { const el = typeof sel === "string" ? $(sel) : sel; if (el) el.addEventListener(ev, fn); return el; };
  const bust = "?v=" + Date.now(); // toujours la dernière version des données
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fmt = (n) => (Math.round(n * 10) / 10).toLocaleString("fr-FR");
  const store = {
    get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
    set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  };
  const productURL = (p) => "produit.html?id=" + encodeURIComponent(p.id || p.name);
  const body = document.body;
  let site = {}, products = [], onSiteReady = [];

  $("#year").textContent = new Date().getFullYear();
  $$("[data-nav]").forEach((a) => a.classList.toggle("current", a.dataset.nav === body.dataset.page));

  const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;

  /* ---------- titres découpés en mots ---------- */
  const splitWords = (el) => {
    const words = el.textContent.trim().split(/\s+/);
    el.innerHTML = words.map((w, i) => `<span class="w"><span style="transition-delay:${0.1 + i * 0.06}s">${esc(w)}</span></span>`).join(" ");
  };
  $$("[data-split]").forEach(splitWords);

  /* ---------- entrée de page et transitions ---------- */
  requestAnimationFrame(() => setTimeout(() => body.classList.add("loaded"), 40));
  addEventListener("pageshow", (e) => { if (e.persisted) { body.classList.remove("leaving"); body.classList.add("loaded"); } });
  document.addEventListener("click", (e) => {
    const a = e.target.closest("a[href]");
    if (!a || reduce || e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || a.target === "_blank") return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin || (url.pathname === location.pathname && url.search === location.search)) return;
    if (/\/admin\/?$/.test(url.pathname)) return;
    e.preventDefault(); body.classList.add("leaving");
    setTimeout(() => (location.href = url.href), 380);
  });

  /* ---------- en-tête, progression, parallaxe ---------- */
  const header = $("#header"), progress = $("#progress");
  const overHero = $("main > .hero-full, main > .page-hero");
  if (overHero) body.classList.add("has-hero");
  const paras = $$("[data-parallax]");
  const steps = $("#steps");
  let lastY = scrollY, ticking = false;
  const onScroll = () => {
    const y = scrollY, max = document.documentElement.scrollHeight - innerHeight;
    header.classList.toggle("scrolled", y > 24 || !overHero);
    header.classList.toggle("hide", y > 420 && y > lastY + 4 && !menu.classList.contains("open"));
    if (y < lastY - 4 || y < 420) header.classList.remove("hide");
    lastY = y;
    progress.style.transform = `scaleX(${max > 0 ? y / max : 0})`;
    if (!reduce) paras.forEach((el) => {
      const r = el.parentElement.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight) return;
      el.style.transform = `translate3d(0,${((r.top + r.height / 2) - innerHeight / 2) * -+el.dataset.parallax}px,0) scale(${el.dataset.parallax > 0 ? 1.12 : 1.08})`;
    });
    if (steps) {
      const r = steps.getBoundingClientRect();
      steps.style.setProperty("--p", Math.min(Math.max((innerHeight * 0.8 - r.top) / (r.height + innerHeight * 0.3), 0), 1));
    }
    ticking = false;
  };
  addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  addEventListener("resize", onScroll);

  /* ---------- diaporama du hero ---------- */
  const slides = $$(".hero-slides img"), dots = $("#slide-dots");
  if (slides.length > 1 && dots) {
    let si = 0, timer;
    dots.innerHTML = slides.map((_, i) => `<button type="button" aria-label="Photo ${i + 1}"><i></i></button>`).join("");
    const btns = $$("button", dots);
    const go = (i) => {
      slides[si].classList.remove("active"); btns[si].classList.remove("on");
      si = (i + slides.length) % slides.length;
      slides[si].classList.add("active"); void btns[si].offsetWidth; btns[si].classList.add("on");
      clearTimeout(timer); if (!reduce) timer = setTimeout(() => go(si + 1), 6500);
    };
    btns.forEach((b, i) => (b.onclick = () => go(i)));
    go(0);
  }

  /* ---------- effets souris (ordinateur) ---------- */
  if (finePointer && !reduce) {
    document.documentElement.classList.add("has-cursor");
    const cur = $("#cursor"), dot = $(".cursor-dot"), ring = $(".cursor-ring"), label = $("em", ring);
    let x = -100, y = -100, rx = x, ry = y;
    addEventListener("mousemove", (e) => { x = e.clientX; y = e.clientY; cur.classList.remove("off"); });
    document.addEventListener("mouseleave", () => cur.classList.add("off"));
    addEventListener("mouseover", (e) => {
      const v = e.target.closest("[data-cursor]");
      cur.classList.toggle("view", !!v);
      cur.classList.toggle("link", !v && !!e.target.closest("a,button,summary,label,select,input,textarea"));
      if (v) label.textContent = v.dataset.cursor;
    });
    (function loop() {
      rx += (x - rx) * 0.2; ry += (y - ry) * 0.2;
      dot.style.transform = `translate(${x}px,${y}px)`; ring.style.transform = `translate(${rx}px,${ry}px)`;
      requestAnimationFrame(loop);
    })();

    document.addEventListener("mousemove", (e) => {
      const m = e.target.closest(".btn-magnetic");
      if (m) { const r = m.getBoundingClientRect(); m.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * 0.18}px,${(e.clientY - r.top - r.height / 2) * 0.3}px)`; }
      const g = e.target.closest(".glow");
      if (g) { const r = g.getBoundingClientRect(); g.style.setProperty("--gx", `${e.clientX - r.left}px`); g.style.setProperty("--gy", `${e.clientY - r.top}px`); }
    });
    document.addEventListener("mouseout", (e) => { const m = e.target.closest(".btn-magnetic"); if (m && !m.contains(e.relatedTarget)) m.style.transform = ""; });

    const fl = $("#industry-float");
    if (fl) {
      const img = $("img", fl); let fx = 0, fy = 0, tx = 0, ty = 0;
      $$(".industry").forEach((s) => {
        s.addEventListener("mouseenter", () => { img.src = s.dataset.img; fl.classList.add("on"); });
        s.addEventListener("mouseleave", () => fl.classList.remove("on"));
      });
      on("#industries", "mousemove", (e) => { tx = e.clientX; ty = e.clientY; });
      (function floatLoop() {
        if (fl.classList.contains("on")) { fx += (tx - fx) * 0.14; fy += (ty - fy) * 0.14; fl.style.translate = `${fx}px ${fy}px`; fl.style.rotate = `${(tx - fx) * 0.03}deg`; }
        requestAnimationFrame(floatLoop);
      })();
    }
  }
  const tilt = (el) => {
    if (!finePointer || reduce) return;
    el.addEventListener("mousemove", (e) => {
      const r = el.getBoundingClientRect(), px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
      el.style.setProperty("--mx", `${px * 100}%`); el.style.setProperty("--my", `${py * 100}%`);
      el.style.transform = `perspective(1100px) rotateY(${(px - 0.5) * 5}deg) rotateX(${(0.5 - py) * 5}deg) translateY(-4px)`;
    });
    el.addEventListener("mouseleave", () => (el.style.transform = ""));
  };

  /* ---------- compteurs ---------- */
  const countIO = "IntersectionObserver" in window ? new IntersectionObserver((es) => es.forEach((e) => {
    if (!e.isIntersecting) return; countIO.unobserve(e.target);
    const b = e.target, end = +b.dataset.to, suf = b.dataset.suffix || "", t0 = performance.now();
    if (reduce) { b.textContent = end + suf; return; }
    const step = (t) => { const k = Math.min((t - t0) / 1600, 1); b.textContent = Math.round(end * (1 - Math.pow(1 - k, 4))) + suf; if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }), { threshold: 0.6 }) : null;

  const burger = $("#burger"), menu = $("#menu");
  const toggleMenu = (open) => {
    menu.classList.toggle("open", open); burger.setAttribute("aria-expanded", String(open));
    body.classList.toggle("lock", open);
  };
  burger.onclick = () => toggleMenu(!menu.classList.contains("open"));
  $$("#menu a").forEach((a) => a.addEventListener("click", () => toggleMenu(false)));

  /* ---------- notifications ---------- */
  const toast = (html) => {
    const t = $("#toast"); t.innerHTML = html; t.classList.add("show");
    clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("show"), 3800);
  };
  const addedToast = (what) => toast(`${what} <a href="contact.html#quote">Voir mon devis</a>`);

  /* ---------- apparitions au défilement ---------- */
  const io = "IntersectionObserver" in window && !reduce
    ? new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { rootMargin: "0px 0px -8% 0px" })
    : null;
  const observe = (root = document) => {
    let n = 0;
    $$(".reveal:not(.in), .reveal-clip:not(.in)", root).forEach((el) => {
      if (el.classList.contains("reveal")) el.style.transitionDelay = `${(n++ % 4) * 0.08}s`;
      io ? io.observe(el) : el.classList.add("in");
    });
  };
  observe();
  onScroll();

  /* =========================================================
     Demande de devis (partagée entre les pages)
     ========================================================= */
  let basket = store.get("purca_devis", []);
  const short = (u) => (!u || u === "tonne" ? "t" : u);
  const unitOf = (name) => short((products.find((p) => p.name === name) || {}).unit);
  const qList = $("#q-list");
  const saveBasket = () => { store.set("purca_devis", basket); renderBasket(); };
  const addToBasket = (name, qty) => {
    qty = Math.max(0, Math.ceil(+qty * 10) / 10) || 1;
    const it = basket.find((b) => b.name === name);
    if (it) it.qty = Math.round((it.qty + qty) * 10) / 10; else basket.push({ name, qty });
    saveBasket();
  };
  function renderBasket() {
    const n = basket.length;
    $("#basket-count").textContent = n; $("#basket-btn").classList.toggle("has", n > 0);
    $$(".card-add").forEach((b) => b.classList.toggle("added", basket.some((x) => x.name === b.dataset.name)));
    if (!qList) return;
    $("#q-clear").hidden = !n;
    qList.innerHTML = basket.map((b, i) => `<li><b>${esc(b.name)}</b>
      <span class="qty"><input type="number" min="0.1" step="0.1" value="${b.qty}" data-i="${i}" aria-label="Quantité ${esc(b.name)}"><span>${esc(unitOf(b.name))}</span></span>
      <button type="button" class="rm" data-i="${i}" aria-label="Retirer ${esc(b.name)}"><svg class="ic"><use href="#i-x"/></svg></button></li>`).join("");
  }
  if (qList) {
    qList.addEventListener("input", (e) => { if (e.target.dataset.i) { basket[+e.target.dataset.i].qty = +e.target.value || 0; store.set("purca_devis", basket); } });
    qList.addEventListener("click", (e) => { const b = e.target.closest(".rm"); if (b) { basket.splice(+b.dataset.i, 1); saveBasket(); } });
    on("#q-clear", "click", () => { basket = []; saveBasket(); });
    on("#q-add", "click", () => { const name = $("#q-product").value; if (name) addToBasket(name, $("#q-qty").value); });

    let via = "whatsapp";
    $$("#quote [data-via]").forEach((b) => b.addEventListener("click", () => (via = b.dataset.via)));
    on("#quote", "submit", (e) => {
      e.preventDefault();
      const f = e.target, err = $("#form-err");
      $$(".field", f).forEach((l) => l.classList.remove("invalid"));
      const missing = ["nom", "tel"].filter((k) => !f.elements[k].value.trim());
      missing.forEach((k) => f.elements[k].closest(".field").classList.add("invalid"));
      if (missing.length) { err.textContent = "Indiquez votre nom et votre téléphone."; return; }
      if (!basket.length && !f.elements.msg.value.trim()) { err.textContent = "Ajoutez au moins un produit ou écrivez un message."; return; }
      err.textContent = "";
      const d = Object.fromEntries(new FormData(f));
      const lines = basket.map((b) => `• ${b.name} : ${fmt(b.qty)} ${unitOf(b.name)}`).join("\n");
      const txt = `Demande de devis — PURCA\n\nNom / Entreprise : ${d.nom}\nTéléphone : ${d.tel}${d.lieu ? `\nDestination : ${d.lieu}` : ""}${lines ? `\n\nProduits :\n${lines}` : ""}${d.msg ? `\n\n${d.msg}` : ""}`;
      if (via === "email") location.href = `mailto:${site.email}?subject=${encodeURIComponent("Demande de devis — PURCA")}&body=${encodeURIComponent(txt)}`;
      else open(`https://wa.me/${site.whatsapp}?text=${encodeURIComponent(txt)}`, "_blank");
    });
  }
  renderBasket();

  /* =========================================================
     Données du site
     ========================================================= */
  fetch("data/site.json" + bust).then((r) => r.json()).then((d) => {
    site = d;
    $$("[data-site]").forEach((el) => { const v = d[el.dataset.site]; if (!v) return; el.textContent = v; if (el.hasAttribute("data-split")) splitWords(el); });
    $$("[data-site-href]").forEach((el) => { const v = d[el.dataset.site || el.dataset.qc]; if (v) el.href = el.dataset.siteHref + ":" + v.replace(/\s/g, ""); });
    const wa = d.whatsapp ? "https://wa.me/" + d.whatsapp : null;
    if (wa) ["#wa", "#faq-wa", "#qc-wa", "#cta-wa"].forEach((s) => { const el = $(s); if (el) el.href = wa; });
    const map = $("#map"); if (map && (d.mapQuery || d.address)) map.src = "https://maps.google.com/maps?q=" + encodeURIComponent(d.mapQuery || d.address) + "&z=11&output=embed";

    const stats = $("#stats");
    if (stats) {
      stats.innerHTML = (d.stats || []).map((s) => `<div class="stat reveal"><b data-to="${+s.value || 0}" data-suffix="${esc(s.suffix)}">${esc(s.value)}${esc(s.suffix)}</b><span>${esc(s.label)}</span></div>`).join("");
      if (countIO) $$(".stat b", stats).forEach((b) => countIO.observe(b));
      observe(stats);
    }

    const gal = $("#gallery");
    if (gal) {
      const g = d.gallery || [], lim = +gal.dataset.limit || g.length;
      gal.innerHTML = g.slice(0, lim).map((src, i) => `<button type="button" class="reveal" data-i="${i}" data-cursor="Voir" aria-label="Agrandir la photo ${i + 1}"><img src="${esc(src)}" alt="PURCA, photo ${i + 1}" loading="lazy"></button>`).join("");
      observe(gal);
      $$("button", gal).forEach((b) => (b.onclick = () => openLb(+b.dataset.i)));
      const c = $("#gal-count"); if (c) c.textContent = `${g.length} photos`;
    }
    if ($("#faq-list")) renderFaq(d.faq || []);
    seo(d);
    onSiteReady.forEach((f) => f()); onSiteReady = null;
  }).catch(console.error);

  /* ---------- FAQ ---------- */
  function renderFaq(list) {
    const box = $("#faq-list");
    box.innerHTML = list.length
      ? list.map((f) => `<details><summary>${esc(f.q)}<i aria-hidden="true"></i></summary><p>${esc(f.a)}</p></details>`).join("")
      : '<p class="muted">Aucune question pour le moment.</p>';
  }

  /* ---------- crédits photos ---------- */
  const cr = $("#credits");
  if (cr) fetch("data/credits.json" + bust).then((r) => r.json()).then((list) => {
    cr.innerHTML = list.map((c) => `<figure><img src="${esc(c.file)}" alt="" loading="lazy"><figcaption><b>${esc(c.title)}</b><span>${esc(c.author)}</span><span><a href="${esc(c.licenseUrl)}" target="_blank" rel="noopener">${esc(c.license)}</a> · <a href="${esc(c.source)}" target="_blank" rel="noopener">Source</a></span></figcaption></figure>`).join("");
  });

  /* ---------- données structurées (référencement) ---------- */
  function seo(d) {
    if (body.dataset.page !== "accueil" && body.dataset.page !== "contact") return;
    const s = document.createElement("script"); s.type = "application/ld+json";
    s.textContent = JSON.stringify({
      "@context": "https://schema.org", "@type": "Organization", name: d.company || "PURCA",
      description: d.heroText, telephone: d.phone, email: d.email, logo: new URL("assets/img/logo.png", location.href).href,
      address: { "@type": "PostalAddress", streetAddress: d.address, addressCountry: "CI" }, url: new URL("index.html", location.href).href,
    });
    document.head.appendChild(s);
  }

  /* =========================================================
     Produits
     ========================================================= */
  const CATS = { tsr: "Caoutchouc TSR", latex: "Latex", rss: "Feuilles RSS" };
  const catLabel = (c) => CATS[c] || c || "";
  const IMG = "assets/img/plantation.jpg";
  // « TSR 10 » devient « TSR » en petit et « 10 » en grand
  const gradeHTML = (g) => { const m = String(g || "").match(/^(\D*?)\s*(\d.*)$/); return m && m[1] ? `<small>${esc(m[1])}</small>${esc(m[2])}` : esc(g); };
  const priceText = (p) => p.price ? `${esc(p.price)} ${esc(p.currency || "USD")} / ${esc(p.unit || "tonne")}` : "Sur devis";
  const ISO = [
    ["dirt", "Impuretés (tamis 45 µm), max.", "%"], ["ash", "Cendres, max.", "%"], ["nitrogen", "Azote, max.", "%"],
    ["volatile", "Matières volatiles, max.", "%"], ["po", "Plasticité initiale P0, min.", ""], ["pri", "Indice PRI, min.", ""],
  ];
  const isoHTML = (list) => `<thead><tr><th scope="col">Paramètre</th>${list.length > 1 ? list.map((p) => `<th scope="col" class="n">${esc(p.grade || p.name)}</th>`).join("") : '<th scope="col" class="n">Limite</th>'}</tr></thead>
    <tbody>${ISO.map(([k, label, u]) => {
      // barre proportionnelle à la plus grande valeur de la ligne, pour comparer les grades d'un coup d'œil
      const nums = list.map((p) => parseFloat(String((p.specs || {})[k] || "").replace(",", ".")) || 0), max = Math.max(...nums);
      return `<tr><th scope="row">${label}${u ? ` <small>(${u})</small>` : ""}</th>${list.map((p, i) => `<td class="n">${list.length > 1 && max ? `<span class="bar" style="--w:${Math.round(nums[i] / max * 100)}%"></span>` : ""}<span class="v">${esc((p.specs || {})[k] || "—")}</span></td>`).join("")}</tr>`;
    }).join("")}</tbody>`;
  const factsHTML = (p) => [
    ["Grade", esc(p.grade || "—")],
    ["Norme", "ISO 2000"],
    ["Conditionnement", esc(p.packaging || "Balles filmées")],
    ["Prix", priceText(p)],
    ["Disponibilité", p.available === false ? "Rupture" : "En stock", p.available === false ? "ko" : "ok"],
  ].map(([k, v, c]) => `<div><dt>${k}</dt><dd class="${c || ""}">${v}</dd></div>`).join("");

  const currentId = new URLSearchParams(location.search).get("id");
  const cardHTML = (p) => `
    <article class="card ${p.available === false ? "out" : ""}"><span class="card-glow" aria-hidden="true"></span>
      <div class="card-top">
        <span class="chip">${esc(catLabel(p.category))}</span>
        <span class="avail ${p.available === false ? "ko" : "ok"}">${p.available === false ? "Rupture" : "Disponible"}</span>
      </div>
      <a class="card-grade" href="${productURL(p)}">${gradeHTML(p.grade || p.name)}</a>
      <h3><a href="${productURL(p)}">${esc(p.name)}</a></h3>
      <p>${esc(p.description)}</p>
      ${p.specs ? `<dl class="card-specs"><div><dt>Impuretés</dt><dd>≤ ${esc(p.specs.dirt || "—")} %</dd></div><div><dt>Cendres</dt><dd>≤ ${esc(p.specs.ash || "—")} %</dd></div><div><dt>PRI</dt><dd>≥ ${esc(p.specs.pri || "—")}</dd></div></dl>` : ""}
      <div class="tags">${(p.usages || []).map((u) => `<span>${esc(u)}</span>`).join("")}</div>
      <div class="card-foot">
        <span class="price">${priceText(p) === "Sur devis" ? "Prix sur devis" : priceText(p)}</span>
        <span class="card-actions">
          <a class="btn btn-sm btn-ghost" href="${productURL(p)}">Fiche</a>
          <button class="btn btn-sm card-add" type="button" data-name="${esc(p.name)}"><svg class="ic"><use href="#i-plus"/></svg> Devis</button>
        </span>
      </div>
    </article>`;

  fetch("data/products.json" + bust).then((r) => r.json()).then((list) => {
    products = list;
    const box = $("#products");
    if (box) {
      let shown = list;
      if (box.hasAttribute("data-exclude-current")) shown = list.filter((p) => (p.id || p.name) !== currentId);
      if (box.dataset.limit) {
        const feat = shown.filter((p) => p.featured);
        shown = (feat.length >= +box.dataset.limit ? feat : [...feat, ...shown.filter((p) => !p.featured)]).slice(0, +box.dataset.limit);
      }
      box.classList.toggle("products-2", shown.length === 2);
      box.classList.toggle("products-1", shown.length === 1);
      box.innerHTML = shown.length ? shown.map(cardHTML).join("") : '<p class="muted">Aucun produit pour le moment.</p>';
      $$(".card", box).forEach((c) => { c.classList.add("reveal"); tilt(c); }); observe(box);
      box.addEventListener("click", (e) => {
        const add = e.target.closest(".card-add"); if (!add) return;
        const name = add.dataset.name;
        addToBasket(name, 20); addedToast(`<b>${esc(name)}</b> ajouté (20 ${esc(unitOf(name))}).`);
      });
    }
    const qp = $("#q-product"); if (qp) qp.innerHTML = list.map((p) => `<option>${esc(p.name)}</option>`).join("");
    $("#foot-products").innerHTML = list.slice(0, 6).map((p) => `<a href="${productURL(p)}">${esc(p.name)}</a>`).join("");
    const iso = $("#iso-table"); if (iso) iso.innerHTML = isoHTML(list.filter((p) => p.specs));
    if ($("#pp")) renderProductPage(list);
    renderBasket();
  }).catch(() => { const b = $("#products"); if (b) b.innerHTML = '<p class="muted">Impossible de charger les produits.</p>'; });

  /* ---------- page produit ---------- */
  function renderProductPage(list) {
    const p = list.find((x) => (x.id || x.name) === currentId) || list.find((x) => x.name === currentId);
    if (!p) { $("#pp").hidden = true; $("#pp-missing").hidden = false; return; }
    document.title = `${p.name} — PURCA`;
    $('meta[name="description"]').setAttribute("content", `${p.name} — ${p.description}`);
    $("#pp-img").src = p.image || IMG; $("#pp-img").alt = p.name;
    $("#pp-grade").innerHTML = gradeHTML(p.grade);
    $("#pp-crumb").textContent = p.grade || p.name;
    $("#pp-cat").textContent = catLabel(p.category);
    $("#pp-title").textContent = p.name;
    $("#pp-desc").textContent = p.description || "";
    $("#pp-specs").innerHTML = factsHTML(p);
    $("#pp-iso").innerHTML = isoHTML([p]);
    $("#pp-tags").innerHTML = (p.usages || []).map((u) => `<span>${esc(u)}</span>`).join("") || "<span>Tous usages</span>";
    $("#pp-unit").textContent = short(p.unit);
    const setWa = () => ($("#pp-wa").href = `https://wa.me/${site.whatsapp || ""}?text=${encodeURIComponent(`Bonjour PURCA, je souhaite un devis pour : ${p.name} — ${$("#pp-qty").value} ${short(p.unit)}.`)}`);
    setWa(); on("#pp-qty", "input", setWa); if (onSiteReady) onSiteReady.push(setWa);
    on("#pp-add", "click", () => { addToBasket(p.name, $("#pp-qty").value); addedToast(`<b>${esc(p.name)}</b> ajouté à votre devis.`); });
  }

  /* =========================================================
     Lightbox
     ========================================================= */
  const lb = $("#lightbox"), lbImg = $("img", lb); let li = 0;
  const openLb = (i) => {
    const g = site.gallery || []; if (!g.length) return;
    li = (i + g.length) % g.length; lbImg.src = g[li];
    $(".lb-count").textContent = `${li + 1} / ${g.length}`;
    lb.classList.add("open"); lb.setAttribute("aria-hidden", "false"); body.classList.add("lock");
  };
  const closeLb = () => { lb.classList.remove("open"); lb.setAttribute("aria-hidden", "true"); body.classList.remove("lock"); };
  $(".lb-close").onclick = closeLb;
  $(".lb-prev").onclick = () => openLb(li - 1);
  $(".lb-next").onclick = () => openLb(li + 1);
  lb.onclick = (e) => { if (e.target === lb) closeLb(); };
  addEventListener("keydown", (e) => {
    if (e.key === "Escape") { if (lb.classList.contains("open")) closeLb(); if (menu.classList.contains("open")) toggleMenu(false); }
    if (!lb.classList.contains("open")) return;
    if (e.key === "ArrowLeft") openLb(li - 1);
    if (e.key === "ArrowRight") openLb(li + 1);
  });
  document.addEventListener("click", (e) => { if (e.target.closest("#toast a")) $("#toast").classList.remove("show"); });
})();
