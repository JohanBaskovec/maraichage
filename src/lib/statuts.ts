// Libellés des statuts de commande, côté back-office.

export const LIBELLES_STATUT_COMMANDE = {
	en_attente_paiement: 'Attente virement',
	confirmee: 'À retirer',
	prete: 'Prête',
	recuperee: 'Récupérée',
	annulee: 'Annulée',
	non_recuperee: 'Non récupérée'
} as const;

/** Filtres de la liste des commandes. */
export const FILTRES_STATUT = {
	tout: 'Toutes (sauf annulées)',
	a_retirer: 'À retirer',
	recuperee: 'Récupérées',
	annulee: 'Annulées'
} as const;
export type FiltreStatut = keyof typeof FILTRES_STATUT;
