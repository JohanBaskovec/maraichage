// Sans 0/O, 1/I/L : lisible au téléphone et dans un libellé de virement.
const ALPHABET_REFERENCE = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

function caracteresAleatoires(alphabet: string, longueur: number): string {
	// Tirage par rejet pour que chaque caractère soit équiprobable.
	const limite = 256 - (256 % alphabet.length);
	let resultat = '';
	while (resultat.length < longueur) {
		for (const octet of crypto.getRandomValues(new Uint8Array(longueur * 2))) {
			if (octet < limite) resultat += alphabet[octet % alphabet.length];
			if (resultat.length === longueur) break;
		}
	}
	return resultat;
}

/** Référence de commande courte, ex. `MAR-4F7K`. */
export function genererReference(): string {
	return 'MAR-' + caracteresAleatoires(ALPHABET_REFERENCE, 4);
}

/** Jeton secret pour le lien d'annulation (256 bits, base64url). */
export function genererJetonAnnulation(): string {
	const octets = crypto.getRandomValues(new Uint8Array(32));
	return btoa(String.fromCharCode(...octets))
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/, '');
}
