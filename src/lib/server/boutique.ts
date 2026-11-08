import { and, asc, eq, gt, lte } from 'drizzle-orm';
import type { Db } from './db/index.ts';
import { commandes, creneaux, lignesCommande, offres, produits, ventes } from './db/schema.ts';

// Lectures côté client : vente en cours, catalogue, récapitulatif de commande.

/**
 * La vente qui prend des commandes maintenant (publiée, entre ouverture et
 * clôture ; s'il y en a plusieurs, celle qui ferme le plus tôt), avec ses
 * produits actifs et ses créneaux. Sinon `null`.
 */
export async function venteEnCours(db: Db, maintenant: Date = new Date()) {
	const [vente] = await db
		.select()
		.from(ventes)
		.where(
			and(
				eq(ventes.statut, 'publiee'),
				lte(ventes.ouverture, maintenant),
				gt(ventes.cloture, maintenant)
			)
		)
		.orderBy(asc(ventes.cloture))
		.limit(1);
	if (!vente) return null;

	const [lesOffres, lesCreneaux] = await Promise.all([
		db
			.select({
				id: offres.id,
				produit: produits.nom,
				unite: produits.unite,
				pas: produits.pas,
				photo: produits.photo,
				prixCentimes: offres.prixCentimes,
				qteInitiale: offres.qteInitiale,
				qteReservee: offres.qteReservee
			})
			.from(offres)
			.innerJoin(produits, eq(produits.id, offres.produitId))
			.where(and(eq(offres.venteId, vente.id), eq(produits.actif, true)))
			.orderBy(asc(produits.nom)),
		db
			.select()
			.from(creneaux)
			.where(eq(creneaux.venteId, vente.id))
			.orderBy(asc(creneaux.date), asc(creneaux.heureDebut))
	]);

	return {
		id: vente.id,
		cloture: vente.cloture,
		offres: lesOffres
			.filter((o) => o.qteInitiale > 0)
			.map(({ qteInitiale, qteReservee, ...o }) => ({
				...o,
				// On ne propose que des multiples entiers du pas.
				restant: Math.floor((qteInitiale - qteReservee) / o.pas) * o.pas
			})),
		creneaux: lesCreneaux.map(({ nbCommandes, capacite, ...c }) => ({
			...c,
			complet: capacite !== null && nbCommandes >= capacite
		}))
	};
}

export type VenteEnCours = NonNullable<Awaited<ReturnType<typeof venteEnCours>>>;

/** Prochaine vente publiée qui n'a pas encore ouvert, pour l'annoncer. */
export async function prochaineVente(db: Db, maintenant: Date = new Date()) {
	const [vente] = await db
		.select({ ouverture: ventes.ouverture, cloture: ventes.cloture })
		.from(ventes)
		.where(and(eq(ventes.statut, 'publiee'), gt(ventes.ouverture, maintenant)))
		.orderBy(asc(ventes.ouverture))
		.limit(1);
	return vente ?? null;
}

/** Récapitulatif d'une commande, pour la page de confirmation. */
export async function lireCommande(db: Db, id: string) {
	const [commande] = await db
		.select({
			id: commandes.id,
			reference: commandes.reference,
			nom: commandes.nom,
			email: commandes.email,
			telephone: commandes.telephone,
			modePaiement: commandes.modePaiement,
			statut: commandes.statut,
			totalCentimes: commandes.totalCentimes,
			venteId: commandes.venteId,
			creneau: {
				date: creneaux.date,
				heureDebut: creneaux.heureDebut,
				heureFin: creneaux.heureFin,
				lieu: creneaux.lieu
			}
		})
		.from(commandes)
		.innerJoin(creneaux, eq(creneaux.id, commandes.creneauId))
		.where(eq(commandes.id, id));
	if (!commande) return null;
	const lignes = await db
		.select({
			produit: produits.nom,
			unite: produits.unite,
			quantite: lignesCommande.quantite,
			prixUnitaireCentimes: lignesCommande.prixUnitaireCentimes
		})
		.from(lignesCommande)
		.innerJoin(offres, eq(offres.id, lignesCommande.offreId))
		.innerJoin(produits, eq(produits.id, offres.produitId))
		.where(eq(lignesCommande.commandeId, id))
		.orderBy(asc(produits.nom));
	return { ...commande, lignes };
}
