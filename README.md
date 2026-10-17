# PURCA — Site web

Site vitrine de **PURCA**, producteur de caoutchouc naturel technique **TSR10** et **TSR20** en Côte d'Ivoire, avec un **espace administration** pour gérer les produits, les informations de contact, la galerie photo et la FAQ.

Site 100 % statique : hébergement gratuit sur **GitHub Pages**, aucune base de données ni serveur.

## Mise en ligne (GitHub Pages)

1. Sur GitHub, ouvrir le dépôt → **Settings** → **Pages**.
2. *Source* : **Deploy from a branch** → branche **main**, dossier **/ (root)** → **Save**.
3. Après 1–2 minutes, le site est disponible sur `https://yassine1158.github.io/PURKA/`.
4. (Optionnel) Nom de domaine personnalisé (ex. `purca.ci`) : même page, champ **Custom domain**.

## Administration

Adresse : `https://yassine1158.github.io/PURKA/admin/` (lien « Administration » en bas du site).

La connexion se fait avec un **jeton GitHub** — seul le propriétaire du dépôt (ou un collaborateur) peut modifier le site.

### Créer le jeton (une seule fois)
1. GitHub → photo de profil → **Settings** → **Developer settings** → **Personal access tokens** → **Fine-grained tokens** → **Generate new token**.
2. *Repository access* : **Only select repositories** → `PURKA`.
3. *Permissions* → *Repository permissions* → **Contents : Read and write**.
4. Générer, copier le jeton (`github_pat_…`) et le coller dans la page d'administration.

### Ce que l'on peut faire
- **Produits** : ajouter / modifier / supprimer / réordonner (nom, catégorie TSR-latex-RSS, grade, spécifications ISO 2000, conditionnement, prix en USD, EUR ou FCFA ou « sur devis », unité, applications, photo, disponibilité).
- **Informations** : textes d'accueil, à propos, téléphone, WhatsApp, e-mail, adresse, horaires, chiffres clés.
- **Galerie** : ajouter, retirer et réordonner les photos.
- **FAQ** : ajouter, modifier, supprimer et réordonner les questions.

Chaque clic sur **Publier** crée un commit dans le dépôt ; GitHub Pages met le site à jour en 1–2 minutes. Les photos envoyées sont automatiquement redimensionnées.

## Pages

| Page | Fichier |
|---|---|
| Accueil | `index.html` |
| L'entreprise | `entreprise.html` |
| Produits (catalogue et tableau des spécifications ISO 2000) | `produits.html` |
| Fiche d'un produit | `produit.html?id=<id du produit>` (une page par produit, générée automatiquement) |
| Production | `production.html` |
| Galerie | `galerie.html` |
| FAQ | `faq.html` |
| Contact & devis | `contact.html` |
| Crédits photos | `credits.html` |
| Page d'erreur | `404.html` |

## Photos

Les photos actuelles viennent de Wikimedia Commons, sous licence libre (CC BY, CC BY-SA). Leurs auteurs sont cités sur la page `credits.html`. Pour utiliser vos propres photos, ajoutez-les depuis l'administration (Galerie, ou « Changer la photo » sur un produit).

## Structure

```
*.html                pages du site (générées, voir ci-dessous)
assets/css, assets/js styles et scripts (catalogue, demande de devis, galerie, FAQ)
assets/img            photos et logo
data/products.json    catalogue des produits (modifié par l'admin)
data/site.json        informations, chiffres clés, galerie et FAQ (modifiés par l'admin)
data/credits.json     auteurs et licences des photos
admin/                espace administration
tools/                gabarits des pages + générateur
```

### Modifier la structure des pages (développeurs)

Le menu, l'en-tête et le pied de page sont communs à toutes les pages. Ils se trouvent dans `tools/partials/`, et le contenu propre à chaque page dans `tools/pages/`. Après une modification, régénérer les pages :

```bash
python3 tools/build.py
```

Le contenu courant (produits, textes, photos, FAQ) se modifie depuis l'administration, sans toucher au code.

## Aperçu local

```bash
python3 -m http.server 8000
# puis ouvrir http://localhost:8000
```
