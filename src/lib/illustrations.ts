// Illustrations des produits (fichiers SVG dans static/illustrations/), choisies
// par le maraîcher dans le back-office. Sans choix : dessin générique.

export const ILLUSTRATIONS = {
	betteraves: 'Betteraves',
	carottes: 'Carottes',
	'celeri-rave': 'Céleri-rave',
	chou: 'Chou',
	mache: 'Mâche',
	poireaux: 'Poireaux',
	'pommes-de-terre': 'Pommes de terre',
	potimarron: 'Potimarron',
	'radis-noir': 'Radis noir'
} as const;

export type Illustration = keyof typeof ILLUSTRATIONS;

export function estIllustration(cle: unknown): cle is Illustration {
	return typeof cle === 'string' && Object.hasOwn(ILLUSTRATIONS, cle);
}

/** Adresse du dessin d'un produit ; dessin générique (cagette) si aucun ou inconnu. */
export function urlIllustration(cle: string | null | undefined): string {
	return `/illustrations/${estIllustration(cle) ? cle : 'panier'}.svg`;
}

/** Longueur maximale de la courte description d'un produit. */
export const DESCRIPTION_MAX = 120;
