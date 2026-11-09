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
import { commandes, offres } from '#lib/server/db/schema.ts';
import { baseDeTest } from '#lib/server/test/d1.ts';
import { evenement } from '#lib/server/test/evenement.ts';
import { actions, load } from './+page.server.ts';

let db: Db;
let fermer: () => Promise<void>;
let jeton: string;
let id: string;

beforeEach(async () => {
	({ db, fermer } = await baseDeTest());
	const p = await creerProduit(db, { nom: 'Concombre', unite: 'piece', pas: 1 });
	const maintenant = Date.now();
	const v = await creerVente(db, new Date(maintenant - 3600_000), new Date(maintenant + 86400_000));
	if (!p.ok || !v.ok) throw new Error();
	await ajouterOffre(db, v.id, p.id, 80, 10);
	await ajouterCreneau(db, v.id, {
		date: '2030-01-05',
		heureDebut: '09:00',
		heureFin: '12:00',
		lieu: 'Ferme',
		capacite: null
	});
	await changerStatutVente(db, v.id, 'publiee');
	const vente = (await lireVente(db, v.id))!;
	const r = await passerCommande(db, {
		venteId: v.id,
		creneauId: vente.creneaux[0].id,
		nom: 'Camille',
		email: 'camille@example.fr',
		telephone: '0612345678',
		modePaiement: 'retrait',
		lignes: [{ offreId: vente.offres[0].id, quantite: 3 }]
	});
	if (!r.ok) throw new Error();
	jeton = r.jetonAnnulation;
	id = r.id;
});

afterEach(async () => {
	await fermer();
});

const page = (j: string) => evenement(db, { params: { jeton: j } });

describe('lien d’annulation', () => {
	it('ouvrir la page n’annule rien', async () => {
		const data = await load(page(jeton));
		expect(data.commande).toMatchObject({ statut: 'confirmee', annulable: true });
		expect(data.tropTard).toBe(false);
		const [c] = await db.select().from(commandes).where(eq(commandes.id, id));
		expect(c.statut).toBe('confirmee');
	});

	it('le bouton annule et rend le stock', async () => {
		expect(await actions.default(page(jeton))).toEqual({ resultat: 'annulee' });
		const [o] = await db.select().from(offres);
		expect(o.qteReservee).toBe(0);
		expect(await actions.default(page(jeton))).toEqual({ resultat: 'deja_terminee' });
	});

	it('un jeton inconnu répond 404', async () => {
		await expect(load(page('inconnu'))).rejects.toMatchObject({ status: 404 });
		// L'identifiant de la commande n'est pas le jeton.
		await expect(load(page(id))).rejects.toMatchObject({ status: 404 });
		expect(await actions.default(page('inconnu'))).toEqual({ resultat: 'introuvable' });
	});
});
