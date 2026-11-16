// Matrice des droits : source unique, appliquée par le serveur sur chaque route.
// Le navigateur reçoit la même liste uniquement pour afficher ou masquer les boutons.

export const PERMS = {
  'receptions.read': 'Voir les camions et les réceptions',
  'receptions.create': 'Enregistrer une arrivée',
  'receptions.cancel': 'Annuler une réception en cours',
  'qc.decide': 'Contrôle qualité : photos, accepter ou refuser un camion',
  'pesee.write': 'Saisir les pesées (entrée et sortie)',
  'dechargement.write': 'Valider un déchargement au magasin',
  'stock.read': 'Voir le stock',
  'historique.read': 'Voir l’historique complet',
  'export': 'Exporter en Excel / CSV',
  'config.write': 'Modifier les listes (matières, fournisseurs, zones, tests)',
  'achats.read': 'Voir les commandes, factures, prix et paiements',
  'achats.write': 'Créer et modifier commandes, factures et paiements',
  'users.manage': 'Gérer les utilisateurs et leurs rôles',
  'audit.read': 'Consulter le journal des actions',
};

export const ROLES = {
  admin: {
    label: 'Administrateur',
    description: 'Tous les droits, y compris la gestion des utilisateurs.',
    perms: Object.keys(PERMS),
  },
  comptable: {
    label: 'Comptabilité',
    description: 'Voit tout (réceptions, stock, historique, achats, journal) et gère commandes, factures et paiements. Ne saisit pas les opérations du terrain.',
    perms: ['receptions.read', 'stock.read', 'historique.read', 'export', 'achats.read', 'achats.write', 'audit.read'],
  },
  controleur: {
    label: 'Contrôle qualité',
    description: 'Voit uniquement la réception (camions et contrôles qualité) et valide ou refuse les camions avec photos. Aucun accès au stock, aux prix ni aux paiements.',
    perms: ['receptions.read', 'qc.decide'],
  },
  bascule: {
    label: 'Agent bascule',
    description: 'Enregistre les arrivées, saisit les pesées, peut annuler une réception en cours et consulte l’historique des réceptions.',
    perms: ['receptions.read', 'receptions.create', 'receptions.cancel', 'pesee.write', 'historique.read'],
  },
  magasinier: {
    label: 'Magasinier',
    description: 'Valide les déchargements, consulte le stock et l’historique des réceptions.',
    perms: ['receptions.read', 'dechargement.write', 'stock.read', 'historique.read'],
  },
};

export const permsOf = role => ROLES[role]?.perms ?? [];
export const can = (user, perm) => !!user && !!user.active && permsOf(user.role).includes(perm);
