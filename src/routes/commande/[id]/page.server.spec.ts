import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
	ajouterCreneau,
	ajouterOffre,
	changerStatutVente,
	creerProduit,
	creerVente,
	lireVente
} from '#lib/server/admin.ts';
import { confirmerPaiement } from '#lib/server/admin-commandes.ts';
import { passerCommande, type CommandeDemandee } from '#lib/server/commandes.ts';
import type { Db } from '#lib/server/db/index.ts';
import { baseDeTest } from '#lib/server/test/d1.ts';
import { evenement } from '#lib/server/test/evenement.ts';
import { load } from './+page.server.ts';

const VIREMENT = { iban: 'FR76 3000 6000 0112 3456 7890 189', bic: null, titulaire: 'Ferme' };

let db: Db;
let fermer: () => Promise<void>;
let venteId: number;
let commande: (mode: CommandeDemandee['modePaiement']) => Promise<string>;

beforeEach(async () => {
	({ db, fermer } = await baseDeTest());
	const p = await creerProduit(db, { nom: 'Concombre', unite: 'piece', pas: 1 });
	const v = await creerVente(db, new Date(Date.now() - 3600_000), new Date(Date.now() + 86400_000));
	if (!p.ok || !v.ok) throw new Error();
	venteId = v.id;
	await ajouterOffre(db, venteId, p.id, 80, 10);
	await ajouterCreneau(db, venteId, {
		date: '2030-01-05',
		heureDebut: '09:00',
		heureFin: '12:00',
		lieu: 'Ferme',
		capacite: null
	});
	await changerStatutVente(db, venteId, 'publiee');
	const vente = (await lireVente(db, venteId))!;
	commande = async (modePaiement) => {
		const r = await passerCommande(db, {
			venteId,
			creneauId: vente.creneaux[0].id,
			nom: 'Camille',
			email: 'camille@example.fr',
			telephone: '0612345678',
			modePaiement,
			lignes: [{ offreId: vente.offres[0].id, quantite: 1 }]
		});
		if (!r.ok) throw new Error(JSON.stringify(r));
		return r.id;
	};
});

afterEach(async () => {
	await fermer();
});

const page = (id: string) => evenement(db, { params: { id }, virement: VIREMENT });

describe('page de confirmation', () => {
	it('donne les coordonnées bancaires pour un virement attendu', async () => {
		const id = await commande('virement');
		const data = await load(page(id));
		expect(data.virement).toEqual(VIREMENT);
		expect(data.commande.paiementAvant).toBeInstanceOf(Date);
	});

	it('ne les donne plus une fois le virement reçu, ni pour un paiement au retrait', async () => {
		const id = await commande('virement');
		await confirmerPaiement(db, venteId, id);
		expect((await load(page(id))).virement).toBeNull();
		expect((await load(page(await commande('retrait')))).virement).toBeNull();
	});
});
