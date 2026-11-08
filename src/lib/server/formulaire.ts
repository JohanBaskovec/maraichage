/** Petites aides pour lire un FormData sans surprise. */

export function texte(form: FormData, nom: string): string {
	const v = form.get(nom);
	return typeof v === 'string' ? v.trim() : '';
}

/** Entier positif ou nul, sinon `null`. */
export function entier(form: FormData, nom: string): number | null {
	const v = texte(form, nom);
	return /^\d+$/.test(v) ? Number(v) : null;
}
