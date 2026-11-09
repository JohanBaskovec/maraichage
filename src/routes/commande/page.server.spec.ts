import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
	ajouterCreneau,
	ajouterOffre,
	changerStatutVente,
	creerProduit,
	creerVente,
	lireVente
} from '#lib/server/admin.ts';
import type { Db } from '#lib/server/db/index.ts';
import { commandes } from '#lib/server/db/schema.ts';
import { baseDeTest } from '#lib/server/test/d1.ts';
import { evenement, executer } from '#lib/server/test/evenement.ts';
import { actions, load } from './+page.server.ts';

let db: Db;
let fermer: () => Promise<void>;
let venteId: number;
let concombre: number;
let radis: number;
let creneau: number;

const VIREMENT = {
	iban: 'FR76 3000 6000 0112 3456 7890 189',
	bic: null,
	titulaire: 'Ferme des Tests'
};

beforeEach(async () => {
	({ db, fermer } = await baseDeTest());
	const a = await creerProduit(db, { nom: 'Concombre', unite: 'piece', pas: 1 });
	const b = await creerProduit(db, { nom: 'Radis', unite: 'botte', pas: 1 });
	const maintenant = Date.now();
	const v = await creerVente(
		db,
		new Date(maintenant - 3600_000),
		new Date(maintenant + 3 * 86400_000)
	);
	if (!a.ok || !b.ok || !v.ok) throw new Error();
	venteId = v.id;
	await ajouterOffre(db, venteId, a.id, 80, 50);
	await ajouterOffre(db, venteId, b.id, 150, 1);
	await ajouterCreneau(db, venteId, {
		date: '2030-01-05',
		heureDebut: '09:00',
		heureFin: '12:00',
		lieu: 'Ferme',
		capacite: null
	});
	await changerStatutVente(db, venteId, 'publiee');
	const vente = (await lireVente(db, venteId))!;
	[concombre, radis] = vente.offres.map((o) => o.id);
	creneau = vente.creneaux[0].id;
});

afterEach(async () => {
	await fermer();
});

const formulaire = (autres: Record<string, string> = {}) => ({
	nom: 'Camille Martin',
	email: 'camille@example.fr',
	telephone: '06 12 34 56 78',
	creneau: String(creneau),
	cgv: 'oui',
	[`o${concombre}`]: '2',
	...autres
});

describe('load', () => {
	it('indique si le virement est proposé', async () => {
		expect((await load(evenement(db))).virement).toBe(false);
		expect((await load(evenement(db, { virement: VIREMENT }))).virement).toBe(true);
	});

	it('recalcule le panier de l’URL avec les prix du serveur', async () => {
		const data = await load(
			evenement(db, { url: `http://localhost/commande?o${concombre}=3&o${radis}=4` })
		);
		expect(data.recap!.lignes.map((l) => [l.offre.produit, l.quantite, l.reduite])).toEqual([
			['Concombre', 3, false],
			['Radis', 1, true]
		]);
		expect(data.recap!.totalCentimes).toBe(3 * 80 + 150);
	});
});

describe('action commander', () => {
	it('enregistre la commande au retrait et redirige vers la confirmation', async () => {
		const r = await executer(() => actions.commander(evenement(db, { form: formulaire() })));
		expect(r).toMatchObject({ redirection: expect.stringMatching(/^\/commande\/[0-9a-f-]{36}$/) });
		const [c] = await db.select().from(commandes);
		expect(c).toMatchObject({ modePaiement: 'retrait', statut: 'confirmee', totalCentimes: 160 });
	});

	it('accepte le virement quand il est configuré', async () => {
		const r = await executer(() =>
			actions.commander(
				evenement(db, { form: formulaire({ mode: 'virement' }), virement: VIREMENT })
			)
		);
		expect(r).toHaveProperty('redirection');
		const [c] = await db.select().from(commandes);
		expect(c).toMatchObject({ modePaiement: 'virement', statut: 'en_attente_paiement' });
		expect(c.paiementAvant!.getTime()).toBeGreaterThan(Date.now());
	});

	it('refuse le virement quand il n’est pas configuré', async () => {
		const r = await executer(() =>
			actions.commander(evenement(db, { form: formulaire({ mode: 'virement' }) }))
		);
		expect(r).toMatchObject({
			resultat: {
				status: 400,
				data: { mode: 'virement', message: expect.stringContaining('virement') }
			}
		});
		expect(await db.$count(commandes)).toBe(0);
	});

	it('exige l’acceptation des CGV et renvoie la saisie', async () => {
		const r = await executer(() =>
			actions.commander(evenement(db, { form: formulaire({ cgv: '' }) }))
		);
		expect(r).toMatchObject({
			resultat: {
				status: 400,
				data: {
					message: expect.stringContaining('conditions générales'),
					nom: 'Camille Martin',
					creneau
				}
			}
		});
		expect(await db.$count(commandes)).toBe(0);
	});

	it('exige un créneau', async () => {
		const r = await executer(() =>
			actions.commander(evenement(db, { form: formulaire({ creneau: '' }) }))
		);
		expect(r).toMatchObject({
			resultat: { status: 400, data: { message: expect.stringContaining('créneau') } }
		});
	});

	it('explique ce qu’il reste quand le stock manque', async () => {
		const r = await executer(() =>
			actions.commander(evenement(db, { form: formulaire({ [`o${radis}`]: '3' }) }))
		);
		expect(r).toMatchObject({
			resultat: {
				status: 400,
				data: { message: expect.stringContaining('Radis : il n’en reste que 1 botte.') }
			}
		});
		expect(await db.$count(commandes)).toBe(0);
	});

	it('transmet les erreurs de saisie', async () => {
		const r = await executer(() =>
			actions.commander(evenement(db, { form: formulaire({ email: 'pas-un-email' }) }))
		);
		expect(r).toMatchObject({
			resultat: { status: 400, data: { message: "L'adresse e-mail est invalide." } }
		});
	});

	it('explique à un client bloqué pourquoi il ne peut pas commander', async () => {
		for (let i = 0; i < 2; i++) {
			await executer(() => actions.commander(evenement(db, { form: formulaire() })));
		}
		await db.update(commandes).set({ statut: 'non_recuperee' });
		const r = await executer(() => actions.commander(evenement(db, { form: formulaire() })));
		expect(r).toMatchObject({
			resultat: {
				status: 400,
				data: { message: expect.stringContaining('n’ont pas été récupérées') }
			}
		});
	});

	it('refuse quand la vente est terminée', async () => {
		await changerStatutVente(db, venteId, 'archivee');
		const r = await executer(() => actions.commander(evenement(db, { form: formulaire() })));
		expect(r).toMatchObject({
			resultat: { status: 400, data: { message: expect.stringContaining('terminée') } }
		});
	});
});
