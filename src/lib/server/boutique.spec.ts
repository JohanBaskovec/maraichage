import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
	ajouterCreneau,
	ajouterOffre,
	changerStatutVente,
	creerProduit,
	creerVente,
	lireVente
} from './admin.ts';
import { lireCommande, prochaineVente, venteEnCours } from './boutique.ts';
import { passerCommande } from './commandes.ts';
import type { Db } from './db/index.ts';
import { creneaux, offres, produits } from './db/schema.ts';
import { baseDeTest } from './test/d1.ts';

const PENDANT = new Date('2026-11-10T10:00:00Z');

let db: Db;
let fermer: () => Promise<void>;
let venteId: number;

beforeEach(async () => {
	({ db, fermer } = await baseDeTest());
	const a = await creerProduit(db, { nom: 'Concombre', unite: 'piece', pas: 1 });
	const b = await creerProduit(db, { nom: 'Pommes de terre', unite: 'kg', pas: 500 });
	const c = await creerProduit(db, { nom: 'Radis', unite: 'botte', pas: 1 });
	const v = await creerVente(
		db,
		new Date('2026-11-09T08:00:00Z'),
		new Date('2026-11-12T19:00:00Z')
	);
	if (!a.ok || !b.ok || !c.ok || !v.ok) throw new Error();
	venteId = v.id;
	await ajouterOffre(db, venteId, a.id, 80, 10);
	await ajouterOffre(db, venteId, b.id, 250, 1700);
	await ajouterOffre(db, venteId, c.id, 150, 0);
	await ajouterCreneau(db, venteId, {
		date: '2026-11-14',
		heureDebut: '09:00',
		heureFin: '12:00',
		lieu: 'Ferme',
		capacite: 1
	});
	await changerStatutVente(db, venteId, 'publiee');
});

afterEach(async () => {
	await fermer();
});

describe('venteEnCours', () => {
	it('renvoie le catalogue : produits actifs en stock, restant arrondi au pas', async () => {
		const v = await venteEnCours(db, PENDANT);
		expect(v?.id).toBe(venteId);
		expect(v!.offres.map((o) => [o.produit, o.restant])).toEqual([
			['Concombre', 10],
			['Pommes de terre', 1500]
		]);
		expect(v!.creneaux[0]).toMatchObject({ lieu: 'Ferme', complet: false });
		expect(v!.creneaux[0]).not.toHaveProperty('capacite');
	});

	it('masque les produits désactivés et signale les créneaux complets', async () => {
		await db.update(produits).set({ actif: false }).where(eq(produits.nom, 'Concombre'));
		await db.update(creneaux).set({ nbCommandes: 1 });
		const v = await venteEnCours(db, PENDANT);
		expect(v!.offres.map((o) => o.produit)).toEqual(['Pommes de terre']);
		expect(v!.creneaux[0].complet).toBe(true);
	});

	it('ne renvoie rien hors des dates ou pour une vente non publiée', async () => {
		expect(await venteEnCours(db, new Date('2026-11-12T19:00:00Z'))).toBeNull();
		expect(await venteEnCours(db, new Date('2026-11-09T07:00:00Z'))).toBeNull();
		await changerStatutVente(db, venteId, 'brouillon');
		expect(await venteEnCours(db, PENDANT)).toBeNull();
	});

	it('annonce la prochaine vente avant son ouverture', async () => {
		expect(await prochaineVente(db, new Date('2026-11-09T07:00:00Z'))).toMatchObject({
			ouverture: new Date('2026-11-09T08:00:00Z')
		});
		expect(await prochaineVente(db, PENDANT)).toBeNull();
	});
});

describe('lireCommande', () => {
	it('renvoie le récapitulatif avec les prix recopiés', async () => {
		const vente = (await lireVente(db, venteId))!;
		const [concombre, patates] = vente.offres;
		const r = await passerCommande(
			db,
			{
				venteId,
				creneauId: vente.creneaux[0].id,
				nom: 'Camille',
				email: 'camille@example.fr',
				telephone: '0612345678',
				modePaiement: 'retrait',
				lignes: [
					{ offreId: concombre.id, quantite: 2 },
					{ offreId: patates.id, quantite: 1000 }
				]
			},
			PENDANT
		);
		if (!r.ok) throw new Error();
		await db.update(offres).set({ prixCentimes: 999 });

		const c = await lireCommande(db, r.id);
		expect(c).toMatchObject({
			reference: r.reference,
			totalCentimes: 160 + 250,
			creneau: { date: '2026-11-14', lieu: 'Ferme' },
			lignes: [
				{ produit: 'Concombre', quantite: 2, prixUnitaireCentimes: 80 },
				{ produit: 'Pommes de terre', quantite: 1000, prixUnitaireCentimes: 250 }
			]
		});
		expect(await lireCommande(db, 'inconnue')).toBeNull();
	});
});
