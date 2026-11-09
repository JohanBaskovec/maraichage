import { error } from '@sveltejs/kit';
import { lireCommandeParJeton } from '#lib/server/boutique.ts';
import { annulerParClient } from '#lib/server/commandes.ts';
import type { Actions, PageServerLoad } from './$types';

// Lien d'annulation envoyé au client (jeton secret). Ouvrir la page n'annule
// rien : les messageries ouvrent parfois les liens toutes seules pour les
// vérifier. L'annulation demande un clic sur le bouton (POST).
export const load = (async ({ locals, params, setHeaders }) => {
	const commande = await lireCommandeParJeton(locals.db, params.jeton);
	if (!commande) error(404, 'Lien d’annulation invalide.');
	setHeaders({ 'cache-control': 'private, no-store', 'x-robots-tag': 'noindex' });
	return {
		commande,
		tropTard: new Date() >= commande.limiteAnnulation
	};
}) satisfies PageServerLoad;

export const actions = {
	default: async ({ locals, params }) => {
		return { resultat: await annulerParClient(locals.db, params.jeton) };
	}
} satisfies Actions;
