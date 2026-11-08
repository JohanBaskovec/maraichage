CREATE TABLE `commandes` (
	`id` text PRIMARY KEY NOT NULL,
	`reference` text NOT NULL,
	`vente_id` integer NOT NULL,
	`creneau_id` integer NOT NULL,
	`nom` text NOT NULL,
	`email` text NOT NULL,
	`telephone` text NOT NULL,
	`mode_paiement` text NOT NULL,
	`statut` text NOT NULL,
	`payee` integer DEFAULT false NOT NULL,
	`total_centimes` integer NOT NULL,
	`cree_le` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	`jeton_annulation` text NOT NULL,
	FOREIGN KEY (`vente_id`) REFERENCES `ventes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`creneau_id`) REFERENCES `creneaux`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "commandes_mode_paiement_valide" CHECK("commandes"."mode_paiement" in ('retrait', 'virement')),
	CONSTRAINT "commandes_statut_valide" CHECK("commandes"."statut" in ('en_attente_paiement', 'confirmee', 'prete', 'recuperee', 'annulee', 'non_recuperee'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `commandes_reference_unique` ON `commandes` (`reference`);--> statement-breakpoint
CREATE UNIQUE INDEX `commandes_jeton_annulation_unique` ON `commandes` (`jeton_annulation`);--> statement-breakpoint
CREATE INDEX `commandes_vente_creneau` ON `commandes` (`vente_id`,`creneau_id`);--> statement-breakpoint
CREATE INDEX `commandes_email` ON `commandes` (`email`);--> statement-breakpoint
CREATE INDEX `commandes_telephone` ON `commandes` (`telephone`);--> statement-breakpoint
CREATE TABLE `creneaux` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`vente_id` integer NOT NULL,
	`date` text NOT NULL,
	`heure_debut` text NOT NULL,
	`heure_fin` text NOT NULL,
	`lieu` text NOT NULL,
	`capacite` integer,
	`nb_commandes` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`vente_id`) REFERENCES `ventes`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "creneaux_capacite_respectee" CHECK("creneaux"."nb_commandes" >= 0 and ("creneaux"."capacite" is null or "creneaux"."nb_commandes" <= "creneaux"."capacite"))
);
--> statement-breakpoint
CREATE TABLE `lignes_commande` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`commande_id` text NOT NULL,
	`offre_id` integer NOT NULL,
	`quantite` integer NOT NULL,
	`prix_unitaire_centimes` integer NOT NULL,
	FOREIGN KEY (`commande_id`) REFERENCES `commandes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`offre_id`) REFERENCES `offres`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "lignes_commande_quantite_positive" CHECK("lignes_commande"."quantite" > 0)
);
--> statement-breakpoint
CREATE INDEX `lignes_commande_offre_idx` ON `lignes_commande` (`offre_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `lignes_commande_offre` ON `lignes_commande` (`commande_id`,`offre_id`);--> statement-breakpoint
CREATE TABLE `offres` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`vente_id` integer NOT NULL,
	`produit_id` integer NOT NULL,
	`prix_centimes` integer NOT NULL,
	`qte_initiale` integer NOT NULL,
	`qte_reservee` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`vente_id`) REFERENCES `ventes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`produit_id`) REFERENCES `produits`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "offres_prix_positif" CHECK("offres"."prix_centimes" >= 0),
	CONSTRAINT "offres_stock_suffisant" CHECK("offres"."qte_reservee" >= 0 and "offres"."qte_reservee" <= "offres"."qte_initiale")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `offres_vente_produit` ON `offres` (`vente_id`,`produit_id`);--> statement-breakpoint
CREATE TABLE `produits` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`nom` text NOT NULL,
	`unite` text NOT NULL,
	`pas` integer DEFAULT 1 NOT NULL,
	`photo` text,
	`actif` integer DEFAULT true NOT NULL,
	CONSTRAINT "produits_unite_valide" CHECK("produits"."unite" in ('piece', 'botte', 'kg')),
	CONSTRAINT "produits_pas_positif" CHECK("produits"."pas" > 0)
);
--> statement-breakpoint
CREATE TABLE `ventes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ouverture` integer NOT NULL,
	`cloture` integer NOT NULL,
	`statut` text DEFAULT 'brouillon' NOT NULL,
	CONSTRAINT "ventes_statut_valide" CHECK("ventes"."statut" in ('brouillon', 'publiee', 'archivee')),
	CONSTRAINT "ventes_dates_coherentes" CHECK("ventes"."ouverture" < "ventes"."cloture")
);
