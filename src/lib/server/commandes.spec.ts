import { eq, sql } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
	annulerCommande,
	annulerParClient,
	estBloque,
	limiteAnnulation,
	passerCommande,
	type CommandeDemandee
} from './commandes.ts';
import type { Db } from './db/index.ts';
import { commandes, creneaux, lignesCommande, offres, produits, ventes } from './db/schema.ts';
import { baseDeTest } from './test/d1.ts';

const MAINTENANT = new Date('2026-11-10T10:00:00Z');

let db: Db;
let fermer: () => Promise<void>;
let venteId: number;
let creneauId: number;
let concombres: number; // offre à la pièce
let patates: number; // offre au kg

beforeEach(async () => {
	({ db, fermer } = await baseDeTest());
	const [vente] = await db
		.insert(ventes)
		.values({
			ouverture: new Date('2026-11-09T08:00:00Z'),
			cloture: new Date('2026-11-12T20:00:00Z'),
			statut: 'publiee'
		})
		.returning();
	venteId = vente.id;
	const [creneau] = await db
		.insert(creneaux)
		.values({ venteId, date: '2026-11-14', heureDebut: '09:00', heureFin: '12:00', lieu: 'Ferme' })
		.returning();
	creneauId = creneau.id;
	const [p1, p2] = await db
		.insert(produits)
		.values([
			{ nom: 'Concombre', unite: 'piece' },
			{ nom: 'Pommes de terre', unite: 'kg', pas: 500 }
		])
		.returning();
	const [o1, o2] = await db
		.insert(offres)
		.values([
			{ venteId, produitId: p1.id, prixCentimes: 80, qteInitiale: 10 },
			{ venteId, produitId: p2.id, prixCentimes: 250, qteInitiale: 80_000 }
		])
		.returning();
	concombres = o1.id;
	patates = o2.id;
});

afterEach(async () => {
	await fermer();
});

function demande(lignes: CommandeDemandee['lignes'], autres: Partial<CommandeDemandee> = {}) {
	return {
		venteId,
		creneauId,
		nom: 'Camille Martin',
		email: 'camille@example.fr',
		telephone: '06 12 34 56 78',
		modePaiement: 'retrait' as const,
		lignes,
		...autres
	};
}

async function reserve(offreId: number) {
	const [o] = await db.select().from(offres).where(eq(offres.id, offreId));
	return o.qteReservee;
}

describe('passerCommande', () => {
	it('enregistre la commande, recopie les prix et réserve le stock', async () => {
		const r = await passerCommande(
			db,
			demande([
				{ offreId: concombres, quantite: 3 },
				{ offreId: patates, quantite: 1500 }
			]),
			MAINTENANT
		);
		expect(r).toMatchObject({ ok: true, totalCentimes: 3 * 80 + 375 });
		if (!r.ok) return;
		expect(r.reference).toMatch(/^MAR-[2-9A-HJKMNP-Z]{4}$/);

		const [c] = await db.select().from(commandes).where(eq(commandes.id, r.id));
		expect(c).toMatchObject({
			statut: 'confirmee',
			email: 'camille@example.fr',
			telephone: '0612345678',
			payee: false
		});
		const lignes = await db
			.select()
			.from(lignesCommande)
			.where(eq(lignesCommande.commandeId, r.id));
		expect(lignes.map((l) => [l.offreId, l.quantite, l.prixUnitaireCentimes])).toEqual(
			expect.arrayContaining([
				[concombres, 3, 80],
				[patates, 1500, 250]
			])
		);
		expect(await reserve(concombres)).toBe(3);
		expect(await reserve(patates)).toBe(1500);
	});

	it('met un virement en attente de paiement', async () => {
		const r = await passerCommande(
			db,
			demande([{ offreId: concombres, quantite: 1 }], { modePaiement: 'virement' }),
			MAINTENANT
		);
		expect(r.ok).toBe(true);
		const [c] = await db.select().from(commandes);
		expect(c.statut).toBe('en_attente_paiement');
	});

	it("refuse tout le panier si une seule ligne dépasse le stock, et dit ce qu'il reste", async () => {
		await passerCommande(db, demande([{ offreId: concombres, quantite: 7 }]), MAINTENANT);

		const r = await passerCommande(
			db,
			demande([
				{ offreId: patates, quantite: 1000 },
				{ offreId: concombres, quantite: 5 }
			]),
			MAINTENANT
		);
		expect(r).toEqual({
			ok: false,
			erreur: 'stock_insuffisant',
			manques: [{ offreId: concombres, produit: 'Concombre', demande: 5, restant: 3 }]
		});
		// Rien n'a été écrit pour la commande refusée.
		expect(await reserve(patates)).toBe(0);
		expect(await reserve(concombres)).toBe(7);
		expect(await db.$count(commandes)).toBe(1);
		expect(await db.$count(lignesCommande)).toBe(1);
	});

	it('refuse une commande hors des dates de la vente ou sur une vente non publiée', async () => {
		const ligne = [{ offreId: concombres, quantite: 1 }];
		for (const quand of ['2026-11-09T07:59:59Z', '2026-11-12T20:00:00Z']) {
			expect(await passerCommande(db, demande(ligne), new Date(quand))).toEqual({
				ok: false,
				erreur: 'vente_fermee'
			});
		}
		await db.update(ventes).set({ statut: 'brouillon' });
		expect(await passerCommande(db, demande(ligne), MAINTENANT)).toEqual({
			ok: false,
			erreur: 'vente_fermee'
		});
	});

	it('refuse une quantité qui ne respecte pas le pas du produit', async () => {
		const r = await passerCommande(db, demande([{ offreId: patates, quantite: 700 }]), MAINTENANT);
		expect(r).toMatchObject({ ok: false, erreur: 'saisie_invalide' });
	});

	it("refuse une offre ou un créneau d'une autre vente", async () => {
		const [autre] = await db
			.insert(ventes)
			.values({ ouverture: new Date(0), cloture: new Date(1), statut: 'archivee' })
			.returning();
		const [creneauAutre] = await db
			.insert(creneaux)
			.values({
				venteId: autre.id,
				date: '2026-01-01',
				heureDebut: '09:00',
				heureFin: '10:00',
				lieu: 'X'
			})
			.returning();
		expect(
			await passerCommande(
				db,
				demande([{ offreId: concombres, quantite: 1 }], { creneauId: creneauAutre.id }),
				MAINTENANT
			)
		).toMatchObject({ ok: false, erreur: 'saisie_invalide' });
		expect(
			await passerCommande(db, demande([{ offreId: 9999, quantite: 1 }]), MAINTENANT)
		).toMatchObject({ ok: false, erreur: 'saisie_invalide' });
	});

	it('refuse les saisies invalides', async () => {
		const ligne = [{ offreId: concombres, quantite: 1 }];
		for (const autres of [
			{ nom: '  ' },
			{ email: 'pas-un-email' },
			{ telephone: '12' },
			{ lignes: [] },
			{ lignes: [{ offreId: concombres, quantite: 0 }] },
			{ lignes: [{ offreId: concombres, quantite: 1.5 }] },
			{ lignes: [ligne[0], ligne[0]] }
		]) {
			expect(await passerCommande(db, demande(ligne, autres), MAINTENANT)).toMatchObject({
				ok: false,
				erreur: 'saisie_invalide'
			});
		}
		expect(await db.$count(commandes)).toBe(0);
	});

	it('respecte la capacité du créneau', async () => {
		await db.update(creneaux).set({ capacite: 2 });
		const ligne = [{ offreId: concombres, quantite: 1 }];
		expect((await passerCommande(db, demande(ligne), MAINTENANT)).ok).toBe(true);
		expect((await passerCommande(db, demande(ligne), MAINTENANT)).ok).toBe(true);
		expect(await passerCommande(db, demande(ligne), MAINTENANT)).toEqual({
			ok: false,
			erreur: 'creneau_complet'
		});
		expect(await reserve(concombres)).toBe(2);
	});

	it('50 commandes simultanées sur un stock de 10 : exactement 10 unités partent', async () => {
		const resultats = await Promise.all(
			Array.from({ length: 50 }, (_, i) =>
				passerCommande(
					db,
					demande([{ offreId: concombres, quantite: 1 }], { email: `client${i}@example.fr` }),
					MAINTENANT
				)
			)
		);
		expect(resultats.filter((r) => r.ok)).toHaveLength(10);
		expect(resultats.filter((r) => !r.ok && r.erreur === 'stock_insuffisant')).toHaveLength(40);
		expect(await reserve(concombres)).toBe(10);
		const [{ total }] = await db
			.select({ total: sql<number>`sum(${lignesCommande.quantite})` })
			.from(lignesCommande);
		expect(total).toBe(10);
		expect(await db.$count(commandes)).toBe(10);
	}, 30_000);

	it('paniers simultanés de plusieurs produits : jamais de survente ni de panier partiel', async () => {
		await db.update(offres).set({ qteInitiale: 2000 }).where(eq(offres.id, patates));
		const resultats = await Promise.all(
			Array.from({ length: 30 }, (_, i) =>
				passerCommande(
					db,
					demande(
						[
							{ offreId: concombres, quantite: 1 + (i % 3) },
							{ offreId: patates, quantite: 500 }
						],
						{ email: `client${i}@example.fr` }
					),
					MAINTENANT
				)
			)
		);
		const reussies = resultats.filter((r) => r.ok).length;
		expect(reussies).toBeGreaterThan(0);
		expect(reussies).toBeLessThanOrEqual(4); // 2000 g / 500 g
		expect(await reserve(patates)).toBe(reussies * 500);
		expect(await reserve(concombres)).toBeLessThanOrEqual(10);
		const [{ total }] = await db
			.select({ total: sql<number>`coalesce(sum(${lignesCommande.quantite}), 0)` })
			.from(lignesCommande)
			.where(eq(lignesCommande.offreId, concombres));
		expect(await reserve(concombres)).toBe(total);
	}, 30_000);
});

describe('annulerCommande', () => {
	it('rend le stock et la place de créneau, une seule fois', async () => {
		await db.update(creneaux).set({ capacite: 5 });
		const r = await passerCommande(
			db,
			demande([
				{ offreId: concombres, quantite: 4 },
				{ offreId: patates, quantite: 2500 }
			]),
			MAINTENANT
		);
		if (!r.ok) throw new Error('commande refusée');
		await passerCommande(db, demande([{ offreId: concombres, quantite: 1 }]), MAINTENANT);

		expect(await annulerCommande(db, r.id)).toBe(true);
		expect(await reserve(concombres)).toBe(1);
		expect(await reserve(patates)).toBe(0);
		const [c] = await db.select().from(commandes).where(eq(commandes.id, r.id));
		expect(c.statut).toBe('annulee');
		const [cr] = await db.select().from(creneaux);
		expect(cr.nbCommandes).toBe(1);

		// Deuxième annulation : rien ne bouge.
		expect(await annulerCommande(db, r.id)).toBe(false);
		expect(await reserve(concombres)).toBe(1);
		const [cr2] = await db.select().from(creneaux);
		expect(cr2.nbCommandes).toBe(1);
	});

	it("n'annule pas une commande déjà récupérée", async () => {
		const r = await passerCommande(db, demande([{ offreId: concombres, quantite: 2 }]), MAINTENANT);
		if (!r.ok) throw new Error('commande refusée');
		await db.update(commandes).set({ statut: 'recuperee' });
		expect(await annulerCommande(db, r.id)).toBe(false);
		expect(await reserve(concombres)).toBe(2);
	});

	it('renvoie false pour une commande inconnue', async () => {
		expect(await annulerCommande(db, 'inconnue')).toBe(false);
	});
});

describe('limite par produit et par commande', () => {
	it('refuse plus de 20 pas d’un même produit', async () => {
		await db.update(offres).set({ qteInitiale: 500 }).where(eq(offres.id, concombres));
		expect(
			await passerCommande(db, demande([{ offreId: concombres, quantite: 21 }]), MAINTENANT)
		).toMatchObject({ ok: false, erreur: 'saisie_invalide' });
		expect(
			await passerCommande(db, demande([{ offreId: concombres, quantite: 20 }]), MAINTENANT)
		).toMatchObject({ ok: true });
		// Au kg, par 500 g : 10 kg au plus.
		expect(
			await passerCommande(db, demande([{ offreId: patates, quantite: 10_500 }]), MAINTENANT)
		).toMatchObject({ ok: false, erreur: 'saisie_invalide' });
		expect(
			await passerCommande(db, demande([{ offreId: patates, quantite: 10_000 }]), MAINTENANT)
		).toMatchObject({ ok: true });
	});
});

describe('blocage après deux commandes non récupérées', () => {
	async function absence(autres: Partial<CommandeDemandee> = {}) {
		const r = await passerCommande(
			db,
			demande([{ offreId: concombres, quantite: 1 }], autres),
			MAINTENANT
		);
		if (!r.ok) throw new Error(JSON.stringify(r));
		await db.update(commandes).set({ statut: 'non_recuperee' }).where(eq(commandes.id, r.id));
		return r.id;
	}

	it('bloque à la deuxième absence, par e-mail ou par téléphone', async () => {
		await absence();
		expect(await estBloque(db, 'camille@example.fr', '0612345678')).toBe(false);
		expect(
			(await passerCommande(db, demande([{ offreId: concombres, quantite: 1 }]), MAINTENANT)).ok
		).toBe(true);

		// Deuxième absence avec un autre e-mail mais le même téléphone.
		await absence({ email: 'autre@example.fr' });
		expect(await estBloque(db, 'camille@example.fr', '0700000000')).toBe(false);
		expect(await estBloque(db, 'nouveau@example.fr', '0612345678')).toBe(true);
		expect(
			await passerCommande(
				db,
				demande([{ offreId: concombres, quantite: 1 }], { email: 'nouveau@example.fr' }),
				MAINTENANT
			)
		).toEqual({ ok: false, erreur: 'client_bloque' });
	});

	it('ne compte pas les absences excusées', async () => {
		const a = await absence();
		await absence();
		expect(await estBloque(db, 'camille@example.fr', '0612345678')).toBe(true);
		await db.update(commandes).set({ absenceExcusee: true }).where(eq(commandes.id, a));
		expect(await estBloque(db, 'camille@example.fr', '0612345678')).toBe(false);
	});

	it('reconnaît l’e-mail quelle que soit la casse saisie', async () => {
		await absence();
		await absence();
		expect(
			await passerCommande(
				db,
				demande([{ offreId: concombres, quantite: 1 }], {
					email: ' Camille@Example.FR ',
					telephone: '07 00 00 00 00'
				}),
				MAINTENANT
			)
		).toEqual({ ok: false, erreur: 'client_bloque' });
	});
});

describe('annulation par le client (lien avec jeton)', () => {
	// Créneau du samedi 14 novembre à 9 h (Paris) : annulation possible jusqu'à 12 h avant.
	const AVANT = new Date('2026-11-13T19:59:00Z');
	const APRES = new Date('2026-11-13T20:00:00Z');

	it('calcule la limite à partir de l’heure de Paris', () => {
		expect(limiteAnnulation({ date: '2026-11-14', heureDebut: '09:00' }).toISOString()).toBe(
			'2026-11-13T20:00:00.000Z'
		);
	});

	it('annule avant la limite et rend le stock', async () => {
		const r = await passerCommande(db, demande([{ offreId: concombres, quantite: 4 }]), MAINTENANT);
		if (!r.ok) throw new Error();
		expect(await annulerParClient(db, r.jetonAnnulation, AVANT)).toBe('annulee');
		expect(await reserve(concombres)).toBe(0);
		expect(await annulerParClient(db, r.jetonAnnulation, AVANT)).toBe('deja_terminee');
	});

	it('refuse après la limite, sur une commande récupérée, ou avec un jeton inconnu', async () => {
		const r = await passerCommande(db, demande([{ offreId: concombres, quantite: 4 }]), MAINTENANT);
		if (!r.ok) throw new Error();
		expect(await annulerParClient(db, r.jetonAnnulation, APRES)).toBe('trop_tard');
		expect(await reserve(concombres)).toBe(4);
		await db.update(commandes).set({ statut: 'recuperee' });
		expect(await annulerParClient(db, r.jetonAnnulation, AVANT)).toBe('deja_terminee');
		expect(await annulerParClient(db, 'jeton-inconnu', AVANT)).toBe('introuvable');
		expect(await annulerParClient(db, r.id, AVANT)).toBe('introuvable');
	});
});
