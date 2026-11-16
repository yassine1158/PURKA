# Évia · Réception MP

Application de réception des matières premières (caoutchouc) d’Évia.
Elle s’ouvre sur **téléphone et PC** dans le navigateur, et peut s’installer comme une application.

**Circuit :** arrivée du camion → **contrôle qualité** (photos, accepter ou refuser) → pesée entrée (brut) → déchargement au magasin → pesée sortie (tare) → entrée en stock → rattachement à la commande, facture et paiement.

Chaque personne a **son identifiant, son mot de passe et son rôle**. Les droits sont vérifiés **par le serveur** à chaque requête : masquer un bouton ne suffit pas pour accéder aux données.

---

## Rôles et droits

| Droit | Administrateur | Comptabilité | Contrôle qualité | Agent bascule | Magasinier |
|---|:-:|:-:|:-:|:-:|:-:|
| Voir les camions et les réceptions | ✓ | ✓ | ✓ | ✓ | ✓ |
| Enregistrer une arrivée | ✓ | | | ✓ | |
| Contrôle qualité (photos, accepter / refuser) | ✓ | | ✓ | | |
| Saisir les pesées | ✓ | | | ✓ | |
| Valider un déchargement | ✓ | | | | ✓ |
| Annuler une réception en cours | ✓ | | | ✓ | |
| Voir le stock | ✓ | ✓ | | | ✓ |
| Voir l’historique | ✓ | ✓ | | ✓ | ✓ |
| Exporter en Excel / CSV | ✓ | ✓ | | | |
| Modifier les listes (matières, fournisseurs, zones) | ✓ | | | | |
| **Voir commandes, prix, factures, paiements** | ✓ | ✓ | | | |
| Gérer commandes, factures, paiements | ✓ | ✓ | | | |
| Gérer les utilisateurs | ✓ | | | | |
| Consulter le journal des actions | ✓ | ✓ | | | |

- **Comptabilité** : voit tout, gère les achats et les paiements, mais ne saisit pas les opérations du terrain.
- **Contrôle qualité** : voit **uniquement la réception** (écrans Camions et Qualité). Aucun accès au stock, aux prix ni aux paiements.

La matrice se trouve dans [`src/permissions.js`](src/permissions.js). Pour changer un droit, modifiez ce fichier et redémarrez le serveur.

---

## Installation (PC Windows de l’usine ou serveur)

1. Installez **Node.js 22 LTS** (version 22.13 ou plus récente) depuis nodejs.org.
2. Copiez ce dossier sur le PC, par exemple `C:\evia\evia-reception`.
3. Dans PowerShell, depuis ce dossier :
   ```powershell
   npm ci
   npm run create-admin
   npm start
   ```
4. Ouvrez `http://localhost:3000` sur ce PC. Depuis un téléphone sur le Wi-Fi de l’usine, ouvrez `http://<adresse-IP-du-PC>:3000`.
   Pour trouver l’adresse IP du PC : `ipconfig`.
5. Connectez-vous avec le compte administrateur, puis créez les comptes de l’équipe dans **Réglages → Utilisateurs**. Chaque compte reçoit un mot de passe provisoire, que la personne doit changer à sa première connexion.

Autorisez le port 3000 dans le pare-feu Windows (réseau privé uniquement).

### Démarrage automatique avec Windows

Utilisez [NSSM](https://nssm.cc/) pour en faire un service Windows :
```powershell
nssm install EviaReception "C:\Program Files\nodejs\node.exe" "--env-file-if-exists=.env --disable-warning=ExperimentalWarning src\server.js"
nssm set EviaReception AppDirectory C:\evia\evia-reception
nssm start EviaReception
```

### HTTPS (recommandé)

Sans HTTPS, les mots de passe passent en clair sur le Wi-Fi. De plus, l’installation comme application sur téléphone exige HTTPS. Deux possibilités :

- **Reverse proxy [Caddy](https://caddyserver.com/)** devant l’application (le plus simple, certificat automatique avec un nom de domaine). Dans `.env` : `TRUST_PROXY=true` et `COOKIE_SECURE=true`.
- **Certificat direct** : dans `.env`, `HTTPS_KEY` et `HTTPS_CERT` pointent vers vos fichiers `.pem`.

Pour un accès depuis l’extérieur de l’usine, passez par un VPN ou un serveur hébergé avec HTTPS. N’ouvrez jamais le port 3000 directement sur Internet.

### Sauvegardes

```powershell
npm run backup
```
Copie la base et les photos dans `data\backups\evia-AAAAMMJJ-HHMM\` et garde les 30 dernières. Planifiez-la chaque jour (Planificateur de tâches Windows), puis copiez ce dossier **hors du PC** : clé USB, NAS ou cloud.

---

## Sécurité mise en place

| Mesure | Détail |
|---|---|
| Mots de passe | Hachés avec scrypt (sel unique). 10 caractères minimum, sans l’identifiant. Mot de passe provisoire à changer à la première connexion. |
| Connexion | Message identique pour un identifiant inconnu ou un mauvais mot de passe. Compte bloqué 15 min après 8 échecs. Limite de 20 tentatives / 15 min par adresse. |
| Session | Cookie `HttpOnly`, `SameSite=Strict`, `Secure` en HTTPS. Jeton aléatoire stocké haché. Expire après 12 h sans activité et au plus tard après 7 jours. |
| Révocation | Désactiver un compte, changer son rôle ou son mot de passe ferme immédiatement ses sessions et son flux en direct. |
| Droits | Chaque route API exige le droit correspondant. Les prix et paiements ne sont jamais envoyés aux rôles sans `achats.read`, y compris dans le flux en direct. |
| Circuit | Le serveur refuse une pesée avant la validation qualité, et toute étape déjà faite ou faite dans le désordre (transactions SQLite). |
| CSRF | En-tête obligatoire sur toute écriture et contrôle de l’origine. |
| En-têtes | CSP stricte (aucun script externe ni en ligne), anti-clickjacking, `nosniff`, HSTS en HTTPS. |
| Entrées | Chaque champ est typé et borné côté serveur (longueur, plage de poids 1 à 100 000 kg, listes de valeurs autorisées). |
| Photos | Type vérifié sur le contenu réel du fichier (JPEG, PNG, WebP), 8 Mo maximum, nom aléatoire. Visibles seulement par les utilisateurs connectés. |
| Dernier admin | Impossible de désactiver ou de rétrograder le dernier administrateur. |
| Journal | Connexions (réussies et refusées), chaque étape, chaque paiement et chaque changement de droits, avec l’utilisateur et l’adresse IP. |

Tests de sécurité automatiques (droits de chaque rôle, circuit, CSRF, blocage du compte, mots de passe) :
```bash
npm test
```

---

## Développement

```
src/
  server.js        démarrage HTTP / HTTPS
  app.js           sécurité (en-têtes, CSRF, sessions) et routes
  permissions.js   matrice rôles → droits
  auth.js          mots de passe, sessions, contrôle des droits
  db.js            base SQLite (node:sqlite, aucun module natif à compiler)
  routes/          réceptions, photos, listes, achats, utilisateurs, journal
public/            interface (HTML, CSS, JS sans framework), installable (PWA)
scripts/           création d’administrateur, sauvegarde
test/              tests de sécurité
```

`npm run dev` relance le serveur à chaque modification.
