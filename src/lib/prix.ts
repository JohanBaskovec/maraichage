export type Unite = 'piece' | 'botte' | 'kg';

/**
 * Prix d'une ligne de commande, en centimes.
 * - pièce / botte : `quantite` est un nombre d'unités, `prixCentimes` le prix unitaire.
 * - kg : `quantite` est en grammes, `prixCentimes` le prix au kg ; arrondi au centime.
 */
export function prixLigneCentimes(unite: Unite, prixCentimes: number, quantite: number): number {
	if (unite === 'kg') return Math.round((prixCentimes * quantite) / 1000);
	return prixCentimes * quantite;
}
