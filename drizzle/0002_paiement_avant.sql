ALTER TABLE `commandes` ADD `paiement_avant` integer;--> statement-breakpoint
CREATE INDEX `commandes_statut_paiement_avant` ON `commandes` (`statut`,`paiement_avant`);