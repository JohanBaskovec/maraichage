import { fail, redirect } from '@sveltejs/kit';
import { creerVente, dupliquerVente, listerVentes } from '#lib/server/admin.ts';
import { entier } from '#lib/server/formulaire.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	return { ventes: await listerVentes(locals.db) };
};

export const actions: Actions = {
	nouvelle: async ({ locals }) => {
		// Vente vide : ouverte maintenant, clôture dans 3 jours ; dates à ajuster ensuite.
		const ouverture = new Date();
		ouverture.setUTCSeconds(0, 0);
		const cloture = new Date(ouverture.getTime() + 3 * 24 * 3600 * 1000);
		const r = await creerVente(locals.db, ouverture, cloture);
		if (!r.ok) return fail(400, { message: r.message });
		redirect(303, `/admin/ventes/${r.id}`);
	},
	dupliquer: async ({ locals, request }) => {
		const id = entier(await request.formData(), 'id');
		if (id === null) return fail(400, { message: 'Vente introuvable.' });
		const r = await dupliquerVente(locals.db, id);
		if (!r.ok) return fail(400, { message: r.message });
		redirect(303, `/admin/ventes/${r.id}`);
	}
};
