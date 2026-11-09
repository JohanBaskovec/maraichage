import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
	ajouterCreneau,
	ajouterOffre,
	changerStatutVente,
	creerProduit,
	creerVente,
	lireVente
} from '../../src/lib/server/admin.ts';
import { passerCommande } from '../../src/lib/server/commandes.ts';
import type { Db } from '../../src/lib/server/db/index.ts';
import { commandes, offres } from '../../src/lib/server/db/schema.ts';
import { baseDeTest } from '../../src/lib/server/test/d1.ts';
import { courrielsDeTest } from '../../src/lib/server/test/evenement.ts';
import taches, { executerTaches } from './index.ts';

let db: Db;
let d1: D1Database;
let fermer: () => Promise<void>;

beforeEach(async () => {
	({ db, d1, fermer } = await baseDeTest());
});
afterEach(async () => {
	await fermer();
});

describe('Worker des tâches planifiées', () => {
	it('annule les virements expirés à chaque déclenchement', async () => {
		const p = await creerProduit(db, { nom: 'Concombre', unite: 'piece', pas: 1 });
		const v = await creerVente(db, new Date('2026-11-09T08:00Z'), new Date('2026-11-12T19:00Z'));
		if (!p.ok || !v.ok) throw new Error();
		await ajouterOffre(db, v.id, p.id, 80, 10);
		await ajouterCreneau(db, v.id, {
			date: '2026-11-14',
			heureDebut: '09:00',
			heureFin: '12:00',
			lieu: 'Ferme',
			capacite: null
		});
		await changerStatutVente(db, v.id, 'publiee');
		const vente = (await lireVente(db, v.id))!;
		const r = await passerCommande(
			db,
			{
				venteId: v.id,
				creneauId: vente.creneaux[0].id,
				nom: 'Vic',
				email: 'vic@example.fr',
				telephone: '0612345678',
				modePaiement: 'virement',
				lignes: [{ offreId: vente.offres[0].id, quantite: 4 }]
			},
			new Date('2026-11-10T10:00Z')
		);
		if (!r.ok) throw new Error();

		const declencher = (quand: string) =>
			taches.scheduled(
				{ scheduledTime: new Date(quand).getTime(), cron: '*/15 * * * *', noRetry() {} },
				{ DB: d1 }
			);

		await declencher('2026-11-11T09:45:00Z'); // avant la limite (10 h)
		expect((await db.select().from(commandes))[0].statut).toBe('en_attente_paiement');

		await declencher('2026-11-11T10:00:00Z'); // limite atteinte
		const [c] = await db.select().from(commandes).where(eq(commandes.id, r.id));
		expect(c.statut).toBe('annulee');
		const [o] = await db.select().from(offres);
		expect(o.qteReservee).toBe(0);
	});
});

describe('rappels de la veille', () => {
	it('ne sont envoyés que si la clé Resend est configurée', async () => {
		const p = await creerProduit(db, { nom: 'Concombre', unite: 'piece', pas: 1 });
		const v = await creerVente(db, new Date('2026-11-09T08:00Z'), new Date('2026-11-12T19:00Z'));
		if (!p.ok || !v.ok) throw new Error();
		await ajouterOffre(db, v.id, p.id, 80, 10);
		await ajouterCreneau(db, v.id, {
			date: '2026-11-14',
			heureDebut: '09:00',
			heureFin: '12:00',
			lieu: 'Ferme',
			capacite: null
		});
		await changerStatutVente(db, v.id, 'publiee');
		const vente = (await lireVente(db, v.id))!;
		const r = await passerCommande(
			db,
			{
				venteId: v.id,
				creneauId: vente.creneaux[0].id,
				nom: 'Camille',
				email: 'camille@example.fr',
				telephone: '0612345678',
				modePaiement: 'retrait',
				lignes: [{ offreId: vente.offres[0].id, quantite: 1 }]
			},
			new Date('2026-11-10T10:00Z')
		);
		if (!r.ok) throw new Error();
		const veille = new Date('2026-11-13T09:00Z');

		const sansCle = courrielsDeTest();
		expect(await executerTaches({ DB: d1 }, veille, sansCle.courriels)).toEqual({
			virementsExpires: [],
			rappels: []
		});
		expect(sansCle.envoyes).toEqual([]);

		const avecCle = courrielsDeTest();
		expect(
			await executerTaches({ DB: d1, RESEND_API_KEY: 're_test' }, veille, avecCle.courriels)
		).toEqual({ virementsExpires: [], rappels: [r.reference] });
		// Les liens pointent vers l'adresse publique de la boutique.
		expect(avecCle.envoyes[0].texte).toContain('https://ferme.johanbaskovec.fr/annuler/');
	});
});
