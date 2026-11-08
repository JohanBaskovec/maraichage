import { and, asc, count, desc, eq, inArray, sql } from 'drizzle-orm';
import type { Db } from './db/index.ts';
import {
	commandes,
	creneaux,
	lignesCommande,
	offres,
	produits,
	STATUTS_ACTIFS,
	ventes,
	type StatutVente,
	type Unite
} from './db/schema.ts';
import { ajouterJours } from '#lib/heure.ts';

// Opérations du back-office. Chaque fonction qui peut être refusée renvoie
// un `Resultat` avec un message prêt à afficher au maraîcher.

export type Resultat<T = object> = ({ ok: true } & T) | { ok: false; message: string };

const refus = (message: string) => ({ ok: false as const, message });

function texteErreur(e: unknown): string {
	const morceaux: string[] = [];
	let courant: unknown = e;
	for (let i = 0; courant && i < 5; i++) {
		morceaux.push(courant instanceof Error ? courant.message : String(courant));
		courant = courant instanceof Error ? courant.cause : undefined;
	}
	return morceaux.join(' | ');
}

/** Exécute une écriture et traduit les violations de contraintes connues en messages. */
async function ecrire<T>(
	action: () => Promise<T>,
	messages: Record<string, string>
): Promise<{ ok: true; valeur: T } | { ok: false; message: string; contrainte: string }> {
	try {
		return { ok: true, valeur: await action() };
	} catch (e) {
		const texte = texteErreur(e);
		for (const [contrainte, message] of Object.entries(messages)) {
			if (texte.includes(contrainte)) return { ok: false, message, contrainte };
		}
		throw e;
	}
}

// ---------------------------------------------------------------- Produits

export function listerProduits(db: Db) {
	return db.select().from(produits).orderBy(desc(produits.actif), asc(produits.nom));
}

export interface ProduitSaisi {
	nom: string;
	unite: Unite;
	pas: number;
}

function verifierProduit(p: ProduitSaisi): string | null {
	if (!p.nom.trim()) return 'Le nom est obligatoire.';
	if (!['piece', 'botte', 'kg'].includes(p.unite)) return 'Unité inconnue.';
	if (!Number.isSafeInteger(p.pas) || p.pas <= 0) return 'Le pas doit être un nombre positif.';
	return null;
}

export async function creerProduit(db: Db, p: ProduitSaisi): Promise<Resultat<{ id: number }>> {
	const erreur = verifierProduit(p);
	if (erreur) return refus(erreur);
	const [cree] = await db
		.insert(produits)
		.values({ nom: p.nom.trim(), unite: p.unite, pas: p.pas })
		.returning({ id: produits.id });
	return { ok: true, id: cree.id };
}

export async function modifierProduit(db: Db, id: number, p: ProduitSaisi): Promise<Resultat> {
	const erreur = verifierProduit(p);
	if (erreur) return refus(erreur);
	const [actuel] = await db.select().from(produits).where(eq(produits.id, id));
	if (!actuel) return refus('Produit introuvable.');
	if (actuel.unite !== p.unite && (await db.$count(offres, eq(offres.produitId, id))) > 0) {
		// Les quantités déjà saisies (pièces ou grammes) n'auraient plus de sens.
		return refus(
			'Ce produit a déjà été mis en vente : son unité ne peut plus changer. Crée plutôt un nouveau produit.'
		);
	}
	await db
		.update(produits)
		.set({ nom: p.nom.trim(), unite: p.unite, pas: p.pas })
		.where(eq(produits.id, id));
	return { ok: true };
}

export async function definirProduitActif(db: Db, id: number, actif: boolean) {
	await db.update(produits).set({ actif }).where(eq(produits.id, id));
}

// ---------------------------------------------------------------- Ventes

export async function listerVentes(db: Db) {
	const nbOffres = db
		.select({ venteId: offres.venteId, n: count().as('n_offres') })
		.from(offres)
		.groupBy(offres.venteId)
		.as('o');
	const nbCommandes = db
		.select({ venteId: commandes.venteId, n: count().as('n_commandes') })
		.from(commandes)
		.where(inArray(commandes.statut, [...STATUTS_ACTIFS, 'recuperee']))
		.groupBy(commandes.venteId)
		.as('c');
	return db
		.select({
			id: ventes.id,
			ouverture: ventes.ouverture,
			cloture: ventes.cloture,
			statut: ventes.statut,
			nbOffres: sql<number>`coalesce(${nbOffres.n}, 0)`,
			nbCommandes: sql<number>`coalesce(${nbCommandes.n}, 0)`
		})
		.from(ventes)
		.leftJoin(nbOffres, eq(nbOffres.venteId, ventes.id))
		.leftJoin(nbCommandes, eq(nbCommandes.venteId, ventes.id))
		.orderBy(desc(ventes.ouverture), desc(ventes.id));
}

export async function lireVente(db: Db, id: number) {
	const [vente] = await db.select().from(ventes).where(eq(ventes.id, id));
	if (!vente) return null;
	const [lesOffres, lesCreneaux] = await Promise.all([
		db
			.select({
				id: offres.id,
				produitId: produits.id,
				produit: produits.nom,
				unite: produits.unite,
				pas: produits.pas,
				actif: produits.actif,
				prixCentimes: offres.prixCentimes,
				qteInitiale: offres.qteInitiale,
				qteReservee: offres.qteReservee
			})
			.from(offres)
			.innerJoin(produits, eq(produits.id, offres.produitId))
			.where(eq(offres.venteId, id))
			.orderBy(asc(produits.nom)),
		db
			.select()
			.from(creneaux)
			.where(eq(creneaux.venteId, id))
			.orderBy(asc(creneaux.date), asc(creneaux.heureDebut))
	]);
	return { ...vente, offres: lesOffres, creneaux: lesCreneaux };
}

const MESSAGES_DATES = {
	ventes_dates_coherentes: 'La clôture doit être après l’ouverture.'
};

export async function creerVente(
	db: Db,
	ouverture: Date,
	cloture: Date
): Promise<Resultat<{ id: number }>> {
	const r = await ecrire(
		() => db.insert(ventes).values({ ouverture, cloture }).returning({ id: ventes.id }),
		MESSAGES_DATES
	);
	return r.ok ? { ok: true, id: r.valeur[0].id } : refus(r.message);
}

/**
 * Nouvelle vente en brouillon, copiée d'une vente existante et décalée de
 * `decalageJours` : mêmes produits (encore actifs), prix et quantités, mêmes
 * créneaux. Rien n'est réservé dans la copie.
 */
export async function dupliquerVente(
	db: Db,
	sourceId: number,
	decalageJours = 7
): Promise<Resultat<{ id: number }>> {
	const source = await lireVente(db, sourceId);
	if (!source) return refus('Vente introuvable.');
	const decalageMs = decalageJours * 24 * 3600 * 1000;
	const [nouvelle] = await db
		.insert(ventes)
		.values({
			ouverture: new Date(source.ouverture.getTime() + decalageMs),
			cloture: new Date(source.cloture.getTime() + decalageMs)
		})
		.returning({ id: ventes.id });
	const lesOffres = source.offres.filter((o) => o.actif);
	try {
		const ecritures = [
			...lesOffres.map((o) =>
				db.insert(offres).values({
					venteId: nouvelle.id,
					produitId: o.produitId,
					prixCentimes: o.prixCentimes,
					qteInitiale: o.qteInitiale
				})
			),
			...source.creneaux.map((c) =>
				db.insert(creneaux).values({
					venteId: nouvelle.id,
					date: ajouterJours(c.date, decalageJours),
					heureDebut: c.heureDebut,
					heureFin: c.heureFin,
					lieu: c.lieu,
					capacite: c.capacite
				})
			)
		];
		const [premiere, ...autres] = ecritures;
		if (premiere) await db.batch([premiere, ...autres]);
	} catch (e) {
		await db.delete(ventes).where(eq(ventes.id, nouvelle.id));
		throw e;
	}
	return { ok: true, id: nouvelle.id };
}

export async function modifierDatesVente(
	db: Db,
	id: number,
	ouverture: Date,
	cloture: Date
): Promise<Resultat> {
	const r = await ecrire(
		() => db.update(ventes).set({ ouverture, cloture }).where(eq(ventes.id, id)),
		MESSAGES_DATES
	);
	return r.ok ? { ok: true } : refus(r.message);
}

export async function changerStatutVente(
	db: Db,
	id: number,
	statut: StatutVente
): Promise<Resultat> {
	if (statut === 'publiee') {
		const [nbOffres, nbCreneaux] = await Promise.all([
			db.$count(offres, eq(offres.venteId, id)),
			db.$count(creneaux, eq(creneaux.venteId, id))
		]);
		if (nbOffres === 0) return refus('Ajoute au moins un produit avant de publier.');
		if (nbCreneaux === 0) return refus('Ajoute au moins un créneau de retrait avant de publier.');
	}
	await db.update(ventes).set({ statut }).where(eq(ventes.id, id));
	return { ok: true };
}

/** Supprime une vente qui n'a jamais reçu de commande. */
export async function supprimerVente(db: Db, id: number): Promise<Resultat> {
	if ((await db.$count(commandes, eq(commandes.venteId, id))) > 0) {
		return refus('Cette vente a reçu des commandes : archive-la plutôt.');
	}
	await db.delete(ventes).where(eq(ventes.id, id));
	return { ok: true };
}

// ---------------------------------------------------------------- Offres

function verifierOffre(prixCentimes: number, qteInitiale: number): string | null {
	if (!Number.isSafeInteger(prixCentimes) || prixCentimes < 0) return 'Prix invalide.';
	if (!Number.isSafeInteger(qteInitiale) || qteInitiale < 0) return 'Quantité invalide.';
	return null;
}

export async function ajouterOffre(
	db: Db,
	venteId: number,
	produitId: number,
	prixCentimes: number,
	qteInitiale: number
): Promise<Resultat> {
	const erreur = verifierOffre(prixCentimes, qteInitiale);
	if (erreur) return refus(erreur);
	const r = await ecrire(
		() => db.insert(offres).values({ venteId, produitId, prixCentimes, qteInitiale }),
		{ 'offres.vente_id, offres.produit_id': 'Ce produit est déjà dans la vente.' }
	);
	return r.ok ? { ok: true } : refus(r.message);
}

export interface CommandeConcernee {
	reference: string;
	nom: string;
	quantite: number;
}

export type ResultatModifOffre =
	| { ok: true }
	| { ok: false; message: string }
	| {
			ok: false;
			message: string;
			sousReserve: { reservee: number; commandes: CommandeConcernee[] };
	  };

/**
 * Change le prix et le stock d'une offre. Le stock ne peut pas descendre sous ce
 * qui est déjà réservé (contrainte `offres_stock_suffisant`) : dans ce cas on
 * renvoie les commandes concernées, à réduire ou annuler d'abord.
 * Le nouveau prix ne touche pas les commandes déjà passées (prix recopié).
 */
export async function modifierOffre(
	db: Db,
	offreId: number,
	prixCentimes: number,
	qteInitiale: number
): Promise<ResultatModifOffre> {
	const erreur = verifierOffre(prixCentimes, qteInitiale);
	if (erreur) return refus(erreur);
	const r = await ecrire(
		() => db.update(offres).set({ prixCentimes, qteInitiale }).where(eq(offres.id, offreId)),
		{ offres_stock_suffisant: 'Ce stock est inférieur à ce qui est déjà commandé.' }
	);
	if (r.ok) return { ok: true };
	const [offre] = await db.select().from(offres).where(eq(offres.id, offreId));
	const concernees = await db
		.select({
			reference: commandes.reference,
			nom: commandes.nom,
			quantite: lignesCommande.quantite
		})
		.from(lignesCommande)
		.innerJoin(commandes, eq(commandes.id, lignesCommande.commandeId))
		.where(and(eq(lignesCommande.offreId, offreId), inArray(commandes.statut, STATUTS_ACTIFS)))
		.orderBy(desc(commandes.creeLe));
	return {
		ok: false,
		message: r.message,
		sousReserve: { reservee: offre?.qteReservee ?? 0, commandes: concernees }
	};
}

export async function retirerOffre(db: Db, offreId: number): Promise<Resultat> {
	if ((await db.$count(lignesCommande, eq(lignesCommande.offreId, offreId))) > 0) {
		return refus('Ce produit a déjà été commandé : mets son stock à 0 plutôt que de le retirer.');
	}
	await db.delete(offres).where(eq(offres.id, offreId));
	return { ok: true };
}

// ---------------------------------------------------------------- Créneaux

export interface CreneauSaisi {
	date: string;
	heureDebut: string;
	heureFin: string;
	lieu: string;
	capacite: number | null;
}

export async function ajouterCreneau(db: Db, venteId: number, c: CreneauSaisi): Promise<Resultat> {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(c.date)) return refus('Date invalide.');
	if (!/^\d{2}:\d{2}$/.test(c.heureDebut) || !/^\d{2}:\d{2}$/.test(c.heureFin)) {
		return refus('Heures invalides.');
	}
	if (c.heureDebut >= c.heureFin) return refus('L’heure de fin doit être après l’heure de début.');
	if (!c.lieu.trim()) return refus('Le lieu est obligatoire.');
	if (c.capacite !== null && (!Number.isSafeInteger(c.capacite) || c.capacite <= 0)) {
		return refus('La capacité doit être un nombre positif, ou vide pour sans limite.');
	}
	await db.insert(creneaux).values({ venteId, ...c, lieu: c.lieu.trim() });
	return { ok: true };
}

export async function retirerCreneau(db: Db, creneauId: number): Promise<Resultat> {
	if ((await db.$count(commandes, eq(commandes.creneauId, creneauId))) > 0) {
		return refus('Ce créneau a déjà des commandes : il ne peut plus être retiré.');
	}
	await db.delete(creneaux).where(eq(creneaux.id, creneauId));
	return { ok: true };
}
