import type { Unite } from './prix.ts';

// Saisie et affichage des montants et quantités, à la française.

/** « 0,80 », « 2.5 », « 12 € » → centimes. `null` si illisible ou négatif. */
export function lireEuros(saisie: string): number | null {
	const texte = saisie.replace(/[\s€]/g, '').replace(',', '.');
	if (!/^\d+(\.\d{1,2})?$/.test(texte)) return null;
	return Math.round(Number(texte) * 100);
}

/** 80 → « 0,80 € » */
export function formatEuros(centimes: number): string {
	return (centimes / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
}

/** 80 → « 0,80 » (pour pré-remplir un champ). */
export function eurosPourChamp(centimes: number): string {
	return (centimes / 100).toFixed(2).replace('.', ',');
}

/**
 * Quantité saisie par le maraîcher → unité de base.
 * Pièces et bottes : entier. kg : décimal en kg (« 80 », « 2,5 ») → grammes.
 */
export function lireQuantite(unite: Unite, saisie: string): number | null {
	const texte = saisie.replace(/\s/g, '').replace(',', '.');
	if (unite === 'kg') {
		if (!/^\d+(\.\d{1,3})?$/.test(texte)) return null;
		return Math.round(Number(texte) * 1000);
	}
	if (!/^\d+$/.test(texte)) return null;
	return Number(texte);
}

/** Unité de base → valeur de champ (grammes → kg). */
export function quantitePourChamp(unite: Unite, quantite: number): string {
	return unite === 'kg' ? String(quantite / 1000).replace('.', ',') : String(quantite);
}

const LIBELLES: Record<Unite, [string, string]> = {
	piece: ['pièce', 'pièces'],
	botte: ['botte', 'bottes'],
	kg: ['kg', 'kg']
};

/** 3 pièces, 1 botte, 1500 → « 1,5 kg », 500 → « 500 g » */
export function formatQuantite(unite: Unite, quantite: number): string {
	if (unite === 'kg') {
		if (quantite > 0 && quantite < 1000) return `${quantite} g`;
		return `${(quantite / 1000).toLocaleString('fr-FR')} kg`;
	}
	const [un, plusieurs] = LIBELLES[unite];
	return `${quantite} ${quantite > 1 ? plusieurs : un}`;
}

/** « € / pièce », « € / botte », « € / kg » */
export function libellePrix(unite: Unite): string {
	return `€ / ${LIBELLES[unite][0]}`;
}
