import { and, count, eq, inArray, lte, or, sql } from 'drizzle-orm';
import {
	ABSENCES_AVANT_BLOCAGE,
	ANNULATION_HEURES_AVANT_RETRAIT,
	DELAI_VIREMENT_HEURES,
	MAX_PAS_PAR_PRODUIT,
	VIREMENT_DELAI_MINIMUM_HEURES,
	VIREMENT_HEURES_AVANT_RETRAIT
} from '#lib/config.ts';
import { depuisChampParis } from '#lib/heure.ts';
import { prixLigneCentimes } from '#lib/prix.ts';
import type { Db } from './db/index.ts';
import {
	commandes,
	creneaux,
	lignesCommande,
	offres,
	produits,
	STATUTS_ACTIFS,
	ventes,
	type ModePaiement,
	type StatutCommande
} from './db/schema.ts';
import { genererJetonAnnulation, genererReference } from './jetons.ts';

export interface LigneDemandee {
	offreId: number;
	/** En unité de base : pièces, bottes, ou grammes. */
	quantite: number;
}

export interface CommandeDemandee {
	venteId: number;
	creneauId: number;
	nom: string;
	email: string;
	telephone: string;
	modePaiement: ModePaiement;
	lignes: LigneDemandee[];
}

export interface Manque {
	offreId: number;
	produit: string;
	demande: number;
	restant: number;
}

export type ResultatCommande =
	| { ok: true; id: string; reference: string; totalCentimes: number; jetonAnnulation: string }
	| { ok: false; erreur: 'saisie_invalide'; message: string }
	| { ok: false; erreur: 'vente_fermee' }
	| { ok: false; erreur: 'creneau_complet' }
	| { ok: false; erreur: 'client_bloque' }
	| { ok: false; erreur: 'stock_insuffisant'; manques: Manque[] };

const TENTATIVES_REFERENCE = 5;

function invalide(message: string): ResultatCommande {
	return { ok: false, erreur: 'saisie_invalide', message };
}

/** Message d'une erreur et de ses causes (Drizzle enveloppe l'erreur D1). */
function texteErreur(e: unknown): string {
	const morceaux: string[] = [];
	let courant: unknown = e;
	for (let i = 0; courant && i < 5; i++) {
		morceaux.push(courant instanceof Error ? courant.message : String(courant));
		courant = courant instanceof Error ? courant.cause : undefined;
	}
	return morceaux.join(' | ');
}

const estEntierPositif = (n: unknown): n is number => Number.isSafeInteger(n) && (n as number) > 0;

/**
 * Enregistre une commande et réserve son stock, de façon atomique.
 *
 * Toutes les écritures partent dans un seul `db.batch()`, exécuté par D1 comme
 * une transaction. Chaque ligne incrémente `offres.qte_reservee` ; la contrainte
 * CHECK `offres_stock_suffisant` (qte_reservee <= qte_initiale) fait échouer
 * l'incrément s'il n'y a plus assez de stock, ce qui annule tout le lot : le
 * panier passe en entier ou pas du tout, même avec des commandes simultanées.
 * Même principe pour la capacité du créneau (`creneaux_capacite_respectee`).
 */
export async function passerCommande(
	db: Db,
	demande: CommandeDemandee,
	maintenant: Date = new Date()
): Promise<ResultatCommande> {
	// 1. Saisie
	const nom = demande.nom?.trim() ?? '';
	const email = demande.email?.trim().toLowerCase() ?? '';
	const telephone = demande.telephone?.replace(/[\s.-]/g, '') ?? '';
	if (!nom) return invalide('Le nom est obligatoire.');
	if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return invalide("L'adresse e-mail est invalide.");
	if (!/^\+?[0-9]{8,15}$/.test(telephone)) return invalide('Le numéro de téléphone est invalide.');
	if (demande.modePaiement !== 'retrait' && demande.modePaiement !== 'virement') {
		return invalide('Mode de paiement inconnu.');
	}
	if (!Array.isArray(demande.lignes) || demande.lignes.length === 0) {
		return invalide('Le panier est vide.');
	}
	const ids = demande.lignes.map((l) => l.offreId);
	if (!ids.every(estEntierPositif) || new Set(ids).size !== ids.length) {
		return invalide('Panier invalide.');
	}
	if (!demande.lignes.every((l) => estEntierPositif(l.quantite))) {
		return invalide('Quantité invalide.');
	}

	// 2. Client bloqué après des commandes non récupérées
	if (await estBloque(db, email, telephone)) return { ok: false, erreur: 'client_bloque' };

	// 3. Vente ouverte (vérifié ici, côté serveur, jamais seulement dans l'interface)
	const [vente] = await db.select().from(ventes).where(eq(ventes.id, demande.venteId));
	if (
		!vente ||
		vente.statut !== 'publiee' ||
		maintenant < vente.ouverture ||
		maintenant >= vente.cloture
	) {
		return { ok: false, erreur: 'vente_fermee' };
	}

	// 4. Créneau de cette vente
	const [creneau] = await db
		.select({ id: creneaux.id, date: creneaux.date, heureDebut: creneaux.heureDebut })
		.from(creneaux)
		.where(and(eq(creneaux.id, demande.creneauId), eq(creneaux.venteId, vente.id)));
	if (!creneau) return invalide('Créneau de retrait inconnu.');

	// 5. Offres de cette vente, avec prix et unité au moment de la commande
	const offresTrouvees = await db
		.select({
			id: offres.id,
			prixCentimes: offres.prixCentimes,
			unite: produits.unite,
			pas: produits.pas,
			nom: produits.nom,
			actif: produits.actif
		})
		.from(offres)
		.innerJoin(produits, eq(produits.id, offres.produitId))
		.where(and(eq(offres.venteId, vente.id), inArray(offres.id, ids)));
	const parId = new Map(offresTrouvees.map((o) => [o.id, o]));

	let totalCentimes = 0;
	const lignes = [];
	for (const l of demande.lignes) {
		const offre = parId.get(l.offreId);
		if (!offre || !offre.actif) return invalide("Un produit du panier n'est plus proposé.");
		if (l.quantite % offre.pas !== 0) return invalide(`Quantité invalide pour ${offre.nom}.`);
		if (l.quantite > offre.pas * MAX_PAS_PAR_PRODUIT) {
			return invalide(`${offre.nom} : quantité limitée par commande.`);
		}
		totalCentimes += prixLigneCentimes(offre.unite, offre.prixCentimes, l.quantite);
		lignes.push({ ...l, prixUnitaireCentimes: offre.prixCentimes });
	}

	// 6. Écriture atomique
	let statut: 'confirmee' | 'en_attente_paiement' = 'confirmee';
	let paiementAvant: Date | null = null;
	if (demande.modePaiement === 'virement') {
		statut = 'en_attente_paiement';
		paiementAvant = limitePaiementVirement(maintenant, creneau);
		if (paiementAvant.getTime() - maintenant.getTime() < VIREMENT_DELAI_MINIMUM_HEURES * 3600_000) {
			return invalide(
				'Le retrait est trop proche pour payer par virement : choisissez le paiement au retrait.'
			);
		}
	}
	for (let tentative = 1; ; tentative++) {
		const id = crypto.randomUUID();
		const reference = genererReference();
		const jetonAnnulation = genererJetonAnnulation();
		try {
			await db.batch([
				db.insert(commandes).values({
					id,
					reference,
					venteId: vente.id,
					creneauId: creneau.id,
					nom,
					email,
					telephone,
					modePaiement: demande.modePaiement,
					statut,
					totalCentimes,
					creeLe: maintenant,
					paiementAvant,
					jetonAnnulation
				}),
				db
					.update(creneaux)
					.set({ nbCommandes: sql`${creneaux.nbCommandes} + 1` })
					.where(eq(creneaux.id, creneau.id)),
				...lignes.flatMap((l) => [
					db
						.update(offres)
						.set({ qteReservee: sql`${offres.qteReservee} + ${l.quantite}` })
						.where(eq(offres.id, l.offreId)),
					db.insert(lignesCommande).values({
						commandeId: id,
						offreId: l.offreId,
						quantite: l.quantite,
						prixUnitaireCentimes: l.prixUnitaireCentimes
					})
				])
			]);
			return { ok: true, id, reference, totalCentimes, jetonAnnulation };
		} catch (e) {
			const texte = texteErreur(e);
			if (texte.includes('offres_stock_suffisant')) {
				return { ok: false, erreur: 'stock_insuffisant', manques: await manques(db, lignes) };
			}
			if (texte.includes('creneaux_capacite_respectee')) {
				return { ok: false, erreur: 'creneau_complet' };
			}
			if (texte.includes('commandes.reference') && tentative < TENTATIVES_REFERENCE) {
				continue; // référence déjà prise : on en tire une autre
			}
			throw e;
		}
	}
}

/** Lignes du panier qui dépassent le stock restant, pour « il ne reste que 3 concombres ». */
async function manques(db: Db, lignes: LigneDemandee[]): Promise<Manque[]> {
	const etat = await db
		.select({
			id: offres.id,
			produit: produits.nom,
			restant: sql<number>`${offres.qteInitiale} - ${offres.qteReservee}`
		})
		.from(offres)
		.innerJoin(produits, eq(produits.id, offres.produitId))
		.where(
			inArray(
				offres.id,
				lignes.map((l) => l.offreId)
			)
		);
	const parId = new Map(etat.map((o) => [o.id, o]));
	return lignes.flatMap((l) => {
		const o = parId.get(l.offreId);
		return o && o.restant < l.quantite
			? [{ offreId: l.offreId, produit: o.produit, demande: l.quantite, restant: o.restant }]
			: [];
	});
}

/**
 * Annule une commande encore active et rend son stock et sa place de créneau.
 * Atomique et idempotent : chaque écriture est conditionnée au statut actif de la
 * commande, et le changement de statut vient en dernier dans le même lot.
 * Renvoie `false` si la commande n'existe pas ou n'était plus active.
 */
export async function annulerCommande(
	db: Db,
	commandeId: string,
	statutsAnnulables: readonly StatutCommande[] = STATUTS_ACTIFS
): Promise<boolean> {
	const active = and(eq(commandes.id, commandeId), inArray(commandes.statut, statutsAnnulables));
	const encoreActive = sql`exists (select 1 from ${commandes} where ${active})`;

	const [, , changement] = await db.batch([
		db
			.update(offres)
			.set({
				qteReservee: sql`${offres.qteReservee} - (
					select ${lignesCommande.quantite} from ${lignesCommande}
					where ${lignesCommande.commandeId} = ${commandeId}
					and ${lignesCommande.offreId} = ${offres.id}
				)`
			})
			.where(
				and(
					inArray(
						offres.id,
						db
							.select({ id: lignesCommande.offreId })
							.from(lignesCommande)
							.where(eq(lignesCommande.commandeId, commandeId))
					),
					encoreActive
				)
			),
		db
			.update(creneaux)
			.set({ nbCommandes: sql`${creneaux.nbCommandes} - 1` })
			.where(
				and(
					eq(
						creneaux.id,
						sql`(select ${commandes.creneauId} from ${commandes} where ${commandes.id} = ${commandeId})`
					),
					encoreActive
				)
			),
		db.update(commandes).set({ statut: 'annulee' }).where(active).returning({ id: commandes.id })
	]);
	return changement.length === 1;
}

/**
 * Un client est bloqué quand son e-mail ou son téléphone totalise
 * `ABSENCES_AVANT_BLOCAGE` commandes non récupérées, hors absences excusées.
 */
export async function estBloque(db: Db, email: string, telephone: string): Promise<boolean> {
	const [{ n }] = await db
		.select({ n: count() })
		.from(commandes)
		.where(
			and(
				eq(commandes.statut, 'non_recuperee'),
				eq(commandes.absenceExcusee, false),
				or(eq(commandes.email, email), eq(commandes.telephone, telephone))
			)
		);
	return n >= ABSENCES_AVANT_BLOCAGE;
}

/** Début du créneau de retrait (heure de Paris) moins le délai d'annulation. */
export function limiteAnnulation(creneau: { date: string; heureDebut: string }): Date {
	return new Date(debutRetrait(creneau).getTime() - ANNULATION_HEURES_AVANT_RETRAIT * 3600_000);
}

export type ResultatAnnulationClient = 'annulee' | 'introuvable' | 'deja_terminee' | 'trop_tard';

/**
 * Annulation par le client, avec le jeton secret de son lien. Possible tant que
 * la commande est à retirer et que la limite (avant le retrait) n'est pas passée ;
 * le stock et la place de créneau sont rendus.
 */
export async function annulerParClient(
	db: Db,
	jeton: string,
	maintenant: Date = new Date()
): Promise<ResultatAnnulationClient> {
	const [c] = await db
		.select({
			id: commandes.id,
			statut: commandes.statut,
			date: creneaux.date,
			heureDebut: creneaux.heureDebut
		})
		.from(commandes)
		.innerJoin(creneaux, eq(creneaux.id, commandes.creneauId))
		.where(eq(commandes.jetonAnnulation, jeton));
	if (!c) return 'introuvable';
	if (!(STATUTS_ACTIFS as readonly string[]).includes(c.statut)) return 'deja_terminee';
	if (maintenant >= limiteAnnulation(c)) return 'trop_tard';
	return (await annulerCommande(db, c.id)) ? 'annulee' : 'deja_terminee';
}

/** Début du créneau de retrait, à l'heure de Paris. */
export function debutRetrait(creneau: { date: string; heureDebut: string }): Date {
	const debut = depuisChampParis(`${creneau.date}T${creneau.heureDebut}`);
	if (!debut) throw new Error(`Créneau illisible : ${creneau.date} ${creneau.heureDebut}`);
	return debut;
}

/**
 * Date limite pour payer un virement : `DELAI_VIREMENT_HEURES` après la commande,
 * ou `VIREMENT_HEURES_AVANT_RETRAIT` avant le début du retrait si c'est plus tôt.
 */
export function limitePaiementVirement(
	commandeLe: Date,
	creneau: { date: string; heureDebut: string }
): Date {
	return new Date(
		Math.min(
			commandeLe.getTime() + DELAI_VIREMENT_HEURES * 3600_000,
			debutRetrait(creneau).getTime() - VIREMENT_HEURES_AVANT_RETRAIT * 3600_000
		)
	);
}

/**
 * Annule les commandes par virement dont le paiement n'est pas arrivé à temps
 * et remet leur stock en vente. Lancé régulièrement par le Worker des tâches
 * planifiées. Une commande validée entre-temps (« paiement reçu ») n'est jamais
 * annulée : l'annulation ne vise que le statut `en_attente_paiement`.
 * Renvoie les références annulées.
 */
export async function expirerVirements(db: Db, maintenant: Date = new Date()): Promise<string[]> {
	const expirees = await db
		.select({ id: commandes.id, reference: commandes.reference })
		.from(commandes)
		.where(
			and(eq(commandes.statut, 'en_attente_paiement'), lte(commandes.paiementAvant, maintenant))
		);
	const annulees: string[] = [];
	for (const c of expirees) {
		if (await annulerCommande(db, c.id, ['en_attente_paiement'])) annulees.push(c.reference);
	}
	return annulees;
}
