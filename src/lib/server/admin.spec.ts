import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
	ajouterCreneau,
	ajouterOffre,
	changerStatutVente,
	creerProduit,
	creerVente,
	dupliquerVente,
	listerProduits,
	listerVentes,
	lireVente,
	modifierDatesVente,
	modifierOffre,
	modifierProduit,
	retirerCreneau,
	retirerOffre,
	supprimerVente
} from './admin.ts';
import { annulerCommande, passerCommande } from './commandes.ts';
import type { Db } from './db/index.ts';
import { produits } from './db/schema.ts';
import { baseDeTest } from './test/d1.ts';

const OUVERTURE = new Date('2026-11-09T08:00:00Z');
const CLOTURE = new Date('2026-11-12T19:00:00Z');
const PENDANT = new Date('2026-11-10T10:00:00Z');

let db: Db;
let fermer: () => Promise<void>;
let concombre: number;
let patate: number;

beforeEach(async () => {
	({ db, fermer } = await baseDeTest());
	const a = await creerProduit(db, { nom: 'Concombre', unite: 'piece', pas: 1 });
	const b = await creerProduit(db, { nom: 'Pommes de terre', unite: 'kg', pas: 500 });
	if (!a.ok || !b.ok) throw new Error('produits');
	concombre = a.id;
	patate = b.id;
});

afterEach(async () => {
	await fermer();
});

async function venteComplete() {
	const v = await creerVente(db, OUVERTURE, CLOTURE);
	if (!v.ok) throw new Error(v.message);
	await ajouterOffre(db, v.id, concombre, 80, 200);
	await ajouterOffre(db, v.id, patate, 250, 80_000);
	await ajouterCreneau(db, v.id, {
		date: '2026-11-14',
		heureDebut: '09:00',
		heureFin: '12:00',
		lieu: 'Ferme',
		capacite: 30
	});
	return v.id;
}

async function commander(venteId: number, offreId: number, quantite: number) {
	const vente = (await lireVente(db, venteId))!;
	const r = await passerCommande(
		db,
		{
			venteId,
			creneauId: vente.creneaux[0].id,
			nom: 'Camille',
			email: 'camille@example.fr',
			telephone: '0612345678',
			modePaiement: 'retrait',
			lignes: [{ offreId, quantite }]
		},
		PENDANT
	);
	if (!r.ok) throw new Error(JSON.stringify(r));
	return r;
}

describe('produits', () => {
	it('refuse un produit sans nom ou avec un pas nul', async () => {
		expect(await creerProduit(db, { nom: ' ', unite: 'piece', pas: 1 })).toMatchObject({
			ok: false
		});
		expect(await creerProduit(db, { nom: 'Radis', unite: 'botte', pas: 0 })).toMatchObject({
			ok: false
		});
	});

	it('enregistre la description et l’illustration, vides = aucune', async () => {
		expect(
			await modifierProduit(db, concombre, {
				nom: 'Concombre',
				unite: 'piece',
				pas: 1,
				description: '  Croquant, sans amertume  ',
				illustration: 'poireaux'
			})
		).toEqual({ ok: true });
		let [p] = (await listerProduits(db)).filter((x) => x.id === concombre);
		expect(p).toMatchObject({ description: 'Croquant, sans amertume', illustration: 'poireaux' });

		await modifierProduit(db, concombre, {
			nom: 'Concombre',
			unite: 'piece',
			pas: 1,
			description: ' ',
			illustration: ''
		});
		[p] = (await listerProduits(db)).filter((x) => x.id === concombre);
		expect(p).toMatchObject({ description: null, illustration: null });
	});

	it('refuse une illustration inconnue ou une description trop longue', async () => {
		const base = { nom: 'Radis', unite: 'botte' as const, pas: 1 };
		expect(await creerProduit(db, { ...base, illustration: '../secret' })).toMatchObject({
			ok: false,
			message: 'Illustration inconnue.'
		});
		expect(await creerProduit(db, { ...base, description: 'x'.repeat(121) })).toMatchObject({
			ok: false
		});
		expect(await creerProduit(db, { ...base, description: 'x'.repeat(120) })).toMatchObject({
			ok: true
		});
	});

	it("n'autorise plus le changement d'unité une fois le produit mis en vente", async () => {
		expect(
			await modifierProduit(db, concombre, { nom: 'Concombre', unite: 'kg', pas: 500 })
		).toEqual({ ok: true });
		await venteComplete();
		expect(
			await modifierProduit(db, patate, { nom: 'Patates', unite: 'piece', pas: 1 })
		).toMatchObject({ ok: false });
		expect(await modifierProduit(db, patate, { nom: 'Patates', unite: 'kg', pas: 1000 })).toEqual({
			ok: true
		});
	});
});

describe('ventes', () => {
	it('crée une vente en brouillon et refuse des dates incohérentes', async () => {
		const id = await venteComplete();
		const vente = await lireVente(db, id);
		expect(vente).toMatchObject({ statut: 'brouillon' });
		expect(vente!.offres.map((o) => o.produit)).toEqual(['Concombre', 'Pommes de terre']);
		expect(await creerVente(db, CLOTURE, OUVERTURE)).toMatchObject({ ok: false });
		expect(await modifierDatesVente(db, id, CLOTURE, OUVERTURE)).toMatchObject({ ok: false });
	});

	it('ne publie pas une vente sans produit ou sans créneau', async () => {
		const v = await creerVente(db, OUVERTURE, CLOTURE);
		if (!v.ok) throw new Error();
		expect(await changerStatutVente(db, v.id, 'publiee')).toMatchObject({ ok: false });
		await ajouterOffre(db, v.id, concombre, 80, 10);
		expect(await changerStatutVente(db, v.id, 'publiee')).toMatchObject({ ok: false });
		await ajouterCreneau(db, v.id, {
			date: '2026-11-14',
			heureDebut: '09:00',
			heureFin: '12:00',
			lieu: 'Ferme',
			capacite: null
		});
		expect(await changerStatutVente(db, v.id, 'publiee')).toEqual({ ok: true });
	});

	it('duplique la semaine précédente : produits actifs, prix, stocks, créneaux décalés, rien de réservé', async () => {
		const source = await venteComplete();
		await changerStatutVente(db, source, 'publiee');
		await commander(source, (await lireVente(db, source))!.offres[0].id, 5);
		await db.update(produits).set({ actif: false }).where(eq(produits.id, patate));

		const copie = await dupliquerVente(db, source);
		if (!copie.ok) throw new Error();
		const v = (await lireVente(db, copie.id))!;
		expect(v.statut).toBe('brouillon');
		expect(v.ouverture.toISOString()).toBe('2026-11-16T08:00:00.000Z');
		expect(v.cloture.toISOString()).toBe('2026-11-19T19:00:00.000Z');
		expect(v.offres).toHaveLength(1);
		expect(v.offres[0]).toMatchObject({
			produit: 'Concombre',
			prixCentimes: 80,
			qteInitiale: 200,
			qteReservee: 0
		});
		expect(v.creneaux).toHaveLength(1);
		expect(v.creneaux[0]).toMatchObject({
			date: '2026-11-21',
			heureDebut: '09:00',
			lieu: 'Ferme',
			capacite: 30,
			nbCommandes: 0
		});
	});

	it('liste les ventes, les plus récentes en premier, avec leurs compteurs', async () => {
		const a = await venteComplete();
		await changerStatutVente(db, a, 'publiee');
		const offre = (await lireVente(db, a))!.offres[0].id;
		await commander(a, offre, 1);
		const annulee = await commander(a, offre, 1);
		await annulerCommande(db, annulee.id);
		const b = await dupliquerVente(db, a);
		if (!b.ok) throw new Error();

		const liste = await listerVentes(db);
		expect(liste.map((v) => [v.id, v.nbOffres, v.nbCommandes])).toEqual([
			[b.id, 2, 0],
			[a, 2, 1]
		]);
	});

	it('ne supprime pas une vente qui a des commandes', async () => {
		const id = await venteComplete();
		await changerStatutVente(db, id, 'publiee');
		await commander(id, (await lireVente(db, id))!.offres[0].id, 1);
		expect(await supprimerVente(db, id)).toMatchObject({ ok: false });
		const vide = await creerVente(db, OUVERTURE, CLOTURE);
		if (!vide.ok) throw new Error();
		expect(await supprimerVente(db, vide.id)).toEqual({ ok: true });
	});
});

describe('offres', () => {
	it('refuse un produit en double dans la même vente', async () => {
		const id = await venteComplete();
		expect(await ajouterOffre(db, id, concombre, 90, 10)).toEqual({
			ok: false,
			message: 'Ce produit est déjà dans la vente.'
		});
	});

	it('refuse de baisser le stock sous le réservé et liste les commandes concernées', async () => {
		const id = await venteComplete();
		await changerStatutVente(db, id, 'publiee');
		const offre = (await lireVente(db, id))!.offres[0].id;
		const c = await commander(id, offre, 12);

		const r = await modifierOffre(db, offre, 80, 10);
		expect(r).toMatchObject({
			ok: false,
			sousReserve: {
				reservee: 12,
				commandes: [{ reference: c.reference, nom: 'Camille', quantite: 12 }]
			}
		});
		expect(await modifierOffre(db, offre, 95, 12)).toEqual({ ok: true });
		const v = (await lireVente(db, id))!;
		expect(v.offres[0]).toMatchObject({ prixCentimes: 95, qteInitiale: 12, qteReservee: 12 });
	});

	it('ne retire pas une offre déjà commandée', async () => {
		const id = await venteComplete();
		await changerStatutVente(db, id, 'publiee');
		const [o1, o2] = (await lireVente(db, id))!.offres;
		await commander(id, o1.id, 1);
		expect(await retirerOffre(db, o1.id)).toMatchObject({ ok: false });
		expect(await retirerOffre(db, o2.id)).toEqual({ ok: true });
	});
});

describe('créneaux', () => {
	it('valide la saisie', async () => {
		const id = await venteComplete();
		const base = {
			date: '2026-11-14',
			heureDebut: '09:00',
			heureFin: '12:00',
			lieu: 'Marché',
			capacite: null
		};
		expect(await ajouterCreneau(db, id, { ...base, heureFin: '08:00' })).toMatchObject({
			ok: false
		});
		expect(await ajouterCreneau(db, id, { ...base, lieu: '' })).toMatchObject({ ok: false });
		expect(await ajouterCreneau(db, id, { ...base, capacite: 0 })).toMatchObject({ ok: false });
		expect(await ajouterCreneau(db, id, base)).toEqual({ ok: true });
	});

	it('ne retire pas un créneau qui a des commandes', async () => {
		const id = await venteComplete();
		await changerStatutVente(db, id, 'publiee');
		const v = (await lireVente(db, id))!;
		await commander(id, v.offres[0].id, 1);
		expect(await retirerCreneau(db, v.creneaux[0].id)).toMatchObject({ ok: false });
	});
});
