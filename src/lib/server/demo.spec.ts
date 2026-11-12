import { eq, sql } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { creerVente } from './admin.ts';
import { venteEnCours } from './boutique.ts';
import { commandes, creneaux, lignesCommande, offres, produits, ventes } from './db/schema.ts';
import { PRODUITS_DEMO, remplirDemo } from './demo.ts';
import { baseDeTest } from './test/d1.ts';

let base: Awaited<ReturnType<typeof baseDeTest>>;
beforeEach(async () => {
	base = await baseDeTest();
});
afterEach(() => base.fermer());

/** Le stock réservé et les places prises correspondent aux commandes non annulées. */
async function verifierCoherence() {
	const { db } = base;
	const ecartsStock = await db.all(sql`
		select o.id from ${offres} o
		where o.qte_reservee != coalesce((
			select sum(l.quantite) from ${lignesCommande} l
			join ${commandes} c on c.id = l.commande_id
			where l.offre_id = o.id and c.statut != 'annulee'
		), 0)`);
	const ecartsPlaces = await db.all(sql`
		select cr.id from ${creneaux} cr
		where cr.nb_commandes != (
			select count(*) from ${commandes} c
			where c.creneau_id = cr.id and c.statut != 'annulee'
		)`);
	expect(ecartsStock).toEqual([]);
	expect(ecartsPlaces).toEqual([]);
}

describe('remplirDemo', () => {
	it('remplit une base vide : catalogue ouvert, commandes dans tous les états, semaine passée', async () => {
		const { db } = base;
		const maintenant = new Date('2026-11-12T10:00:00Z'); // jeudi
		const bilan = await remplirDemo(db, maintenant);
		expect(bilan).toEqual({
			produitsCrees: PRODUITS_DEMO.length,
			venteCreee: true,
			ventePasseeCreee: true
		});

		const vente = await venteEnCours(db, maintenant);
		expect(vente?.offres).toHaveLength(PRODUITS_DEMO.length);
		// Retrait le samedi, au moins deux jours plus tard, et le mardi suivant.
		expect(vente?.creneaux.map((c) => c.date)).toEqual(['2026-11-14', '2026-11-14', '2026-11-17']);
		expect(vente?.creneaux[1].places).toBe(1);

		const statuts = await db
			.select({ statut: commandes.statut, payee: commandes.payee, vente: ventes.statut })
			.from(commandes)
			.innerJoin(ventes, eq(ventes.id, commandes.venteId));
		expect(statuts.map((s) => `${s.vente} ${s.statut}${s.payee ? ' payée' : ''}`).sort()).toEqual([
			'archivee non_recuperee',
			'archivee recuperee payée',
			'archivee recuperee payée',
			'publiee annulee',
			'publiee confirmee',
			'publiee confirmee payée',
			'publiee en_attente_paiement',
			'publiee prete'
		]);
		await verifierCoherence();
	});

	it('ne rajoute rien quand une vente est déjà ouverte', async () => {
		const { db } = base;
		const maintenant = new Date('2026-11-12T10:00:00Z');
		await remplirDemo(db, maintenant);
		expect(await remplirDemo(db, maintenant)).toEqual({
			produitsCrees: 0,
			venteCreee: false,
			ventePasseeCreee: false
		});
		expect(await db.$count(ventes)).toBe(2);
		expect(await db.$count(produits)).toBe(PRODUITS_DEMO.length);
	});

	it('relance une vente quand la précédente est close, sans recréer de semaine passée', async () => {
		const { db } = base;
		await creerVente(db, new Date('2026-10-01T08:00:00Z'), new Date('2026-10-02T18:00:00Z'));
		const bilan = await remplirDemo(db, new Date('2026-11-12T10:00:00Z'));
		expect(bilan.venteCreee).toBe(true);
		expect(bilan.ventePasseeCreee).toBe(false);
		expect(await db.$count(ventes)).toBe(2);
		await verifierCoherence();
	});

	it('fonctionne aux jours et heures limites', async () => {
		// Cas limites : jeudi soir (retrait le surlendemain, délai de virement le plus court),
		// vendredi juste après minuit (retrait dans 8 jours, semaine passée à J−6),
		// samedi soir, et la nuit du passage à l'heure d'été.
		const instants = [
			new Date('2026-11-12T22:30:00Z'),
			new Date('2026-11-12T23:30:00Z'),
			new Date('2026-11-14T22:30:00Z'),
			new Date('2026-03-28T22:30:00Z')
		];
		for (const maintenant of instants) {
			await base.fermer();
			base = await baseDeTest();
			const bilan = await remplirDemo(base.db, maintenant);
			expect(bilan.venteCreee, maintenant.toISOString()).toBe(true);
			expect(await venteEnCours(base.db, maintenant)).not.toBeNull();
		}
	}, 60_000);
});
