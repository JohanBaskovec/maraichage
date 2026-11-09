-- Jeu de données des tests de la boutique : une vente ouverte depuis une heure,
-- qui ferme dans trois jours.
INSERT INTO produits (id, nom, unite, pas, actif) VALUES
	(1, 'Concombre', 'piece', 1, 1),
	(2, 'Pommes de terre', 'kg', 500, 1),
	(3, 'Radis', 'botte', 1, 1),
	(4, 'Courge butternut', 'piece', 1, 1),
	(5, 'Poireau', 'botte', 1, 0);

INSERT INTO ventes (id, ouverture, cloture, statut) VALUES
	(1, (unixepoch() - 3600) * 1000, (unixepoch() + 3 * 86400) * 1000, 'publiee');

INSERT INTO offres (vente_id, produit_id, prix_centimes, qte_initiale) VALUES
	(1, 1, 80, 200),     -- concombres à la pièce
	(1, 2, 250, 80000),  -- 80 kg de pommes de terre
	(1, 3, 150, 3),      -- 3 bottes de radis : sert au test « un autre client a été plus rapide »
	(1, 4, 300, 0),      -- épuisé dès le départ : n'apparaît pas
	(1, 5, 120, 50);     -- produit masqué : n'apparaît pas

INSERT INTO creneaux (vente_id, date, heure_debut, heure_fin, lieu, capacite) VALUES
	(1, '2030-01-05', '09:00', '12:00', 'À la ferme', 30),
	(1, '2030-01-05', '16:00', '18:00', 'Marché de la place', 1);
