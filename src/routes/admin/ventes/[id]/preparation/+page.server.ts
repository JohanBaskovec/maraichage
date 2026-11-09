import { error } from '@sveltejs/kit';
import { lireVente } from '#lib/server/admin.ts';
import { recapPreparation } from '#lib/server/admin-commandes.ts';
import type { PageServerLoad } from './$types';

export const load = (async ({ locals, params, url }) => {
	const id = Number(params.id);
	const vente = Number.isSafeInteger(id) && id > 0 ? await lireVente(locals.db, id) : null;
	if (!vente) error(404, 'Vente introuvable.');
	const creneauId = Number(url.searchParams.get('creneau')) || null;
	const creneau = vente.creneaux.find((c) => c.id === creneauId) ?? null;
	return {
		vente: { id: vente.id, cloture: vente.cloture, creneaux: vente.creneaux },
		creneau,
		...(await recapPreparation(locals.db, vente.id, creneau?.id ?? null))
	};
}) satisfies PageServerLoad;
