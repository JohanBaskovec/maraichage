// Petites mémoires propres à ce navigateur (panier, coordonnées du client).
// Le stockage peut être indisponible (navigation privée, données bloquées) :
// tout est enveloppé et la page doit fonctionner sans.

function lire<T>(cle: string): T | null {
	try {
		const brut = localStorage.getItem(cle);
		return brut ? (JSON.parse(brut) as T) : null;
	} catch {
		return null;
	}
}

function ecrire(cle: string, valeur: unknown) {
	try {
		if (valeur === null) localStorage.removeItem(cle);
		else localStorage.setItem(cle, JSON.stringify(valeur));
	} catch {
		// tant pis : la page fonctionne sans mémoire
	}
}

const clePanier = (venteId: number) => `panier-${venteId}`;

export function chargerPanier(venteId: number): Record<number, number> {
	const brut = lire<Record<string, number>>(clePanier(venteId)) ?? {};
	const panier: Record<number, number> = {};
	for (const [id, qte] of Object.entries(brut)) {
		if (Number.isSafeInteger(qte) && qte > 0) panier[Number(id)] = qte;
	}
	return panier;
}

export function enregistrerPanier(venteId: number, panier: Record<number, number>) {
	ecrire(clePanier(venteId), Object.keys(panier).length ? panier : null);
}

export function viderPanier(venteId: number) {
	ecrire(clePanier(venteId), null);
}

export interface Coordonnees {
	nom: string;
	email: string;
	telephone: string;
}

export const chargerCoordonnees = () => lire<Coordonnees>('coordonnees');
export const enregistrerCoordonnees = (c: Coordonnees) => ecrire('coordonnees', c);
