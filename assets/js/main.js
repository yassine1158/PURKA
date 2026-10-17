(function () {
  "use strict";

  // English translations. French is the default and is read from the HTML.
  var EN = {
    "skip": "Skip to content",
    "nav.products": "Products",
    "nav.specs": "Specifications",
    "nav.process": "Process",
    "nav.quality": "Quality",
    "nav.quote": "Request a quote",
    "menu": "Menu",
    "hero.eyebrow": "Natural rubber · ISO 2000",
    "hero.title": "Clean, consistent TSR bales, ready for your mixers.",
    "hero.lead": "PURCA processes field coagulum into technically specified natural rubber, TSR10 and TSR20. Every lot is washed, dried, pressed and lab-tested before shipment.",
    "hero.cta": "Request a quote",
    "hero.cta2": "See specifications",
    "tag.weight": "Net weight",
    "tag.size": "Size",
    "tag.film": "Film",
    "facts.grades": "grades in production: TSR10 and TSR20",
    "facts.bale": "per bale, film-wrapped and metal-checked",
    "facts.pallet": "per pallet or crate of 36 bales",
    "facts.lots": "of lots tested before shipment",
    "products.eyebrow": "Our products",
    "products.title": "Two grades, one standard of care",
    "products.lead": "The grade depends on how clean the raw material is and how thoroughly it is washed. Both run on the same line, with the same checks.",
    "p10.badge": "High cleanliness",
    "p10.desc": "Made from selected cup lumps, with more creping and washing passes. For applications where dirt content matters.",
    "p20.badge": "Tyre standard",
    "p20.desc": "The reference grade of the global tyre market. Good mechanical strength and consistent mixing behaviour at a competitive cost.",
    "spec.dirt": "Dirt max.",
    "spec.ash": "Ash max.",
    "uses": "Applications",
    "p10.u1": "Passenger tyres and technical components",
    "p10.u2": "Transmission and conveyor belts",
    "p10.u3": "Hoses, seals and moulded parts",
    "p10.u4": "Soles and footwear",
    "p20.u1": "Truck, bus and agricultural tyres",
    "p20.u2": "Treads and carcasses",
    "p20.u3": "General rubber goods",
    "p20.u4": "Retreading",
    "products.note": "Other grades (TSR5, TSR CV, TSR L) are under study.",
    "specs.eyebrow": "Technical data",
    "specs.title": "Specifications per ISO 2000",
    "specs.lead": "Contract limits for every lot. A certificate of analysis travels with each shipment.",
    "t.param": "Parameter",
    "t.method": "Method",
    "t.dirt": "Dirt retained on 45 µm sieve, max. (%)",
    "t.ash": "Ash, max. (%)",
    "t.n": "Nitrogen, max. (%)",
    "t.vm": "Volatile matter, max. (%)",
    "t.po": "Initial Wallace plasticity P<sub>0</sub>, min.",
    "t.pri": "Plasticity retention index (PRI), min.",
    "pack.bale": "Bale",
    "pack.bale.d": "33.33 kg (35 kg on request), 670 × 330 × 170 mm, wrapped in low-melt PE film that goes straight into the internal mixer.",
    "pack.unit": "Load unit",
    "pack.unit.d": "36 bales per pallet or crate, 1.2 t. 1.26 t version for 35 kg bales.",
    "pack.cont": "Container",
    "pack.cont.d": "About 20 t per 20 ft container, depending on pallet type and customer requirements.",
    "process.eyebrow": "Manufacturing process",
    "process.title": "From cup lump to certified bale",
    "process.lead": "Eight steps, in the order the rubber moves through the factory.",
    "s1.t": "Receiving and sorting",
    "s1.d": "Cup lumps, tree lace and field coagulum are weighed, checked for moisture and sorted by quality. The cleanest lots go to TSR10.",
    "s2.t": "Soaking and pre-breaking",
    "s2.d": "Material soaks in tanks to release sand and bark, then goes through the pre-breaker. Lots are blended for consistency.",
    "s3.t": "Washing",
    "s3.d": "Agitator tanks and a hammer mill remove remaining dirt under running water.",
    "s4.t": "Creping",
    "s4.d": "Three to six grooved-roll crepers under water spray turn the rubber into crepe blankets. TSR10 gets more passes.",
    "s5.t": "Crumbing",
    "s5.d": "The crepe is cut into crumbs and carried by water to the dryer's perforated boxes.",
    "s6.t": "Drying",
    "s6.d": "Hot-air dryer at 110 to 125 °C for 3 to 4 hours. Temperature is controlled to protect plasticity (PRI).",
    "s7.t": "Pressing and packing",
    "s7.d": "Cooled below 60 °C, the rubber is pressed into bales, passed through a metal detector, film-wrapped and palletised.",
    "s8.t": "Testing and certification",
    "s8.d": "Samples from every lot are tested in the lab. The result sets the grade and is printed on the certificate of analysis.",
    "quality.eyebrow": "Quality control",
    "quality.title": "Every lot is measured, not guessed",
    "quality.lead": "TSR is graded on lab results, not appearance. We run these checks on every lot and share the results with our customers.",
    "q1": "Sampling of every lot per ISO 1795",
    "q2": "All six ISO 2000 parameters tested in our in-house lab",
    "q3": "Metal detection on 100% of bales",
    "q4": "Lot traceability on every bale and pallet",
    "q5": "Certificate of analysis with every shipment",
    "contact.eyebrow": "Contact",
    "contact.title": "Tell us what you need",
    "contact.lead": "Give us the grade, volume and destination. We will come back with an offer and a technical data sheet.",
    "c.email": "Email",
    "c.phone": "Phone",
    "c.address": "Address",
    "c.address.v": "Factory address",
    "f.company": "Company",
    "f.name": "Full name",
    "f.email": "Work email",
    "f.grade": "Grade",
    "f.both": "Both",
    "f.volume": "Volume (tonnes / month)",
    "f.country": "Delivery country",
    "f.msg": "Message",
    "f.send": "Send request",
    "footer.tag": "Technically specified natural rubber, TSR10 and TSR20.",
    "footer.rights": "All rights reserved."
  };

  var ERRORS = {
    fr: "Merci de remplir la société, le nom et une adresse e-mail valide.",
    en: "Please fill in company, name and a valid email address."
  };

  var nodes = document.querySelectorAll("[data-i18n]");
  var FR = {};
  nodes.forEach(function (el) { FR[el.getAttribute("data-i18n")] = el.innerHTML; });

  var langBtn = document.getElementById("lang-toggle");
  var current = "fr";

  function setLang(lang) {
    var dict = lang === "en" ? EN : FR;
    nodes.forEach(function (el) {
      var key = el.getAttribute("data-i18n");
      if (dict[key] !== undefined) el.innerHTML = dict[key];
    });
    document.documentElement.lang = lang;
    current = lang;
    langBtn.textContent = lang === "en" ? "FR" : "EN";
    langBtn.setAttribute("aria-label", lang === "en" ? "Passer en français" : "Switch to English");
    try { localStorage.setItem("purca-lang", lang); } catch (e) {}
  }

  langBtn.addEventListener("click", function () { setLang(current === "fr" ? "en" : "fr"); });

  var saved = null;
  try { saved = localStorage.getItem("purca-lang"); } catch (e) {}
  if (saved === "en") setLang("en");

  // Mobile menu
  var menuBtn = document.getElementById("menu-toggle");
  var nav = document.getElementById("nav");
  function closeMenu() { nav.classList.remove("open"); menuBtn.setAttribute("aria-expanded", "false"); }
  menuBtn.addEventListener("click", function () {
    var open = nav.classList.toggle("open");
    menuBtn.setAttribute("aria-expanded", String(open));
  });
  nav.addEventListener("click", function (e) { if (e.target.tagName === "A") closeMenu(); });

  // Hero tag alternates between the two grades
  var tagGrade = document.getElementById("tag-grade");
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (tagGrade && !reduce) {
    setInterval(function () {
      tagGrade.textContent = tagGrade.textContent === "TSR 20" ? "TSR 10" : "TSR 20";
    }, 3000);
  }

  // Quote form: opens the visitor's mail client with a prefilled request
  var form = document.getElementById("quote-form");
  var errorBox = document.getElementById("form-error");
  var to = document.getElementById("contact-email").textContent.trim();

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var f = form.elements;
    var required = [f.company, f.name, f.email];
    var ok = true;
    required.forEach(function (input) {
      var valid = input.value.trim() !== "" && (input.type !== "email" || input.checkValidity());
      input.setAttribute("aria-invalid", valid ? "false" : "true");
      if (!valid) ok = false;
    });
    if (!ok) {
      errorBox.textContent = ERRORS[current];
      errorBox.hidden = false;
      return;
    }
    errorBox.hidden = true;

    var subject = (current === "en" ? "Quote request " : "Demande de devis ") + f.grade.value + " - " + f.company.value.trim();
    var lines = [
      (current === "en" ? "Company: " : "Société : ") + f.company.value.trim(),
      (current === "en" ? "Name: " : "Nom : ") + f.name.value.trim(),
      "E-mail : " + f.email.value.trim(),
      "Grade : " + f.grade.value,
      (current === "en" ? "Volume (t/month): " : "Volume (t/mois) : ") + (f.volume.value || "-"),
      (current === "en" ? "Delivery country: " : "Pays de livraison : ") + (f.country.value.trim() || "-"),
      "",
      f.message.value.trim()
    ];
    window.location.href = "mailto:" + to +
      "?subject=" + encodeURIComponent(subject) +
      "&body=" + encodeURIComponent(lines.join("\n"));
  });

  document.getElementById("year").textContent = new Date().getFullYear();
})();
