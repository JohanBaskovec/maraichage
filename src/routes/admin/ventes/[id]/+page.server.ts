import { error, fail, redirect } from '@sveltejs/kit';
import { lireEuros, lireQuantite } from '#lib/format.ts';
import { depuisChampParis } from '#lib/heure.ts';
import {
	type CommandeConcernee,
	ajouterCreneau,
	ajouterOffre,
	changerStatutVente,
	lireVente,
	listerProduits,
	modifierDatesVente,
	modifierOffre,
	retirerCreneau,
	retirerOffre,
	supprimerVente
} from '#lib/server/admin.ts';
import type { StatutVente } from '#lib/server/db/schema.ts';
import { entier, texte } from '#lib/server/formulaire.ts';
import type { Actions, PageServerLoad } from './$types';

/** Forme commune des réponses des actions, pour `form` dans la page. */
interface Retour {
	action: string;
	ok?: boolean;
	message?: string;
	id?: number;
	offre?: number | null;
	creneau?: number | null;
	sousReserve?: { reservee: number; commandes: CommandeConcernee[] };
}
const echec = (r: Retour) => fail(400, r);
const reussite = (r: Retour): Retour => ({ ...r, ok: true });

function idVente(params: { id: string }) {
	const id = Number(params.id);
	if (!Number.isSafeInteger(id) || id <= 0) error(404, 'Vente introuvable.');
	return id;
}

export const load: PageServerLoad = async ({ locals, params }) => {
	const vente = await lireVente(locals.db, idVente(params));
	if (!vente) error(404, 'Vente introuvable.');
	const dejaEnVente = new Set(vente.offres.map((o) => o.produitId));
	const produits = (await listerProduits(locals.db)).filter(
		(p) => p.actif && !dejaEnVente.has(p.id)
	);
	return { vente, produits };
};

export const actions: Actions = {
	dates: async ({ locals, params, request }) => {
		const form = await request.formData();
		const ouverture = depuisChampParis(texte(form, 'ouverture'));
		const cloture = depuisChampParis(texte(form, 'cloture'));
		if (!ouverture || !cloture) return echec({ action: 'dates', message: 'Dates invalides.' });
		const r = await modifierDatesVente(locals.db, idVente(params), ouverture, cloture);
		if (!r.ok) return echec({ action: 'dates', message: r.message });
		return reussite({ action: 'dates', ok: true });
	},

	statut: async ({ locals, params, request }) => {
		const statut = texte(await request.formData(), 'statut') as StatutVente;
		if (!['brouillon', 'publiee', 'archivee'].includes(statut)) {
			return echec({ action: 'statut', message: 'Statut inconnu.' });
		}
		const r = await changerStatutVente(locals.db, idVente(params), statut);
		if (!r.ok) return echec({ action: 'statut', message: r.message });
		return reussite({ action: 'statut', ok: true });
	},

	supprimer: async ({ locals, params }) => {
		const r = await supprimerVente(locals.db, idVente(params));
		if (!r.ok) return echec({ action: 'supprimer', message: r.message });
		redirect(303, '/admin');
	},

	ajouterOffre: async ({ locals, params, request }) => {
		const form = await request.formData();
		const produitId = entier(form, 'produit');
		const produit = (await listerProduits(locals.db)).find((p) => p.id === produitId);
		if (!produit) return echec({ action: 'ajouterOffre', message: 'Choisis un produit.' });
		const prix = lireEuros(texte(form, 'prix'));
		const qte = lireQuantite(produit.unite, texte(form, 'quantite'));
		if (prix === null) return echec({ action: 'ajouterOffre', message: 'Prix invalide.' });
		if (qte === null) return echec({ action: 'ajouterOffre', message: 'Quantité invalide.' });
		const r = await ajouterOffre(locals.db, idVente(params), produit.id, prix, qte);
		if (!r.ok) return echec({ action: 'ajouterOffre', message: r.message });
		return reussite({ action: 'ajouterOffre', ok: true });
	},

	modifierOffre: async ({ locals, params, request }) => {
		const form = await request.formData();
		const offreId = entier(form, 'offre');
		const vente = await lireVente(locals.db, idVente(params));
		const offre = vente?.offres.find((o) => o.id === offreId);
		if (!offre) return echec({ action: 'modifierOffre', message: 'Produit introuvable.' });
		const prix = lireEuros(texte(form, 'prix'));
		const qte = lireQuantite(offre.unite, texte(form, 'quantite'));
		if (prix === null || qte === null) {
			return echec({
				action: 'modifierOffre',
				offre: offre.id,
				message: prix === null ? 'Prix invalide.' : 'Quantité invalide.'
			});
		}
		const r = await modifierOffre(locals.db, offre.id, prix, qte);
		if (!r.ok) {
			return echec({
				action: 'modifierOffre',
				offre: offre.id,
				message: r.message,
				sousReserve: 'sousReserve' in r ? r.sousReserve : undefined
			});
		}
		return reussite({ action: 'modifierOffre', offre: offre.id, ok: true });
	},

	retirerOffre: async ({ locals, params, request }) => {
		const offreId = entier(await request.formData(), 'offre');
		const vente = await lireVente(locals.db, idVente(params));
		if (!vente?.offres.some((o) => o.id === offreId)) {
			return echec({ action: 'retirerOffre', message: 'Produit introuvable.' });
		}
		const r = await retirerOffre(locals.db, offreId!);
		if (!r.ok) return echec({ action: 'retirerOffre', offre: offreId, message: r.message });
		return reussite({ action: 'retirerOffre', ok: true });
	},

	ajouterCreneau: async ({ locals, params, request }) => {
		const form = await request.formData();
		const capaciteSaisie = texte(form, 'capacite');
		const capacite = capaciteSaisie === '' ? null : (entier(form, 'capacite') ?? -1);
		const r = await ajouterCreneau(locals.db, idVente(params), {
			date: texte(form, 'date'),
			heureDebut: texte(form, 'heureDebut'),
			heureFin: texte(form, 'heureFin'),
			lieu: texte(form, 'lieu'),
			capacite
		});
		if (!r.ok) return echec({ action: 'ajouterCreneau', message: r.message });
		return reussite({ action: 'ajouterCreneau', ok: true });
	},

	retirerCreneau: async ({ locals, params, request }) => {
		const creneauId = entier(await request.formData(), 'creneau');
		const vente = await lireVente(locals.db, idVente(params));
		if (!vente?.creneaux.some((c) => c.id === creneauId)) {
			return echec({ action: 'retirerCreneau', message: 'Créneau introuvable.' });
		}
		const r = await retirerCreneau(locals.db, creneauId!);
		if (!r.ok) return echec({ action: 'retirerCreneau', creneau: creneauId, message: r.message });
		return reussite({ action: 'retirerCreneau', ok: true });
	}
};
