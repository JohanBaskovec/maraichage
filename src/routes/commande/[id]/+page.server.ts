import { error } from '@sveltejs/kit';
import { lireCommande } from '#lib/server/boutique.ts';
import { qrCodeSvg } from '#lib/server/qrcode.ts';
import { contenuEpc } from '#lib/virement.ts';
import type { PageServerLoad } from './$types';

// L'identifiant (UUID aléatoire) sert de clé d'accès : seul le client qui a passé
// la commande connaît cette adresse.
export const load = (async ({ locals, params, setHeaders }) => {
	const commande = await lireCommande(locals.db, params.id);
	if (!commande) error(404, 'Commande introuvable.');
	setHeaders({ 'cache-control': 'private, no-store', 'x-robots-tag': 'noindex' });
	// Coordonnées bancaires seulement pour un virement encore attendu.
	const virement =
		commande.modePaiement === 'virement' && commande.statut === 'en_attente_paiement'
			? locals.virement
			: null;
	// QR code de virement (format EPC), toujours accompagné de l'IBAN en clair.
	const qrVirement = virement
		? qrCodeSvg(
				contenuEpc({
					titulaire: virement.titulaire,
					iban: virement.iban,
					bic: virement.bic,
					montantCentimes: commande.totalCentimes,
					libelle: commande.reference
				}),
				`QR code du virement de ${commande.reference}`
			)
		: null;
	return { commande, virement, qrVirement };
}) satisfies PageServerLoad;
