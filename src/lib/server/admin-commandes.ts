import { and, asc, count, eq, inArray, ne, or, sql, sum, type SQL } from 'drizzle-orm';
import type { FiltreStatut } from '#lib/statuts.ts';
import { annulerCommande } from './commandes.ts';
import type { Db } from './db/index.ts';
import {
	commandes,
	creneaux,
	lignesCommande,
	offres,
	produits,
	STATUTS_ACTIFS,
	type StatutCommande
} from './db/schema.ts';

// Suivi des commandes dans le back-office : liste, paiement, retrait,
// annulation, récap de préparation. Chaque écriture vérifie que la commande
// appartient bien à la vente de la page, et que son statut permet le changement.

export { FILTRES_STATUT, type FiltreStatut } from '#lib/statuts.ts';

export interface FiltresCommandes {
	creneauId?: number | null;
	statut?: FiltreStatut;
	/** Nom, référence ou téléphone (sans tenir compte des majuscules, accents et espaces). */
	recherche?: string;
}

function conditionStatut(filtre: FiltreStatut): SQL {
	switch (filtre) {
		case 'a_retirer':
			return inArray(commandes.statut, STATUTS_ACTIFS);
		case 'recuperee':
			return eq(commandes.statut, 'recuperee');
		case 'non_recuperee':
			return eq(commandes.statut, 'non_recuperee');
		case 'annulee':
			return eq(commandes.statut, 'annulee');
		default:
			return ne(commandes.statut, 'annulee');
	}
}

function conditions(venteId: number, filtres: FiltresCommandes): SQL {
	const liste: SQL[] = [eq(commandes.venteId, venteId), conditionStatut(filtres.statut ?? 'tout')];
	if (filtres.creneauId) liste.push(eq(commandes.creneauId, filtres.creneauId));
	return and(...liste)!;
}

/** Minuscules sans accents : « Élodie » → « elodie ». */
const normaliser = (texte: string) =>
	texte
		.normalize('NFD')
		.replace(/\p{Diacritic}/gu, '')
		.toLowerCase();

const ordreFrancais = new Intl.Collator('fr', { sensitivity: 'base' });

/** Commandes d'une vente avec leur créneau et leurs lignes, par créneau puis par nom. */
export async function listerCommandes(db: Db, venteId: number, filtres: FiltresCommandes = {}) {
	const lesCommandes = await db
		.select({
			id: commandes.id,
			reference: commandes.reference,
			nom: commandes.nom,
			email: commandes.email,
			telephone: commandes.telephone,
			modePaiement: commandes.modePaiement,
			statut: commandes.statut,
			payee: commandes.payee,
			paiementAvant: commandes.paiementAvant,
			totalCentimes: commandes.totalCentimes,
			creeLe: commandes.creeLe,
			creneau: {
				id: creneaux.id,
				date: creneaux.date,
				heureDebut: creneaux.heureDebut,
				heureFin: creneaux.heureFin,
				lieu: creneaux.lieu
			}
		})
		.from(commandes)
		.innerJoin(creneaux, eq(creneaux.id, commandes.creneauId))
		.where(conditions(venteId, filtres))
		.orderBy(asc(creneaux.date), asc(creneaux.heureDebut), asc(commandes.creeLe));

	// Recherche et tri par nom en JavaScript : SQLite ignore les accents
	// majuscules (« É ») et trie octet par octet (« ève » après « Zoé »).
	const recherche = normaliser(filtres.recherche?.trim() ?? '');
	const chiffres = recherche.replace(/[\s.-]/g, '');
	const retenues = lesCommandes
		.filter(
			(c) =>
				!recherche ||
				normaliser(c.nom).includes(recherche) ||
				c.reference.toLowerCase().includes(recherche) ||
				(chiffres !== '' && c.telephone.includes(chiffres))
		)
		.sort(
			(a, b) =>
				a.creneau.date.localeCompare(b.creneau.date) ||
				a.creneau.heureDebut.localeCompare(b.creneau.heureDebut) ||
				ordreFrancais.compare(a.nom, b.nom)
		);
	if (retenues.length === 0) return [];

	// Toutes les lignes de la vente en une requête (D1 limite le nombre de
	// paramètres : pas de « commande_id IN (…) » sur une longue liste).
	const lignes = await db
		.select({
			commandeId: lignesCommande.commandeId,
			produit: produits.nom,
			unite: produits.unite,
			quantite: lignesCommande.quantite,
			prixUnitaireCentimes: lignesCommande.prixUnitaireCentimes
		})
		.from(lignesCommande)
		.innerJoin(commandes, eq(commandes.id, lignesCommande.commandeId))
		.innerJoin(offres, eq(offres.id, lignesCommande.offreId))
		.innerJoin(produits, eq(produits.id, offres.produitId))
		.where(eq(commandes.venteId, venteId))
		.orderBy(asc(produits.nom));
	const parCommande = Map.groupBy(lignes, (l) => l.commandeId);
	return retenues.map((c) => ({
		...c,
		lignes: (parCommande.get(c.id) ?? []).map((l) => ({
			produit: l.produit,
			unite: l.unite,
			quantite: l.quantite,
			prixUnitaireCentimes: l.prixUnitaireCentimes
		}))
	}));
}

export type CommandeListee = Awaited<ReturnType<typeof listerCommandes>>[number];

/**
 * Récap de préparation : quantités totales par produit (pour la cueillette),
 * puis une fiche par commande à retirer (pour faire les sacs).
 * Seules les commandes à retirer comptent (ni annulées, ni déjà récupérées).
 */
export async function recapPreparation(db: Db, venteId: number, creneauId?: number | null) {
	const filtre = conditions(venteId, { statut: 'a_retirer', creneauId });
	const totaux = await db
		.select({
			produit: produits.nom,
			unite: produits.unite,
			quantite: sql<number>`${sum(lignesCommande.quantite)}`.mapWith(Number),
			nbCommandes: count(lignesCommande.commandeId)
		})
		.from(lignesCommande)
		.innerJoin(commandes, eq(commandes.id, lignesCommande.commandeId))
		.innerJoin(offres, eq(offres.id, lignesCommande.offreId))
		.innerJoin(produits, eq(produits.id, offres.produitId))
		.where(filtre)
		.groupBy(produits.id)
		.orderBy(asc(produits.nom));
	const fiches = await listerCommandes(db, venteId, { statut: 'a_retirer', creneauId });
	return { totaux, fiches };
}

export type ResultatSuivi = { ok: true } | { ok: false; message: string };

const INTROUVABLE: ResultatSuivi = { ok: false, message: 'Commande introuvable.' };

/** Changements de statut possibles depuis le back-office, avec leur statut de départ. */
const TRANSITIONS = {
	prete: ['confirmee'],
	recuperee: ['confirmee', 'prete'],
	// Posé après le créneau ; compte pour le blocage du client.
	non_recuperee: ['confirmee', 'prete'],
	// Retour en arrière après un clic de trop.
	confirmee: ['prete', 'recuperee', 'non_recuperee']
} as const satisfies Partial<Record<StatutCommande, readonly StatutCommande[]>>;

export type StatutSuivi = keyof typeof TRANSITIONS;
export const STATUTS_SUIVI = Object.keys(TRANSITIONS) as StatutSuivi[];

/**
 * Passe une commande à « prête », « récupérée », ou la remet « à retirer ».
 * Mise à jour conditionnelle : elle n'a lieu que si le statut actuel le permet
 * (une commande annulée ne revient jamais, son stock a été rendu).
 */
export async function changerStatutCommande(
	db: Db,
	venteId: number,
	commandeId: string,
	statut: StatutSuivi
): Promise<ResultatSuivi> {
	const depart = TRANSITIONS[statut];
	if (!depart) return { ok: false, message: 'Statut inconnu.' };
	const modifiees = await db
		.update(commandes)
		.set({ statut })
		.where(
			and(
				eq(commandes.id, commandeId),
				eq(commandes.venteId, venteId),
				inArray(commandes.statut, depart)
			)
		)
		.returning({ id: commandes.id });
	if (modifiees.length === 1) return { ok: true };
	const [actuelle] = await db
		.select({ statut: commandes.statut })
		.from(commandes)
		.where(and(eq(commandes.id, commandeId), eq(commandes.venteId, venteId)));
	return actuelle
		? { ok: false, message: 'Ce changement n’est pas possible pour cette commande.' }
		: INTROUVABLE;
}

/**
 * Virement reçu (ou paiement autrement) pour une commande en attente de
 * paiement : elle devient « à retirer » et payée. Sans effet si la commande a
 * déjà été annulée, par exemple par l'expiration automatique.
 */
export async function confirmerPaiement(
	db: Db,
	venteId: number,
	commandeId: string
): Promise<ResultatSuivi> {
	const modifiees = await db
		.update(commandes)
		.set({ statut: 'confirmee', payee: true })
		.where(
			and(
				eq(commandes.id, commandeId),
				eq(commandes.venteId, venteId),
				eq(commandes.statut, 'en_attente_paiement')
			)
		)
		.returning({ id: commandes.id });
	if (modifiees.length === 1) return { ok: true };
	const [actuelle] = await db
		.select({ statut: commandes.statut })
		.from(commandes)
		.where(and(eq(commandes.id, commandeId), eq(commandes.venteId, venteId)));
	if (!actuelle) return INTROUVABLE;
	return {
		ok: false,
		message:
			actuelle.statut === 'annulee'
				? 'Cette commande a été annulée (paiement non reçu à temps) : son stock a été remis en vente. Rembourse le client ou recrée sa commande.'
				: 'Cette commande n’attend pas de paiement.'
	};
}

/** Marque une commande (non annulée) comme payée ou non payée. */
export async function marquerPayee(
	db: Db,
	venteId: number,
	commandeId: string,
	payee: boolean
): Promise<ResultatSuivi> {
	const modifiees = await db
		.update(commandes)
		.set({ payee })
		.where(
			and(
				eq(commandes.id, commandeId),
				eq(commandes.venteId, venteId),
				ne(commandes.statut, 'annulee')
			)
		)
		.returning({ id: commandes.id });
	return modifiees.length === 1 ? { ok: true } : INTROUVABLE;
}

/** Annule une commande à retirer de cette vente ; son stock est remis en vente. */
export async function annulerCommandeVente(
	db: Db,
	venteId: number,
	commandeId: string
): Promise<ResultatSuivi> {
	const [c] = await db
		.select({ statut: commandes.statut })
		.from(commandes)
		.where(and(eq(commandes.id, commandeId), eq(commandes.venteId, venteId)));
	if (!c) return INTROUVABLE;
	if (await annulerCommande(db, commandeId)) return { ok: true };
	return {
		ok: false,
		message:
			c.statut === 'recuperee'
				? 'Cette commande a déjà été récupérée : elle ne peut plus être annulée.'
				: 'Cette commande ne peut plus être annulée.'
	};
}

export interface ClientBloque {
	/** E-mail ou téléphone qui totalise les absences. */
	identifiant: string;
	type: 'email' | 'telephone';
	absences: number;
	noms: string[];
	references: string[];
}

/**
 * Clients bloqués : e-mails et téléphones qui totalisent assez de commandes non
 * récupérées non excusées (même règle que `estBloque`).
 */
export async function listerClientsBloques(db: Db, seuil: number): Promise<ClientBloque[]> {
	const absences = await db
		.select({
			nom: commandes.nom,
			email: commandes.email,
			telephone: commandes.telephone,
			reference: commandes.reference
		})
		.from(commandes)
		.where(and(eq(commandes.statut, 'non_recuperee'), eq(commandes.absenceExcusee, false)))
		.orderBy(asc(commandes.creeLe));
	const resultat: ClientBloque[] = [];
	for (const type of ['email', 'telephone'] as const) {
		for (const [identifiant, liste] of Map.groupBy(absences, (a) => a[type])) {
			if (liste.length < seuil) continue;
			// Déjà listé par son e-mail : ne pas le répéter pour son téléphone.
			const refs = liste.map((a) => a.reference);
			if (resultat.some((r) => refs.every((ref) => r.references.includes(ref)))) continue;
			resultat.push({
				identifiant,
				type,
				absences: liste.length,
				noms: [...new Set(liste.map((a) => a.nom))],
				references: refs
			});
		}
	}
	return resultat;
}

/**
 * Débloque un client : ses commandes non récupérées (par e-mail ou téléphone)
 * deviennent des absences excusées et ne comptent plus.
 */
export async function debloquerClient(db: Db, identifiant: string): Promise<number> {
	if (!identifiant) return 0;
	const excusees = await db
		.update(commandes)
		.set({ absenceExcusee: true })
		.where(
			and(
				eq(commandes.statut, 'non_recuperee'),
				eq(commandes.absenceExcusee, false),
				or(eq(commandes.email, identifiant), eq(commandes.telephone, identifiant))
			)
		)
		.returning({ id: commandes.id });
	return excusees.length;
}
