import { error } from '@sveltejs/kit';
import { lireCommande } from '#lib/server/boutique.ts';
import type { PageServerLoad } from './$types';

// L'identifiant (UUID aléatoire) sert de clé d'accès : seul le client qui a passé
// la commande connaît cette adresse.
export const load: PageServerLoad = async ({ locals, params, setHeaders }) => {
	const commande = await lireCommande(locals.db, params.id);
	if (!commande) error(404, 'Commande introuvable.');
	setHeaders({ 'cache-control': 'private, no-store', 'x-robots-tag': 'noindex' });
	return { commande };
};
