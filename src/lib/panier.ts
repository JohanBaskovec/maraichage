import { MAX_PAS_PAR_PRODUIT } from './config.ts';
import { prixLigneCentimes, type Unite } from './prix.ts';

// Le panier vit dans le navigateur. Il voyage vers la page de validation dans
// l'URL (`/commande?o12=3&o14=1500` : offre 12 × 3, offre 14 × 1500 g).

export type Quantites = Map<number, number>;

export function quantitesDepuisUrl(params: URLSearchParams): Quantites {
	const quantites: Quantites = new Map();
	for (const [cle, valeur] of params) {
		const id = /^o(\d+)$/.exec(cle)?.[1];
		if (id && /^\d+$/.test(valeur) && Number(valeur) > 0) quantites.set(Number(id), Number(valeur));
	}
	return quantites;
}

export function quantitesVersUrl(quantites: Quantites): string {
	const params = new URLSearchParams();
	for (const [id, qte] of quantites) if (qte > 0) params.set(`o${id}`, String(qte));
	return params.toString();
}

export interface OffrePanier {
	id: number;
	produit: string;
	unite: Unite;
	pas: number;
	prixCentimes: number;
	restant: number;
}

/** Ce qu'un client peut prendre d'un produit : le stock restant, dans la limite par commande. */
export function quantiteMax(offre: Pick<OffrePanier, 'pas' | 'restant'>): number {
	return Math.min(offre.restant, offre.pas * MAX_PAS_PAR_PRODUIT);
}

export interface LigneRecap {
	offre: OffrePanier;
	quantite: number;
	prixCentimes: number;
	/** La quantité demandée a été réduite (stock restant ou limite par commande). */
	reduite: boolean;
}

/**
 * Récapitulatif d'un panier face au catalogue du moment : les produits disparus
 * sont ignorés, les quantités ramenées à un multiple du pas, au stock restant et
 * à la limite par commande.
 */
export function recapitulatif(offres: OffrePanier[], quantites: Quantites) {
	const lignes: LigneRecap[] = [];
	for (const offre of offres) {
		const demandee = quantites.get(offre.id);
		if (!demandee) continue;
		const auPas = Math.floor(demandee / offre.pas) * offre.pas;
		const quantite = Math.min(auPas, quantiteMax(offre));
		if (quantite <= 0) {
			if (demandee > 0) lignes.push({ offre, quantite: 0, prixCentimes: 0, reduite: true });
			continue;
		}
		lignes.push({
			offre,
			quantite,
			prixCentimes: prixLigneCentimes(offre.unite, offre.prixCentimes, quantite),
			reduite: quantite < demandee
		});
	}
	const totalCentimes = lignes.reduce((s, l) => s + l.prixCentimes, 0);
	return { lignes, totalCentimes };
}
