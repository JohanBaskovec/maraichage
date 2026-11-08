import { prochaineVente, venteEnCours } from '#lib/server/boutique.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const vente = await venteEnCours(locals.db);
	return {
		vente,
		prochaine: vente ? null : await prochaineVente(locals.db)
	};
};
