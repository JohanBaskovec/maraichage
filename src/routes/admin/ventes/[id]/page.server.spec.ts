import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
	ajouterCreneau,
	ajouterOffre,
	creerProduit,
	creerVente,
	lireVente
} from '#lib/server/admin.ts';
import type { Db } from '#lib/server/db/index.ts';
import { baseDeTest } from '#lib/server/test/d1.ts';
import { evenement, executer } from '#lib/server/test/evenement.ts';
import { actions } from './+page.server.ts';

let db: Db;
let fermer: () => Promise<void>;
let venteA: number;
let venteB: number;
let patates: number;

beforeEach(async () => {
	({ db, fermer } = await baseDeTest());
	const p = await creerProduit(db, { nom: 'Pommes de terre', unite: 'kg', pas: 500 });
	const a = await creerVente(db, new Date('2026-11-09T08:00Z'), new Date('2026-11-12T19:00Z'));
	const b = await creerVente(db, new Date('2026-11-16T08:00Z'), new Date('2026-11-19T19:00Z'));
	if (!p.ok || !a.ok || !b.ok) throw new Error();
	[patates, venteA, venteB] = [p.id, a.id, b.id];
});

afterEach(async () => {
	await fermer();
});

const appel = (venteId: number, form: Record<string, string>) =>
	evenement(db, { params: { id: String(venteId) }, form });

describe('actions de la page vente', () => {
	it('lit les prix et quantités saisis à la française (kg → grammes)', async () => {
		await actions.ajouterOffre(
			appel(venteA, { produit: String(patates), prix: '2,50', quantite: '1,5' })
		);
		const v = await lireVente(db, venteA);
		expect(v!.offres[0]).toMatchObject({ prixCentimes: 250, qteInitiale: 1500 });
	});

	it('refuse un prix ou une quantité illisible', async () => {
		const r = await actions.ajouterOffre(
			appel(venteA, { produit: String(patates), prix: 'deux euros', quantite: '10' })
		);
		expect(r).toMatchObject({ status: 400, data: { message: 'Prix invalide.' } });
	});

	it('convertit les dates saisies à l’heure de Paris', async () => {
		await actions.dates(
			appel(venteA, { ouverture: '2026-11-09T08:00', cloture: '2026-11-12T20:00' })
		);
		const v = await lireVente(db, venteA);
		expect(v!.cloture.toISOString()).toBe('2026-11-12T19:00:00.000Z');
	});

	it('ne touche pas à l’offre ou au créneau d’une autre vente via cette page', async () => {
		await ajouterOffre(db, venteB, patates, 250, 10_000);
		await ajouterCreneau(db, venteB, {
			date: '2026-11-21',
			heureDebut: '09:00',
			heureFin: '12:00',
			lieu: 'Ferme',
			capacite: null
		});
		const b = (await lireVente(db, venteB))!;
		const offre = String(b.offres[0].id);
		const creneau = String(b.creneaux[0].id);

		expect(
			await actions.modifierOffre(appel(venteA, { offre, prix: '0', quantite: '0' }))
		).toMatchObject({ status: 400 });
		expect(await actions.retirerOffre(appel(venteA, { offre }))).toMatchObject({ status: 400 });
		expect(await actions.retirerCreneau(appel(venteA, { creneau }))).toMatchObject({
			status: 400
		});
		const apres = (await lireVente(db, venteB))!;
		expect(apres.offres[0]).toMatchObject({ prixCentimes: 250, qteInitiale: 10_000 });
		expect(apres.creneaux).toHaveLength(1);
	});

	it('refuse un statut inconnu', async () => {
		expect(await actions.statut(appel(venteA, { statut: 'supprimee' }))).toMatchObject({
			status: 400
		});
	});

	it('redirige vers la liste après suppression d’une vente vide', async () => {
		expect(await executer(() => actions.supprimer(appel(venteB, {})))).toEqual({
			redirection: '/admin'
		});
		expect(await lireVente(db, venteB)).toBeNull();
	});
});
