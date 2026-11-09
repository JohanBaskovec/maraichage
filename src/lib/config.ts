// Réglages de la boutique.

/** Nom affiché en tête de la boutique et dans les titres de page. */
export const NOM_BOUTIQUE = 'Maraîchage';

/**
 * Quantité maximale d'un produit dans une commande, en nombre de « pas » :
 * 20 pièces, 20 bottes, ou 10 kg pour un produit vendu par 500 g. Évite qu'une
 * fausse commande bloque tout le stock.
 */
export const MAX_PAS_PAR_PRODUIT = 20;

/** Nombre de commandes non récupérées à partir duquel un client ne peut plus commander. */
export const ABSENCES_AVANT_BLOCAGE = 2;

/** Le client peut annuler lui-même sa commande jusqu'à ce délai avant le début du retrait. */
export const ANNULATION_HEURES_AVANT_RETRAIT = 12;
