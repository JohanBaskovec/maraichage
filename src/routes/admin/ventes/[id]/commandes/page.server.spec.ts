import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
	ajouterCreneau,
	ajouterOffre,
	changerStatutVente,
	creerProduit,
	creerVente,
	lireVente
} from '#lib/server/admin.ts';
import { passerCommande } from '#lib/server/commandes.ts';
import type { Db } from '#lib/server/db/index.ts';
import { commandes } from '#lib/server/db/schema.ts';
import { baseDeTest } from '#lib/server/test/d1.ts';
import { evenement } from '#lib/server/test/evenement.ts';
import { actions, load } from './+page.server.ts';

let db: Db;
let fermer: () => Promise<void>;
let venteId: number;
let commandeId: string;

beforeEach(async () => {
	({ db, fermer } = await baseDeTest());
	const p = await creerProduit(db, { nom: 'Concombre', unite: 'piece', pas: 1 });
	const v = await creerVente(db, new Date('2026-11-09T08:00Z'), new Date('2026-11-12T19:00Z'));
	if (!p.ok || !v.ok) throw new Error();
	venteId = v.id;
	await ajouterOffre(db, venteId, p.id, 80, 10);
	await ajouterCreneau(db, venteId, {
		date: '2026-11-14',
		heureDebut: '09:00',
		heureFin: '12:00',
		lieu: 'Ferme',
		capacite: null
	});
	await changerStatutVente(db, venteId, 'publiee');
	const vente = (await lireVente(db, venteId))!;
	const r = await passerCommande(
		db,
		{
			venteId,
			creneauId: vente.creneaux[0].id,
			nom: 'Camille Martin',
			email: 'camille@example.fr',
			telephone: '0612345678',
			modePaiement: 'retrait',
			lignes: [{ offreId: vente.offres[0].id, quantite: 3 }]
		},
		new Date('2026-11-10T10:00Z')
	);
	if (!r.ok) throw new Error();
	commandeId = r.id;
});

afterEach(async () => {
	await fermer();
});

const page = (form: Record<string, string> = {}, url = 'http://localhost/') =>
	evenement(db, { params: { id: String(venteId) }, form, url });

describe('load', () => {
	it('lit les filtres de l’URL et ignore les valeurs inconnues', async () => {
		const data = await load(page({}, 'http://localhost/?statut=nimporte&creneau=abc&q=cam'));
		expect(data.filtres).toEqual({ creneauId: null, statut: 'tout', recherche: 'cam' });
		expect(data.commandes.map((c) => c.nom)).toEqual(['Camille Martin']);
		expect(data.resume).toEqual({ nombre: 1, aEncaisserCentimes: 240, encaisseCentimes: 0 });
	});
});

describe('actions', () => {
	it('marque payée puis récupérée', async () => {
		await actions.payee(page({ commande: commandeId, payee: '1' }));
		await actions.statut(page({ commande: commandeId, statut: 'recuperee' }));
		const [c] = await db.select().from(commandes).where(eq(commandes.id, commandeId));
		expect(c).toMatchObject({ payee: true, statut: 'recuperee' });
		const data = await load(page());
		expect(data.resume).toEqual({ nombre: 1, aEncaisserCentimes: 0, encaisseCentimes: 240 });
	});

	it('refuse un statut hors des changements autorisés', async () => {
		for (const statut of ['annulee', 'en_attente_paiement', 'nimporte', '']) {
			expect(await actions.statut(page({ commande: commandeId, statut }))).toMatchObject({
				status: 400,
				data: { commande: commandeId }
			});
		}
	});

	it('annule et signale une commande inconnue', async () => {
		expect(await actions.annuler(page({ commande: commandeId }))).toBeUndefined();
		const [c] = await db.select().from(commandes).where(eq(commandes.id, commandeId));
		expect(c.statut).toBe('annulee');
		expect(await actions.annuler(page({ commande: 'inconnue' }))).toMatchObject({
			status: 400,
			data: { message: 'Commande introuvable.' }
		});
	});
});

describe('action paiement (virement reçu)', () => {
	it('refuse une commande qui n’attend pas de paiement', async () => {
		expect(await actions.paiement(page({ commande: commandeId }))).toMatchObject({
			status: 400,
			data: { message: 'Cette commande n’attend pas de paiement.' }
		});
	});

	it('confirme un virement attendu', async () => {
		await db
			.update(commandes)
			.set({ statut: 'en_attente_paiement', modePaiement: 'virement' })
			.where(eq(commandes.id, commandeId));
		expect(await actions.paiement(page({ commande: commandeId }))).toBeUndefined();
		const [c] = await db.select().from(commandes).where(eq(commandes.id, commandeId));
		expect(c).toMatchObject({ statut: 'confirmee', payee: true });
	});
});
