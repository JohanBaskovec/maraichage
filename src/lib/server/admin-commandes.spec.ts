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
import {
	annulerCommandeVente,
	changerStatutCommande,
	listerCommandes,
	debloquerClient,
	listerClientsBloques,
	marquerPayee,
	recapPreparation
} from './admin-commandes.ts';
import { estBloque } from './commandes.ts';
import { passerCommande } from './commandes.ts';
import type { Db } from './db/index.ts';
import { commandes, offres } from './db/schema.ts';
import { baseDeTest } from './test/d1.ts';

const PENDANT = new Date('2026-11-10T10:00:00Z');

let db: Db;
let fermer: () => Promise<void>;
let venteId: number;
let autreVente: number;
let concombre: number;
let patates: number;
let matin: number;
let soir: number;

beforeEach(async () => {
	({ db, fermer } = await baseDeTest());
	const a = await creerProduit(db, { nom: 'Concombre', unite: 'piece', pas: 1 });
	const b = await creerProduit(db, { nom: 'Pommes de terre', unite: 'kg', pas: 500 });
	const v = await creerVente(db, new Date('2026-11-09T08:00Z'), new Date('2026-11-12T19:00Z'));
	const w = await creerVente(db, new Date('2026-11-09T08:00Z'), new Date('2026-11-12T19:00Z'));
	if (!a.ok || !b.ok || !v.ok || !w.ok) throw new Error();
	venteId = v.id;
	autreVente = w.id;
	await ajouterOffre(db, venteId, a.id, 80, 100);
	await ajouterOffre(db, venteId, b.id, 250, 50_000);
	for (const heureDebut of ['09:00', '16:00']) {
		await ajouterCreneau(db, venteId, {
			date: '2026-11-14',
			heureDebut,
			heureFin: heureDebut === '09:00' ? '12:00' : '18:00',
			lieu: 'Ferme',
			capacite: null
		});
	}
	await changerStatutVente(db, venteId, 'publiee');
	const vente = (await lireVente(db, venteId))!;
	[concombre, patates] = vente.offres.map((o) => o.id);
	[matin, soir] = vente.creneaux.map((c) => c.id);
});

afterEach(async () => {
	await fermer();
});

async function commander(
	nom: string,
	creneauId: number,
	lignes: [number, number][],
	telephone = '0612345678'
) {
	const r = await passerCommande(
		db,
		{
			venteId,
			creneauId,
			nom,
			email: `${nom.split(' ')[0].toLowerCase()}@example.fr`,
			telephone,
			modePaiement: 'retrait',
			lignes: lignes.map(([offreId, quantite]) => ({ offreId, quantite }))
		},
		PENDANT
	);
	if (!r.ok) throw new Error(JSON.stringify(r));
	return r;
}

async function statut(id: string) {
	const [c] = await db.select().from(commandes).where(eq(commandes.id, id));
	return c;
}

describe('listerCommandes', () => {
	it('trie par créneau puis par nom, avec les lignes de chaque commande', async () => {
		await commander('Zoé Roux', matin, [[concombre, 2]]);
		await commander('Ali Ben', soir, [[patates, 1500]]);
		await commander('ève Dupont', matin, [
			[concombre, 1],
			[patates, 500]
		]);

		const liste = await listerCommandes(db, venteId);
		expect(liste.map((c) => [c.nom, c.creneau.heureDebut])).toEqual([
			['ève Dupont', '09:00'],
			['Zoé Roux', '09:00'],
			['Ali Ben', '16:00']
		]);
		expect(liste[0].lignes).toEqual([
			{ produit: 'Concombre', unite: 'piece', quantite: 1, prixUnitaireCentimes: 80 },
			{ produit: 'Pommes de terre', unite: 'kg', quantite: 500, prixUnitaireCentimes: 250 }
		]);
	});

	it('filtre par créneau, statut et recherche (nom, référence, téléphone)', async () => {
		const a = await commander('Camille Martin', matin, [[concombre, 1]], '0611111111');
		const b = await commander('Dominique Petit', soir, [[concombre, 1]], '0622222222');
		const c = await commander('Lou Garnier', soir, [[concombre, 1]], '0633333333');
		await changerStatutCommande(db, venteId, b.id, 'recuperee');
		await annulerCommandeVente(db, venteId, c.id);

		const noms = async (f: Parameters<typeof listerCommandes>[2]) =>
			(await listerCommandes(db, venteId, f)).map((x) => x.nom);
		expect(await noms({})).toEqual(['Camille Martin', 'Dominique Petit']);
		expect(await noms({ creneauId: soir })).toEqual(['Dominique Petit']);
		expect(await noms({ statut: 'a_retirer' })).toEqual(['Camille Martin']);
		expect(await noms({ statut: 'recuperee' })).toEqual(['Dominique Petit']);
		expect(await noms({ statut: 'annulee' })).toEqual(['Lou Garnier']);
		expect(await noms({ recherche: 'camille' })).toEqual(['Camille Martin']);
		expect(await noms({ recherche: 'CAMILLE mar' })).toEqual(['Camille Martin']);
		expect(await noms({ recherche: a.reference.toLowerCase() })).toEqual(['Camille Martin']);
		expect(await noms({ recherche: '06 22 22' })).toEqual(['Dominique Petit']);
		// Les jokers SQL sont du texte comme un autre.
		expect(await noms({ recherche: '%' })).toEqual([]);
		expect(await noms({ recherche: '_' })).toEqual([]);
	});

	it('ignore les accents dans la recherche', async () => {
		await commander('Élodie Fèvre', matin, [[concombre, 1]]);
		expect((await listerCommandes(db, venteId, { recherche: 'elodie fevre' })).length).toBe(1);
		expect((await listerCommandes(db, venteId, { recherche: 'ÉLODIE' })).length).toBe(1);
	});

	it('ne montre pas les commandes d’une autre vente', async () => {
		await commander('Camille Martin', matin, [[concombre, 1]]);
		expect(await listerCommandes(db, autreVente)).toEqual([]);
	});
});

describe('recapPreparation', () => {
	it('additionne les quantités à préparer, sans les commandes annulées ni récupérées', async () => {
		await commander('A', matin, [
			[concombre, 2],
			[patates, 1500]
		]);
		await commander('B', soir, [[concombre, 3]]);
		const recuperee = await commander('C', matin, [[concombre, 10]]);
		const annulee = await commander('D', matin, [[patates, 5000]]);
		await changerStatutCommande(db, venteId, recuperee.id, 'recuperee');
		await annulerCommandeVente(db, venteId, annulee.id);

		const tout = await recapPreparation(db, venteId);
		expect(tout.totaux).toEqual([
			{ produit: 'Concombre', unite: 'piece', quantite: 5, nbCommandes: 2 },
			{ produit: 'Pommes de terre', unite: 'kg', quantite: 1500, nbCommandes: 1 }
		]);
		expect(tout.fiches.map((f) => f.nom)).toEqual(['A', 'B']);

		const leMatin = await recapPreparation(db, venteId, matin);
		expect(leMatin.totaux.map((t) => [t.produit, t.quantite])).toEqual([
			['Concombre', 2],
			['Pommes de terre', 1500]
		]);
		expect(leMatin.fiches.map((f) => f.nom)).toEqual(['A']);
	});

	it('est vide sans commande', async () => {
		expect(await recapPreparation(db, venteId)).toEqual({ totaux: [], fiches: [] });
	});
});

describe('changerStatutCommande', () => {
	it('suit le retrait : prête, récupérée, et retour en arrière', async () => {
		const c = await commander('A', matin, [[concombre, 1]]);
		expect(await changerStatutCommande(db, venteId, c.id, 'prete')).toEqual({ ok: true });
		expect((await statut(c.id)).statut).toBe('prete');
		expect(await changerStatutCommande(db, venteId, c.id, 'recuperee')).toEqual({ ok: true });
		expect(await changerStatutCommande(db, venteId, c.id, 'confirmee')).toEqual({ ok: true });
		expect((await statut(c.id)).statut).toBe('confirmee');
	});

	it('ne touche jamais au stock', async () => {
		const c = await commander('A', matin, [[concombre, 4]]);
		await changerStatutCommande(db, venteId, c.id, 'recuperee');
		await changerStatutCommande(db, venteId, c.id, 'confirmee');
		const [o] = await db.select().from(offres).where(eq(offres.id, concombre));
		expect(o.qteReservee).toBe(4);
	});

	it('refuse les changements impossibles', async () => {
		const c = await commander('A', matin, [[concombre, 1]]);
		await changerStatutCommande(db, venteId, c.id, 'recuperee');
		// récupérée → prête : non
		expect(await changerStatutCommande(db, venteId, c.id, 'prete')).toMatchObject({ ok: false });

		const annulee = await commander('B', matin, [[concombre, 1]]);
		await annulerCommandeVente(db, venteId, annulee.id);
		for (const s of ['prete', 'recuperee', 'confirmee'] as const) {
			expect(await changerStatutCommande(db, venteId, annulee.id, s)).toMatchObject({ ok: false });
		}
		expect((await statut(annulee.id)).statut).toBe('annulee');

		expect(
			// @ts-expect-error statut volontairement invalide
			await changerStatutCommande(db, venteId, c.id, 'annulee')
		).toMatchObject({ ok: false });
	});

	it('refuse une commande d’une autre vente', async () => {
		const c = await commander('A', matin, [[concombre, 1]]);
		expect(await changerStatutCommande(db, autreVente, c.id, 'recuperee')).toEqual({
			ok: false,
			message: 'Commande introuvable.'
		});
		expect((await statut(c.id)).statut).toBe('confirmee');
	});
});

describe('marquerPayee', () => {
	it('marque et démarque le paiement', async () => {
		const c = await commander('A', matin, [[concombre, 1]]);
		expect(await marquerPayee(db, venteId, c.id, true)).toEqual({ ok: true });
		expect((await statut(c.id)).payee).toBe(true);
		expect(await marquerPayee(db, venteId, c.id, false)).toEqual({ ok: true });
		expect((await statut(c.id)).payee).toBe(false);
	});

	it('refuse une commande annulée ou d’une autre vente', async () => {
		const c = await commander('A', matin, [[concombre, 1]]);
		expect(await marquerPayee(db, autreVente, c.id, true)).toMatchObject({ ok: false });
		await annulerCommandeVente(db, venteId, c.id);
		expect(await marquerPayee(db, venteId, c.id, true)).toMatchObject({ ok: false });
		expect((await statut(c.id)).payee).toBe(false);
	});
});

describe('annulerCommandeVente', () => {
	it('annule et remet le stock en vente', async () => {
		const c = await commander('A', matin, [[concombre, 4]]);
		expect(await annulerCommandeVente(db, venteId, c.id)).toEqual({ ok: true });
		const [o] = await db.select().from(offres).where(eq(offres.id, concombre));
		expect(o.qteReservee).toBe(0);
		expect(await annulerCommandeVente(db, venteId, c.id)).toMatchObject({ ok: false });
	});

	it('refuse une commande récupérée ou d’une autre vente', async () => {
		const c = await commander('A', matin, [[concombre, 4]]);
		expect(await annulerCommandeVente(db, autreVente, c.id)).toEqual({
			ok: false,
			message: 'Commande introuvable.'
		});
		await changerStatutCommande(db, venteId, c.id, 'recuperee');
		expect(await annulerCommandeVente(db, venteId, c.id)).toEqual({
			ok: false,
			message: 'Cette commande a déjà été récupérée : elle ne peut plus être annulée.'
		});
		const [o] = await db.select().from(offres).where(eq(offres.id, concombre));
		expect(o.qteReservee).toBe(4);
	});
});

describe('commandes non récupérées et clients bloqués', () => {
	it('marque non récupérée, et permet de revenir en arrière', async () => {
		const c = await commander('A', matin, [[concombre, 1]]);
		expect(await changerStatutCommande(db, venteId, c.id, 'non_recuperee')).toEqual({ ok: true });
		expect((await statut(c.id)).statut).toBe('non_recuperee');
		expect(await listerCommandes(db, venteId, { statut: 'non_recuperee' })).toHaveLength(1);
		expect(await listerCommandes(db, venteId, { statut: 'a_retirer' })).toHaveLength(0);
		expect(await changerStatutCommande(db, venteId, c.id, 'confirmee')).toEqual({ ok: true });
		// Une commande récupérée ne devient pas « non récupérée ».
		await changerStatutCommande(db, venteId, c.id, 'recuperee');
		expect(await changerStatutCommande(db, venteId, c.id, 'non_recuperee')).toMatchObject({
			ok: false
		});
	});

	it('liste les clients bloqués et les débloque', async () => {
		const a = await commander('Camille Martin', matin, [[concombre, 1]], '0611111111');
		const b = await commander('Camille M.', soir, [[concombre, 1]], '0611111111');
		const seule = await commander('Lou Garnier', soir, [[concombre, 1]], '0622222222');
		for (const c of [a, b, seule]) await changerStatutCommande(db, venteId, c.id, 'non_recuperee');

		const bloques = await listerClientsBloques(db, 2);
		// Même e-mail (camille@…) et même téléphone : listé une seule fois.
		expect(bloques).toEqual([
			{
				identifiant: 'camille@example.fr',
				type: 'email',
				absences: 2,
				noms: ['Camille Martin', 'Camille M.'],
				references: [a.reference, b.reference]
			}
		]);

		expect(await debloquerClient(db, 'camille@example.fr')).toBe(2);
		expect(await listerClientsBloques(db, 2)).toEqual([]);
		expect(await estBloque(db, 'camille@example.fr', '0611111111')).toBe(false);
		// Les commandes restent « non récupérées » (historique), mais excusées.
		expect((await statut(a.id)).statut).toBe('non_recuperee');
		expect(await debloquerClient(db, '')).toBe(0);
	});

	it('repère un client bloqué par son téléphone avec deux e-mails différents', async () => {
		const a = await commander('Sam', matin, [[concombre, 1]], '0633333333');
		const b = await commander('Samuel', soir, [[concombre, 1]], '0633333333');
		for (const c of [a, b]) await changerStatutCommande(db, venteId, c.id, 'non_recuperee');
		expect((await listerClientsBloques(db, 2)).map((c) => [c.type, c.identifiant])).toEqual([
			['telephone', '0633333333']
		]);
		expect(await debloquerClient(db, '0633333333')).toBe(2);
	});
});
