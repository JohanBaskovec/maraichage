import { sql } from 'drizzle-orm';
import { check, index, integer, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core';

// Prix : entiers en centimes. Quantités : entiers dans l'unité de base
// (pièces, bottes, ou grammes pour les produits vendus au kg).

export const UNITES = ['piece', 'botte', 'kg'] as const;
export type Unite = (typeof UNITES)[number];

export const STATUTS_VENTE = ['brouillon', 'publiee', 'archivee'] as const;
export type StatutVente = (typeof STATUTS_VENTE)[number];

export const STATUTS_COMMANDE = [
	'en_attente_paiement',
	'confirmee',
	'prete',
	'recuperee',
	'annulee',
	'non_recuperee'
] as const;
export type StatutCommande = (typeof STATUTS_COMMANDE)[number];

/** Statuts pour lesquels la commande retient encore du stock et une place de créneau. */
export const STATUTS_ACTIFS = ['en_attente_paiement', 'confirmee', 'prete'] as const;

export const MODES_PAIEMENT = ['retrait', 'virement'] as const;
export type ModePaiement = (typeof MODES_PAIEMENT)[number];

const maintenantMs = sql`(cast(unixepoch('subsec') * 1000 as integer))`;

export const produits = sqliteTable(
	'produits',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		nom: text('nom').notNull(),
		unite: text('unite', { enum: UNITES }).notNull(),
		/** Pas d'ajout dans le panier, en unité de base (1 pièce, 500 g…). */
		pas: integer('pas').notNull().default(1),
		photo: text('photo'),
		actif: integer('actif', { mode: 'boolean' }).notNull().default(true)
	},
	(t) => [
		check('produits_unite_valide', sql`${t.unite} in ('piece', 'botte', 'kg')`),
		check('produits_pas_positif', sql`${t.pas} > 0`)
	]
);

export const ventes = sqliteTable(
	'ventes',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		/** Début de la prise de commandes. */
		ouverture: integer('ouverture', { mode: 'timestamp_ms' }).notNull(),
		/** Fin de la prise de commandes. */
		cloture: integer('cloture', { mode: 'timestamp_ms' }).notNull(),
		statut: text('statut', { enum: STATUTS_VENTE }).notNull().default('brouillon')
	},
	(t) => [
		check('ventes_statut_valide', sql`${t.statut} in ('brouillon', 'publiee', 'archivee')`),
		check('ventes_dates_coherentes', sql`${t.ouverture} < ${t.cloture}`)
	]
);

export const offres = sqliteTable(
	'offres',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		venteId: integer('vente_id')
			.notNull()
			.references(() => ventes.id, { onDelete: 'cascade' }),
		produitId: integer('produit_id')
			.notNull()
			.references(() => produits.id),
		/** Prix par pièce / botte, ou par kg. */
		prixCentimes: integer('prix_centimes').notNull(),
		qteInitiale: integer('qte_initiale').notNull(),
		qteReservee: integer('qte_reservee').notNull().default(0)
	},
	(t) => [
		unique('offres_vente_produit').on(t.venteId, t.produitId),
		check('offres_prix_positif', sql`${t.prixCentimes} >= 0`),
		// Garde-fou anti-survente : toute réservation qui dépasserait le stock échoue,
		// et fait échouer tout le lot (batch) dont elle fait partie.
		check(
			'offres_stock_suffisant',
			sql`${t.qteReservee} >= 0 and ${t.qteReservee} <= ${t.qteInitiale}`
		)
	]
);

export const creneaux = sqliteTable(
	'creneaux',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		venteId: integer('vente_id')
			.notNull()
			.references(() => ventes.id, { onDelete: 'cascade' }),
		/** AAAA-MM-JJ */
		date: text('date').notNull(),
		/** HH:MM */
		heureDebut: text('heure_debut').notNull(),
		/** HH:MM */
		heureFin: text('heure_fin').notNull(),
		lieu: text('lieu').notNull(),
		/** Nombre maximum de commandes ; null = sans limite. */
		capacite: integer('capacite'),
		/** Commandes non annulées sur ce créneau (+1 à la commande, −1 à l’annulation). */
		nbCommandes: integer('nb_commandes').notNull().default(0)
	},
	(t) => [
		check(
			'creneaux_capacite_respectee',
			sql`${t.nbCommandes} >= 0 and (${t.capacite} is null or ${t.nbCommandes} <= ${t.capacite})`
		)
	]
);

export const commandes = sqliteTable(
	'commandes',
	{
		id: text('id').primaryKey(),
		/** Référence courte donnée au client, ex. MAR-4F7K. */
		reference: text('reference').notNull().unique(),
		venteId: integer('vente_id')
			.notNull()
			.references(() => ventes.id),
		creneauId: integer('creneau_id')
			.notNull()
			.references(() => creneaux.id),
		nom: text('nom').notNull(),
		email: text('email').notNull(),
		telephone: text('telephone').notNull(),
		modePaiement: text('mode_paiement', { enum: MODES_PAIEMENT }).notNull(),
		statut: text('statut', { enum: STATUTS_COMMANDE }).notNull(),
		payee: integer('payee', { mode: 'boolean' }).notNull().default(false),
		/**
		 * Commande non récupérée que le maraîcher a pardonnée (« Débloquer ») :
		 * elle ne compte plus pour le blocage du client.
		 */
		absenceExcusee: integer('absence_excusee', { mode: 'boolean' }).notNull().default(false),
		totalCentimes: integer('total_centimes').notNull(),
		creeLe: integer('cree_le', { mode: 'timestamp_ms' }).notNull().default(maintenantMs),
		jetonAnnulation: text('jeton_annulation').notNull().unique()
	},
	(t) => [
		index('commandes_vente_creneau').on(t.venteId, t.creneauId),
		index('commandes_email').on(t.email),
		index('commandes_telephone').on(t.telephone),
		check('commandes_mode_paiement_valide', sql`${t.modePaiement} in ('retrait', 'virement')`),
		check(
			'commandes_statut_valide',
			sql`${t.statut} in ('en_attente_paiement', 'confirmee', 'prete', 'recuperee', 'annulee', 'non_recuperee')`
		)
	]
);

export const lignesCommande = sqliteTable(
	'lignes_commande',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		commandeId: text('commande_id')
			.notNull()
			.references(() => commandes.id, { onDelete: 'cascade' }),
		offreId: integer('offre_id')
			.notNull()
			.references(() => offres.id),
		/** En unité de base (pièces, bottes, grammes). */
		quantite: integer('quantite').notNull(),
		/** Prix recopié au moment de la commande (par pièce / botte, ou par kg). */
		prixUnitaireCentimes: integer('prix_unitaire_centimes').notNull()
	},
	(t) => [
		unique('lignes_commande_offre').on(t.commandeId, t.offreId),
		index('lignes_commande_offre_idx').on(t.offreId),
		check('lignes_commande_quantite_positive', sql`${t.quantite} > 0`)
	]
);
