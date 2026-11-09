// Coordonnées bancaires pour le paiement par virement.

export interface CoordonneesVirement {
	/** IBAN groupé par 4 caractères, ex. « FR76 3000 6000 0112 3456 7890 189 ». */
	iban: string;
	bic: string | null;
	titulaire: string;
}

const compact = (iban: string) => iban.replace(/\s+/g, '').toUpperCase();

/** Vérifie la clé de contrôle d'un IBAN (norme ISO 13616, modulo 97). */
export function ibanValide(iban: string): boolean {
	const c = compact(iban);
	if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(c)) return false;
	const chiffres = (c.slice(4) + c.slice(0, 4)).replace(/[A-Z]/g, (l) =>
		String(l.charCodeAt(0) - 55)
	);
	let reste = 0;
	for (const chiffre of chiffres) reste = (reste * 10 + Number(chiffre)) % 97;
	return reste === 1;
}

/** « fr7630006000011234567890189 » → « FR76 3000 6000 0112 3456 7890 189 » */
export function formaterIban(iban: string): string {
	return compact(iban).replace(/(.{4})(?=.)/g, '$1 ');
}

/**
 * Coordonnées à partir des secrets du Worker. `null` (virement non proposé) si
 * l'IBAN ou le titulaire manque, ou si l'IBAN est invalide (faute de frappe).
 */
export function lireCoordonneesVirement(secrets: {
	VIREMENT_IBAN?: string;
	VIREMENT_BIC?: string;
	VIREMENT_TITULAIRE?: string;
}): CoordonneesVirement | null {
	const iban = secrets.VIREMENT_IBAN?.trim();
	const titulaire = secrets.VIREMENT_TITULAIRE?.trim();
	if (!iban || !titulaire) return null;
	if (!ibanValide(iban)) {
		console.error('VIREMENT_IBAN est invalide : le paiement par virement est désactivé.');
		return null;
	}
	return { iban: formaterIban(iban), bic: secrets.VIREMENT_BIC?.trim() || null, titulaire };
}
