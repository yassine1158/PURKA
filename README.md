# PURCA

Site vitrine de PURCA, producteur de caoutchouc naturel technique **TSR10** et **TSR20** en Côte d'Ivoire.

Site statique (HTML, CSS, JavaScript), sans dépendance ni étape de build. Disponible en français et en anglais.

## Structure

```
index.html            Page principale
admin.html            Espace administration
assets/css/style.css  Styles (thème clair et sombre)
assets/css/admin.css  Styles de l'administration
assets/js/config.js   Paramètres Supabase
assets/js/main.js     Traduction FR/EN, menu mobile, formulaire de devis
assets/js/admin.js    Tableau de bord administrateur
assets/img/logo.svg   Logo
supabase/schema.sql   Tables et règles d'accès de la base
```

## Lancer en local

Ouvrir `index.html` dans un navigateur, ou :

```
python3 -m http.server 8000
```

puis aller sur http://localhost:8000.

## Mise en ligne

Le site peut être publié avec GitHub Pages : Settings → Pages → Deploy from a branch → `main` / `root`.

## Espace administration

L'espace administration (`admin.html`) permet de :

- consulter les demandes de devis envoyées depuis le site ;
- suivre leur statut (nouvelle, en cours, traitée), les rechercher et les filtrer ;
- exporter les demandes en CSV ;
- modifier l'e-mail, le téléphone et l'adresse affichés sur le site.

Les données sont stockées dans [Supabase](https://supabase.com) (offre gratuite suffisante).

### Mise en place

1. Créer un projet sur supabase.com.
2. Dans **SQL Editor**, coller le contenu de `supabase/schema.sql`, remplacer `admin@exemple.com` par l'e-mail de l'administrateur, puis exécuter.
3. Dans **Authentication → Users**, cliquer sur **Add user** et créer le compte administrateur avec ce même e-mail et un mot de passe.
4. Dans **Authentication → Sign In / Providers**, désactiver **Allow new users to sign up**.
5. Dans **Project Settings → API**, copier la **Project URL** et la clé **anon public** dans `assets/js/config.js`.
6. Ouvrir `admin.html` sur le site et se connecter.

Pour ajouter un autre administrateur : créer son compte (étape 3), puis exécuter
`insert into public.admins (email) values ('son-email@exemple.com');`

Tant que `config.js` est vide, le site fonctionne sans base : le formulaire ouvre la messagerie du visiteur.

## À compléter

Les coordonnées de la section Contact de `index.html` (e-mail, téléphone, adresse) sont des valeurs par défaut. Une fois Supabase configuré, elles se modifient depuis l'espace administration.
