(function () {
  "use strict";

  var STATUS = {
    nouveau: "Nouvelle",
    en_cours: "En cours",
    traite: "Traitée"
  };

  var cfg = window.PURCA_CONFIG || {};
  var $ = function (id) { return document.getElementById(id); };

  var views = { setup: $("view-setup"), login: $("view-login"), app: $("view-app") };
  function show(name) {
    Object.keys(views).forEach(function (k) { views[k].hidden = k !== name; });
  }

  if (!cfg.supabaseUrl || !cfg.supabaseAnonKey || !window.supabase) {
    show("setup");
    return;
  }

  var db = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
  var quotes = [];
  var filter = "all";

  // Toast
  var toastTimer;
  function toast(msg, isError) {
    var t = $("toast");
    t.textContent = msg;
    t.classList.toggle("toast-error", !!isError);
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, 3500);
  }

  // Session
  function onSession(session) {
    if (!session) {
      $("admin-user").textContent = "";
      $("logout").hidden = true;
      show("login");
      return;
    }
    $("admin-user").textContent = session.user.email;
    $("logout").hidden = false;
    show("app");
    loadQuotes();
    loadSettings();
  }

  db.auth.getSession().then(function (res) { onSession(res.data.session); });
  db.auth.onAuthStateChange(function (event, session) {
    if (event === "SIGNED_IN" || event === "SIGNED_OUT") onSession(session);
  });

  $("login-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var err = $("login-error");
    var btn = $("login-submit");
    var email = $("login-email").value.trim();
    var password = $("login-password").value;
    if (!email || !password) {
      err.textContent = "Saisissez votre e-mail et votre mot de passe.";
      err.hidden = false;
      return;
    }
    btn.disabled = true;
    db.auth.signInWithPassword({ email: email, password: password }).then(function (res) {
      btn.disabled = false;
      if (res.error) {
        err.textContent = "E-mail ou mot de passe incorrect.";
        err.hidden = false;
        return;
      }
      err.hidden = true;
      $("login-password").value = "";
    });
  });

  $("logout").addEventListener("click", function () { db.auth.signOut(); });

  // Tabs
  var tabs = [$("tab-quotes"), $("tab-settings")];
  tabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
      tabs.forEach(function (t) {
        var on = t === tab;
        t.setAttribute("aria-selected", String(on));
        $(t.getAttribute("aria-controls")).hidden = !on;
      });
    });
  });

  // Quotes
  function loadQuotes() {
    db.from("quotes").select("*").order("created_at", { ascending: false }).then(function (res) {
      if (res.error) {
        toast("Impossible de charger les demandes. Vérifiez que votre compte est administrateur.", true);
        return;
      }
      quotes = res.data || [];
      render();
    });
  }

  function fmtDate(iso) {
    var d = new Date(iso);
    return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" }) +
      " " + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  }

  function cell(text, cls) {
    var td = document.createElement("td");
    if (cls) td.className = cls;
    td.textContent = text == null || text === "" ? "–" : text;
    return td;
  }

  function render() {
    var counts = { all: quotes.length, nouveau: 0, en_cours: 0, traite: 0 };
    var volume = 0;
    quotes.forEach(function (q) {
      counts[q.status] = (counts[q.status] || 0) + 1;
      if (q.status !== "traite" && q.volume) volume += q.volume;
    });
    Object.keys(counts).forEach(function (k) { $("count-" + k).textContent = counts[k]; });
    $("sum-volume").textContent = volume.toLocaleString("fr-FR");
    document.querySelectorAll(".stat[data-filter]").forEach(function (b) {
      b.setAttribute("aria-pressed", String(b.getAttribute("data-filter") === filter));
    });

    var term = $("search").value.trim().toLowerCase();
    var rows = quotes.filter(function (q) {
      if (filter !== "all" && q.status !== filter) return false;
      if (!term) return true;
      return [q.company, q.name, q.email, q.country, q.message].some(function (v) {
        return v && v.toLowerCase().indexOf(term) !== -1;
      });
    });

    var body = $("quotes-body");
    body.textContent = "";
    rows.forEach(function (q) {
      var tr = document.createElement("tr");
      tr.className = "row status-" + q.status;

      tr.appendChild(cell(fmtDate(q.created_at), "mono nowrap"));
      var company = cell(q.company);
      company.classList.add("strong");
      tr.appendChild(company);

      var contact = document.createElement("td");
      var name = document.createElement("div");
      name.textContent = q.name;
      var mail = document.createElement("a");
      mail.href = "mailto:" + q.email;
      mail.textContent = q.email;
      mail.className = "muted small";
      contact.appendChild(name);
      contact.appendChild(mail);
      tr.appendChild(contact);

      tr.appendChild(cell(q.grade, "mono nowrap"));
      tr.appendChild(cell(q.volume != null ? q.volume.toLocaleString("fr-FR") : "", "num"));
      tr.appendChild(cell(q.country));

      var st = document.createElement("td");
      var sel = document.createElement("select");
      sel.className = "status-select";
      sel.setAttribute("aria-label", "Statut de la demande de " + q.company);
      Object.keys(STATUS).forEach(function (k) {
        var o = document.createElement("option");
        o.value = k;
        o.textContent = STATUS[k];
        if (k === q.status) o.selected = true;
        sel.appendChild(o);
      });
      sel.addEventListener("change", function () { updateStatus(q, sel.value); });
      st.appendChild(sel);
      tr.appendChild(st);

      var actions = document.createElement("td");
      actions.className = "nowrap";
      var more = document.createElement("button");
      more.type = "button";
      more.className = "link-btn";
      more.textContent = "Détails";
      more.setAttribute("aria-expanded", "false");
      var del = document.createElement("button");
      del.type = "button";
      del.className = "link-btn danger";
      del.textContent = "Supprimer";
      actions.appendChild(more);
      actions.appendChild(del);
      tr.appendChild(actions);
      body.appendChild(tr);

      var detail = document.createElement("tr");
      detail.className = "detail";
      detail.hidden = true;
      var dtd = document.createElement("td");
      dtd.colSpan = 8;
      var msg = document.createElement("p");
      msg.className = "detail-msg";
      msg.textContent = q.message || "Pas de message.";
      var meta = document.createElement("p");
      meta.className = "muted small";
      meta.textContent = "Langue du formulaire : " + (q.lang === "en" ? "anglais" : "français") + " · Réf. #" + q.id;
      dtd.appendChild(msg);
      dtd.appendChild(meta);
      detail.appendChild(dtd);
      body.appendChild(detail);

      more.addEventListener("click", function () {
        detail.hidden = !detail.hidden;
        more.setAttribute("aria-expanded", String(!detail.hidden));
        more.textContent = detail.hidden ? "Détails" : "Masquer";
      });

      // Two-step delete: the first click arms the button
      var armed = null;
      del.addEventListener("click", function () {
        if (!armed) {
          del.textContent = "Confirmer ?";
          del.classList.add("armed");
          armed = setTimeout(function () {
            armed = null;
            del.textContent = "Supprimer";
            del.classList.remove("armed");
          }, 4000);
          return;
        }
        clearTimeout(armed);
        removeQuote(q);
      });
    });

    $("quotes-empty").hidden = rows.length > 0;
    $("quotes-empty").textContent = quotes.length === 0
      ? "Aucune demande pour le moment. Les demandes envoyées depuis le formulaire du site apparaîtront ici."
      : "Aucune demande ne correspond à ce filtre.";
  }

  function updateStatus(q, status) {
    db.from("quotes").update({ status: status }).eq("id", q.id).then(function (res) {
      if (res.error) {
        toast("Le statut n'a pas pu être modifié.", true);
        render();
        return;
      }
      q.status = status;
      render();
      toast("Statut mis à jour : " + STATUS[status] + ".");
    });
  }

  function removeQuote(q) {
    db.from("quotes").delete().eq("id", q.id).then(function (res) {
      if (res.error) {
        toast("La demande n'a pas pu être supprimée.", true);
        return;
      }
      quotes = quotes.filter(function (x) { return x.id !== q.id; });
      render();
      toast("Demande supprimée.");
    });
  }

  document.querySelectorAll(".stat[data-filter]").forEach(function (b) {
    b.addEventListener("click", function () {
      filter = b.getAttribute("data-filter");
      render();
    });
  });
  $("search").addEventListener("input", render);
  $("refresh").addEventListener("click", loadQuotes);

  $("export").addEventListener("click", function () {
    var header = ["Réf", "Date", "Société", "Nom", "E-mail", "Grade", "Volume (t/mois)", "Pays", "Statut", "Message"];
    var lines = [header].concat(quotes.map(function (q) {
      return [q.id, fmtDate(q.created_at), q.company, q.name, q.email, q.grade, q.volume, q.country, STATUS[q.status], q.message];
    })).map(function (row) {
      return row.map(function (v) {
        var s = v == null ? "" : String(v);
        return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
      }).join(";");
    });
    var blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "purca-demandes-" + new Date().toISOString().slice(0, 10) + ".csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  });

  // Settings
  var settingsForm = $("settings-form");

  function loadSettings() {
    db.from("settings").select("key, value").then(function (res) {
      if (res.error || !res.data) return;
      res.data.forEach(function (row) {
        var input = settingsForm.elements[row.key];
        if (input) input.value = row.value || "";
      });
    });
  }

  settingsForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var err = $("settings-error");
    var ok = $("settings-ok");
    var email = settingsForm.elements.email;
    if (email.value && !email.checkValidity()) {
      err.textContent = "L'adresse e-mail n'est pas valide.";
      err.hidden = false;
      ok.hidden = true;
      return;
    }
    var now = new Date().toISOString();
    var rows = ["email", "phone", "address_fr", "address_en"].map(function (k) {
      return { key: k, value: settingsForm.elements[k].value.trim(), updated_at: now };
    });
    $("settings-submit").disabled = true;
    db.from("settings").upsert(rows).then(function (res) {
      $("settings-submit").disabled = false;
      if (res.error) {
        err.textContent = "Les coordonnées n'ont pas pu être enregistrées.";
        err.hidden = false;
        ok.hidden = true;
        return;
      }
      err.hidden = true;
      ok.hidden = false;
    });
  });
  settingsForm.addEventListener("input", function () { $("settings-ok").hidden = true; });
})();
