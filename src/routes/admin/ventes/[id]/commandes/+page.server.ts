import { error, fail } from '@sveltejs/kit';
import { lireVente } from '#lib/server/admin.ts';
import {
	annulerCommandeVente,
	changerStatutCommande,
	FILTRES_STATUT,
	listerCommandes,
	marquerPayee,
	STATUTS_SUIVI,
	type FiltreStatut,
	type StatutSuivi
} from '#lib/server/admin-commandes.ts';
import { texte } from '#lib/server/formulaire.ts';
import type { Actions, PageServerLoad } from './$types';

function idVente(params: { id: string }) {
	const id = Number(params.id);
	if (!Number.isSafeInteger(id) || id <= 0) error(404, 'Vente introuvable.');
	return id;
}

export const load = (async ({ locals, params, url }) => {
	const vente = await lireVente(locals.db, idVente(params));
	if (!vente) error(404, 'Vente introuvable.');
	const statutDemande = url.searchParams.get('statut') ?? 'tout';
	const filtres = {
		creneauId: Number(url.searchParams.get('creneau')) || null,
		statut: (statutDemande in FILTRES_STATUT ? statutDemande : 'tout') as FiltreStatut,
		recherche: url.searchParams.get('q') ?? ''
	};
	const commandes = await listerCommandes(locals.db, vente.id, filtres);
	const nonAnnulees = commandes.filter((c) => c.statut !== 'annulee');
	return {
		vente: {
			id: vente.id,
			cloture: vente.cloture,
			creneaux: vente.creneaux.map(({ id, date, heureDebut, heureFin, lieu }) => ({
				id,
				date,
				heureDebut,
				heureFin,
				lieu
			}))
		},
		filtres,
		commandes,
		resume: {
			nombre: nonAnnulees.length,
			aEncaisserCentimes: nonAnnulees
				.filter((c) => !c.payee)
				.reduce((s, c) => s + c.totalCentimes, 0),
			encaisseCentimes: nonAnnulees.filter((c) => c.payee).reduce((s, c) => s + c.totalCentimes, 0)
		}
	};
}) satisfies PageServerLoad;

const echec = (commande: string, message: string) => fail(400, { commande, message });

export const actions = {
	payee: async ({ locals, params, request }) => {
		const form = await request.formData();
		const commande = texte(form, 'commande');
		const r = await marquerPayee(
			locals.db,
			idVente(params),
			commande,
			texte(form, 'payee') === '1'
		);
		if (!r.ok) return echec(commande, r.message);
	},
	statut: async ({ locals, params, request }) => {
		const form = await request.formData();
		const commande = texte(form, 'commande');
		const statut = texte(form, 'statut') as StatutSuivi;
		if (!STATUTS_SUIVI.includes(statut)) return echec(commande, 'Statut inconnu.');
		const r = await changerStatutCommande(locals.db, idVente(params), commande, statut);
		if (!r.ok) return echec(commande, r.message);
	},
	annuler: async ({ locals, params, request }) => {
		const commande = texte(await request.formData(), 'commande');
		const r = await annulerCommandeVente(locals.db, idVente(params), commande);
		if (!r.ok) return echec(commande, r.message);
	}
} satisfies Actions;
