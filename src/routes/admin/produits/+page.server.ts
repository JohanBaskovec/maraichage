import { fail } from '@sveltejs/kit';
import {
	creerProduit,
	definirProduitActif,
	listerProduits,
	modifierProduit
} from '#lib/server/admin.ts';
import type { Unite } from '#lib/server/db/schema.ts';
import { entier, texte } from '#lib/server/formulaire.ts';
import type { Actions, PageServerLoad } from './$types';

/** Forme commune des réponses des actions, pour `form` dans la page. */
interface Retour {
	action: string;
	ok?: boolean;
	message?: string;
	id?: number;
	offre?: number;
	creneau?: number;
}
const echec = (r: Retour) => fail(400, r);
const reussite = (r: Retour): Retour => ({ ...r, ok: true });

export const load: PageServerLoad = async ({ locals }) => {
	return { produits: await listerProduits(locals.db) };
};

/** Le pas se saisit en pièces/bottes, ou en kg pour les produits au poids. */
function lireProduit(form: FormData) {
	const unite = texte(form, 'unite') as Unite;
	const pasSaisi = texte(form, 'pas').replace(',', '.');
	const pas =
		unite === 'kg'
			? Math.round(Number(pasSaisi) * 1000)
			: /^\d+$/.test(pasSaisi)
				? Number(pasSaisi)
				: NaN;
	return { nom: texte(form, 'nom'), unite, pas };
}

export const actions: Actions = {
	creer: async ({ locals, request }) => {
		const form = await request.formData();
		const r = await creerProduit(locals.db, lireProduit(form));
		if (!r.ok) return echec({ action: 'creer', message: r.message });
		return reussite({ action: 'creer', ok: true });
	},
	modifier: async ({ locals, request }) => {
		const form = await request.formData();
		const id = entier(form, 'id');
		if (id === null) return echec({ action: 'modifier', message: 'Produit introuvable.' });
		const r = await modifierProduit(locals.db, id, lireProduit(form));
		if (!r.ok) return echec({ action: 'modifier', id, message: r.message });
		return reussite({ action: 'modifier', id, ok: true });
	},
	actif: async ({ locals, request }) => {
		const form = await request.formData();
		const id = entier(form, 'id');
		if (id !== null) await definirProduitActif(locals.db, id, texte(form, 'actif') === '1');
	}
};
