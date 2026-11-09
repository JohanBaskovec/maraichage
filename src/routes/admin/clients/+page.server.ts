import { ABSENCES_AVANT_BLOCAGE } from '#lib/config.ts';
import { debloquerClient, listerClientsBloques } from '#lib/server/admin-commandes.ts';
import { texte } from '#lib/server/formulaire.ts';
import type { Actions, PageServerLoad } from './$types';

export const load = (async ({ locals }) => {
	return {
		clients: await listerClientsBloques(locals.db, ABSENCES_AVANT_BLOCAGE),
		seuil: ABSENCES_AVANT_BLOCAGE
	};
}) satisfies PageServerLoad;

export const actions = {
	debloquer: async ({ locals, request }) => {
		const identifiant = texte(await request.formData(), 'identifiant');
		return { debloque: identifiant, excusees: await debloquerClient(locals.db, identifiant) };
	}
} satisfies Actions;
