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
import { annulerCommande, passerCommande } from './commandes.ts';
import type { Db } from './db/index.ts';
import { commandes } from './db/schema.ts';
import { envoyerRappels } from './rappels.ts';
import { baseDeTest } from './test/d1.ts';
import { courrielsDeTest } from './test/evenement.ts';

// Retrait le samedi 14 novembre à 9 h (Paris) = 8 h UTC ; rappel à partir du vendredi 8 h UTC.
const COMMANDE_LE = new Date('2026-11-10T10:00:00Z');
const AVANT_FENETRE = new Date('2026-11-13T07:59:00Z');
const DANS_FENETRE = new Date('2026-11-13T09:00:00Z');
const APRES_DEBUT = new Date('2026-11-14T08:00:00Z');
const URL = 'https://ferme.example';

let db: Db;
let fermer: () => Promise<void>;
let commander: (
	modePaiement?: 'retrait' | 'virement'
) => Promise<{ id: string; reference: string }>;

beforeEach(async () => {
	({ db, fermer } = await baseDeTest());
	const p = await creerProduit(db, { nom: 'Concombre', unite: 'piece', pas: 1 });
	const v = await creerVente(db, new Date('2026-11-09T08:00Z'), new Date('2026-11-12T19:00Z'));
	if (!p.ok || !v.ok) throw new Error();
	await ajouterOffre(db, v.id, p.id, 80, 50);
	await ajouterCreneau(db, v.id, {
		date: '2026-11-14',
		heureDebut: '09:00',
		heureFin: '12:00',
		lieu: 'Ferme',
		capacite: null
	});
	await changerStatutVente(db, v.id, 'publiee');
	const vente = (await lireVente(db, v.id))!;
	commander = async (modePaiement = 'retrait') => {
		const r = await passerCommande(
			db,
			{
				venteId: v.id,
				creneauId: vente.creneaux[0].id,
				nom: 'Camille Martin',
				email: 'camille@example.fr',
				telephone: '0612345678',
				modePaiement,
				lignes: [{ offreId: vente.offres[0].id, quantite: 2 }]
			},
			COMMANDE_LE
		);
		if (!r.ok) throw new Error(JSON.stringify(r));
		return r;
	};
});

afterEach(async () => {
	await fermer();
});

const passe = (maintenant: Date, courriels = courrielsDeTest()) =>
	envoyerRappels(db, courriels.courriels, { maintenant, urlBase: URL });

describe('envoyerRappels', () => {
	it('envoie le rappel la veille, une seule fois', async () => {
		const c = await commander();
		const t = courrielsDeTest();
		expect(await passe(AVANT_FENETRE, t)).toEqual([]);
		expect(await passe(DANS_FENETRE, t)).toEqual([c.reference]);
		expect(t.envoyes).toHaveLength(1);
		expect(t.envoyes[0]).toMatchObject({
			a: 'camille@example.fr',
			cleIdempotence: `rappel-${c.id}`
		});
		expect(t.envoyes[0].texte).toContain(`${URL}/annuler/`);
		// Les passages suivants (toutes les 15 min) ne renvoient rien.
		expect(await passe(new Date('2026-11-13T09:15:00Z'), t)).toEqual([]);
		expect(t.envoyes).toHaveLength(1);
		const [enBase] = await db.select().from(commandes);
		expect(enBase.rappelEnvoyeLe?.toISOString()).toBe(DANS_FENETRE.toISOString());
	});

	it('ignore les commandes annulées, récupérées ou en attente de virement', async () => {
		const annulee = await commander();
		await annulerCommande(db, annulee.id);
		const recuperee = await commander();
		await db.update(commandes).set({ statut: 'recuperee' }).where(eq(commandes.id, recuperee.id));
		await commander('virement');
		const prete = await commander();
		await db.update(commandes).set({ statut: 'prete' }).where(eq(commandes.id, prete.id));

		expect(await passe(DANS_FENETRE)).toEqual([prete.reference]);
	});

	it('n’envoie pas de rappel pour une commande toute récente, ni après le début du retrait', async () => {
		const c = await commander();
		await db
			.update(commandes)
			.set({ creeLe: new Date('2026-11-13T05:00:00Z') })
			.where(eq(commandes.id, c.id));
		expect(await passe(DANS_FENETRE)).toEqual([]); // commandée il y a 4 h
		expect(await passe(new Date('2026-11-13T11:00:00Z'))).toEqual([c.reference]); // 6 h après

		const tardive = await commander();
		expect(await passe(APRES_DEBUT)).toEqual([]);
		const [enBase] = await db.select().from(commandes).where(eq(commandes.id, tardive.id));
		expect(enBase.rappelEnvoyeLe).toBeNull();
	});

	it('retente au passage suivant si l’envoi échoue', async () => {
		const c = await commander();
		expect(await passe(DANS_FENETRE, courrielsDeTest(false))).toEqual([]);
		const [apresEchec] = await db.select().from(commandes);
		expect(apresEchec.rappelEnvoyeLe).toBeNull();
		expect(await passe(new Date('2026-11-13T09:15:00Z'))).toEqual([c.reference]);
	});
});
