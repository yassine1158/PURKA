# PURCA

Site vitrine de PURCA, producteur de caoutchouc naturel technique **TSR10** et **TSR20** en Côte d'Ivoire.

Site statique (HTML, CSS, JavaScript), sans dépendance ni étape de build. Disponible en français et en anglais.

## Structure

```
index.html            Page principale
assets/css/style.css  Styles (thème clair et sombre)
assets/js/main.js     Traduction FR/EN, menu mobile, formulaire de devis
assets/img/logo.svg   Logo
```

## Lancer en local

Ouvrir `index.html` dans un navigateur, ou :

```
python3 -m http.server 8000
```

puis aller sur http://localhost:8000.

## Mise en ligne

Le site peut être publié avec GitHub Pages : Settings → Pages → Deploy from a branch → `main` / `root`.

## À compléter

Les coordonnées dans la section Contact de `index.html` (e-mail, téléphone, adresse) sont à remplacer par les vraies informations. Le formulaire de devis ouvre la messagerie du visiteur avec un message prérempli adressé à l'e-mail indiqué dans cette section.
