import { and, eq, gte, inArray, isNull, lte } from 'drizzle-orm';
import {
	RAPPEL_DELAI_MINIMUM_APRES_COMMANDE_HEURES,
	RAPPEL_HEURES_AVANT_RETRAIT
} from '#lib/config.ts';
import { ajouterJours, versChampParis } from '#lib/heure.ts';
import { lireCommande } from './boutique.ts';
import { debutRetrait } from './commandes.ts';
import type { Courrielleur } from './courriels/envoi.ts';
import { courrielRappel } from './courriels/modeles.ts';
import type { Db } from './db/index.ts';
import { commandes, creneaux } from './db/schema.ts';

const HEURE = 3600_000;
/** Commandes qui attendent encore leur retrait (et ont un rappel à recevoir). */
const A_RAPPELER = ['confirmee', 'prete'] as const;

/**
 * Envoie l'e-mail de rappel aux clients dont le retrait commence dans moins de
 * `RAPPEL_HEURES_AVANT_RETRAIT` heures. Une seule fois par commande : la
 * commande est d'abord « réservée » (rappel_envoye_le), puis libérée si l'envoi
 * échoue, pour être retentée au passage suivant. Pas de rappel pour une
 * commande passée il y a quelques heures (la confirmation suffit).
 * Renvoie les références rappelées.
 */
export async function envoyerRappels(
	db: Db,
	courrielleur: Courrielleur,
	options: { maintenant: Date; urlBase: string }
): Promise<string[]> {
	const { maintenant } = options;
	const aujourdhui = versChampParis(maintenant).slice(0, 10);
	const candidates = await db
		.select({
			id: commandes.id,
			creeLe: commandes.creeLe,
			date: creneaux.date,
			heureDebut: creneaux.heureDebut
		})
		.from(commandes)
		.innerJoin(creneaux, eq(creneaux.id, commandes.creneauId))
		.where(
			and(
				inArray(commandes.statut, A_RAPPELER),
				isNull(commandes.rappelEnvoyeLe),
				gte(creneaux.date, aujourdhui),
				lte(creneaux.date, ajouterJours(aujourdhui, 2))
			)
		);

	const rappelees: string[] = [];
	for (const c of candidates) {
		const debut = debutRetrait(c).getTime();
		const dansLaFenetre =
			maintenant.getTime() >= debut - RAPPEL_HEURES_AVANT_RETRAIT * HEURE &&
			maintenant.getTime() < debut;
		const commandeRecente =
			maintenant.getTime() - c.creeLe.getTime() <
			RAPPEL_DELAI_MINIMUM_APRES_COMMANDE_HEURES * HEURE;
		if (!dansLaFenetre || commandeRecente) continue;

		// Réserver l'envoi : un seul passage peut gagner cette mise à jour.
		const reservee = await db
			.update(commandes)
			.set({ rappelEnvoyeLe: maintenant })
			.where(
				and(
					eq(commandes.id, c.id),
					isNull(commandes.rappelEnvoyeLe),
					inArray(commandes.statut, A_RAPPELER)
				)
			)
			.returning({ id: commandes.id });
		if (reservee.length === 0) continue;

		const commande = await lireCommande(db, c.id);
		const envoye =
			commande !== null && (await courrielleur.envoyer(courrielRappel(commande, options)));
		if (envoye) {
			rappelees.push(commande.reference);
		} else {
			await db.update(commandes).set({ rappelEnvoyeLe: null }).where(eq(commandes.id, c.id));
		}
	}
	return rappelees;
}
