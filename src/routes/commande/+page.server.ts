import { fail, redirect } from '@sveltejs/kit';
import { formatQuantite } from '#lib/format.ts';
import { quantitesDepuisUrl, recapitulatif } from '#lib/panier.ts';
import { venteEnCours } from '#lib/server/boutique.ts';
import { passerCommande, type Manque } from '#lib/server/commandes.ts';
import { entier, texte } from '#lib/server/formulaire.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const vente = await venteEnCours(locals.db);
	if (!vente) return { vente: null, recap: null };
	return {
		vente: { id: vente.id, cloture: vente.cloture, creneaux: vente.creneaux },
		recap: recapitulatif(vente.offres, quantitesDepuisUrl(url.searchParams))
	};
};

/** « il ne reste que 3 concombres », « Pommes de terre : épuisé » */
function phraseManque(m: Manque, unite: 'piece' | 'botte' | 'kg') {
	return m.restant > 0
		? `${m.produit} : il n’en reste que ${formatQuantite(unite, m.restant)}.`
		: `${m.produit} : épuisé.`;
}

export const actions: Actions = {
	commander: async ({ locals, request }) => {
		const form = await request.formData();
		const saisie = {
			nom: texte(form, 'nom'),
			email: texte(form, 'email'),
			telephone: texte(form, 'telephone'),
			creneau: entier(form, 'creneau')
		};
		const echec = (message: string) => fail(400, { ...saisie, message });

		const vente = await venteEnCours(locals.db);
		if (!vente) return echec('La vente est terminée : les commandes ne sont plus acceptées.');
		if (saisie.creneau === null) return echec('Choisissez un créneau de retrait.');
		if (texte(form, 'cgv') !== 'oui') {
			return echec('Merci d’accepter les conditions générales de vente.');
		}

		const lignes = [];
		for (const [cle, valeur] of form) {
			const id = /^o(\d+)$/.exec(cle)?.[1];
			if (id && typeof valeur === 'string' && /^\d+$/.test(valeur) && Number(valeur) > 0) {
				lignes.push({ offreId: Number(id), quantite: Number(valeur) });
			}
		}

		const r = await passerCommande(locals.db, {
			venteId: vente.id,
			creneauId: saisie.creneau,
			nom: saisie.nom,
			email: saisie.email,
			telephone: saisie.telephone,
			// Phase 1 : paiement au retrait uniquement.
			modePaiement: 'retrait',
			lignes
		});

		if (r.ok) redirect(303, `/commande/${r.id}`);
		switch (r.erreur) {
			case 'saisie_invalide':
				return echec(r.message);
			case 'vente_fermee':
				return echec('La vente est terminée : les commandes ne sont plus acceptées.');
			case 'creneau_complet':
				return echec('Ce créneau vient d’être complet : choisissez-en un autre.');
			case 'stock_insuffisant': {
				const unites = new Map(vente.offres.map((o) => [o.id, o.unite]));
				const details = r.manques.map((m) => phraseManque(m, unites.get(m.offreId) ?? 'piece'));
				return echec(
					`D’autres clients ont été plus rapides. ${details.join(' ')} Votre panier a été ajusté : vérifiez-le et validez à nouveau.`
				);
			}
		}
	}
};
