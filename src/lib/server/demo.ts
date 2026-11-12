import { eq } from 'drizzle-orm';
import { ajouterJours, depuisChampParis, versChampParis } from '#lib/heure.ts';
import type { Illustration } from '#lib/illustrations.ts';
import {
	ajouterCreneau,
	ajouterOffre,
	changerStatutVente,
	creerProduit,
	creerVente,
	listerProduits,
	type Resultat
} from './admin.ts';
import {
	changerStatutCommande,
	confirmerPaiement,
	marquerPayee,
	type ResultatSuivi
} from './admin-commandes.ts';
import { venteEnCours } from './boutique.ts';
import { annulerCommande, passerCommande, type CommandeDemandee } from './commandes.ts';
import type { Db } from './db/index.ts';
import { creneaux, offres, ventes, type Unite } from './db/schema.ts';

// Données de démonstration pour le développement local (`npm run dev`, via
// scripts/demo.ts). Tout passe par les fonctions du site, comme si le maraîcher
// et des clients avaient utilisé les écrans : les stocks et les places de
// créneau restent cohérents. Jamais utilisé en production.

interface ProduitDemo {
	nom: string;
	unite: Unite;
	pas: number;
	illustration: Illustration | null;
	description: string;
	prixCentimes: number;
	/** En unité de base (pièces, bottes, grammes). */
	stock: number;
}

export const PRODUITS_DEMO: readonly ProduitDemo[] = [
	{
		nom: 'Betteraves',
		unite: 'kg',
		pas: 500,
		illustration: 'betteraves',
		description: 'Rouges et sucrées, à rôtir ou en salade.',
		prixCentimes: 280,
		stock: 25_000
	},
	{
		nom: 'Carottes',
		unite: 'kg',
		pas: 500,
		illustration: 'carottes',
		description: 'Croquantes, récoltées la veille.',
		prixCentimes: 220,
		stock: 40_000
	},
	{
		nom: 'Céleri-rave',
		unite: 'piece',
		pas: 1,
		illustration: 'celeri-rave',
		description: 'Pour une purée ou une rémoulade.',
		prixCentimes: 250,
		stock: 18
	},
	{
		nom: 'Chou vert',
		unite: 'piece',
		pas: 1,
		illustration: 'chou',
		description: 'Frisé et bien pommé.',
		prixCentimes: 300,
		stock: 12
	},
	{
		nom: 'Mâche',
		unite: 'kg',
		pas: 250,
		illustration: 'mache',
		description: 'Jeunes pousses tendres, à laver.',
		prixCentimes: 1800,
		stock: 3_000
	},
	{
		nom: 'Poireaux',
		unite: 'botte',
		pas: 1,
		illustration: 'poireaux',
		description: 'Botte de trois, parfaits en fondue.',
		prixCentimes: 250,
		stock: 30
	},
	{
		nom: 'Pommes de terre',
		unite: 'kg',
		pas: 500,
		illustration: 'pommes-de-terre',
		description: 'Chair ferme, variété Charlotte.',
		prixCentimes: 250,
		stock: 80_000
	},
	{
		nom: 'Potimarron',
		unite: 'piece',
		pas: 1,
		illustration: 'potimarron',
		description: 'Doux et fondant, parfait en velouté.',
		prixCentimes: 350,
		stock: 20
	},
	{
		nom: 'Radis noir',
		unite: 'piece',
		pas: 1,
		illustration: 'radis-noir',
		description: 'Piquant, à râper cru.',
		prixCentimes: 150,
		stock: 5
	},
	// Sans dessin : montre la cagette par défaut.
	{
		nom: 'Persil',
		unite: 'botte',
		pas: 1,
		illustration: null,
		description: 'Plat, en botte généreuse.',
		prixCentimes: 120,
		stock: 15
	}
];

export interface BilanDemo {
	produitsCrees: number;
	/** `false` si une vente prenait déjà des commandes : rien n'a été ajouté. */
	venteCreee: boolean;
	/** Vente passée et archivée, créée seulement dans une base sans aucune vente. */
	ventePasseeCreee: boolean;
}

function verifier<T extends Resultat<object> | ResultatSuivi>(r: T, action: string) {
	if (!r.ok) throw new Error(`Données de démo – ${action} : ${r.message}`);
	return r as Extract<T, { ok: true }>;
}

/** Samedi de retrait de la vente de démo : au moins deux jours après aujourd'hui. */
function samediDeRetrait(aujourdhui: string): string {
	const jour = new Date(aujourdhui + 'T12:00:00Z').getUTCDay();
	let ecart = (6 - jour + 7) % 7;
	if (ecart < 2) ecart += 7;
	return ajouterJours(aujourdhui, ecart);
}

const heureParis = (jour: string, heure: string) => depuisChampParis(`${jour}T${heure}`)!;

/** Vente publiée avec toutes les offres et les créneaux donnés ; renvoie ses identifiants. */
async function creerVenteDemo(
	db: Db,
	ouverture: Date,
	cloture: Date,
	idsProduits: Map<string, number>,
	lesCreneaux: Parameters<typeof ajouterCreneau>[2][]
) {
	const { id: venteId } = verifier(await creerVente(db, ouverture, cloture), 'vente');
	for (const p of PRODUITS_DEMO) {
		const produitId = idsProduits.get(p.nom)!;
		verifier(await ajouterOffre(db, venteId, produitId, p.prixCentimes, p.stock), p.nom);
	}
	for (const c of lesCreneaux) verifier(await ajouterCreneau(db, venteId, c), 'créneau');
	verifier(await changerStatutVente(db, venteId, 'publiee'), 'publication');

	const lesOffres = await db
		.select({ id: offres.id, produitId: offres.produitId })
		.from(offres)
		.where(eq(offres.venteId, venteId));
	const offreDe = new Map(lesOffres.map((o) => [o.produitId, o.id]));
	const idsCreneaux = await db
		.select({ id: creneaux.id })
		.from(creneaux)
		.where(eq(creneaux.venteId, venteId))
		.orderBy(creneaux.date, creneaux.heureDebut);

	return {
		venteId,
		creneau: (i: number) => idsCreneaux[i].id,
		offre: (nom: string) => offreDe.get(idsProduits.get(nom)!)!
	};
}

type VenteDemo = Awaited<ReturnType<typeof creerVenteDemo>>;

interface ClientDemo {
	nom: string;
	telephone: string;
	creneau: number;
	modePaiement: CommandeDemandee['modePaiement'];
	/** [produit, quantité en unité de base] */
	panier: [string, number][];
}

async function commander(db: Db, vente: VenteDemo, client: ClientDemo, maintenant: Date) {
	const email =
		client.nom
			.normalize('NFD')
			.replace(/\p{Diacritic}/gu, '')
			.toLowerCase()
			.replace(/[^a-z]+/g, '.') + '@example.com';
	const r = await passerCommande(
		db,
		{
			venteId: vente.venteId,
			creneauId: vente.creneau(client.creneau),
			nom: client.nom,
			email,
			telephone: client.telephone,
			modePaiement: client.modePaiement,
			lignes: client.panier.map(([nom, quantite]) => ({ offreId: vente.offre(nom), quantite }))
		},
		maintenant
	);
	if (!r.ok) throw new Error(`Données de démo – commande de ${client.nom} : ${r.erreur}`);
	return r.id;
}

/**
 * Remplit une base locale avec des données de démonstration :
 * - les produits de démo qui n'existent pas encore (par leur nom) ;
 * - s'il n'y a aucune vente ouverte, une vente publiée jusqu'au vendredi soir,
 *   retrait le samedi, avec des commandes dans tous les états ;
 * - dans une base sans aucune vente, une vente de la semaine passée, archivée,
 *   pour tester la duplication et le blocage après une absence.
 * Une base qui a déjà une vente ouverte n'est pas touchée (hors produits manquants).
 */
export async function remplirDemo(db: Db, maintenant: Date = new Date()): Promise<BilanDemo> {
	const existants = new Map((await listerProduits(db)).map((p) => [p.nom, p.id]));
	let produitsCrees = 0;
	for (const p of PRODUITS_DEMO) {
		if (existants.has(p.nom)) continue;
		const { id } = verifier(await creerProduit(db, p), p.nom);
		existants.set(p.nom, id);
		produitsCrees++;
	}

	if (await venteEnCours(db, maintenant)) {
		return { produitsCrees, venteCreee: false, ventePasseeCreee: false };
	}
	const aucuneVente = (await db.$count(ventes)) === 0;
	const aujourdhui = versChampParis(maintenant).slice(0, 10);
	const samedi = samediDeRetrait(aujourdhui);

	// Semaine passée : ventes terminées, un client n'est pas venu.
	let ventePasseeCreee = false;
	if (aucuneVente) {
		let samediPasse = ajouterJours(samedi, -7);
		if (samediPasse >= aujourdhui) samediPasse = ajouterJours(samedi, -14);
		const cloture = heureParis(ajouterJours(samediPasse, -1), '20:00');
		const ouverture = new Date(cloture.getTime() - 6 * 86_400_000);
		const passee = await creerVenteDemo(db, ouverture, cloture, existants, [
			{
				date: samediPasse,
				heureDebut: '09:00',
				heureFin: '12:00',
				lieu: 'À la ferme',
				capacite: 20
			}
		]);
		const commandeLe = new Date(ouverture.getTime() + 86_400_000);
		const clients: [ClientDemo, 'recuperee' | 'non_recuperee'][] = [
			[
				{
					nom: 'Camille Martin',
					telephone: '0612345678',
					creneau: 0,
					modePaiement: 'retrait',
					panier: [
						['Carottes', 1000],
						['Potimarron', 1]
					]
				},
				'recuperee'
			],
			[
				{
					nom: 'Hugo Bernard',
					telephone: '0623456789',
					creneau: 0,
					modePaiement: 'retrait',
					panier: [['Pommes de terre', 2500]]
				},
				'recuperee'
			],
			[
				{
					nom: 'Noé Garnier',
					telephone: '0634567890',
					creneau: 0,
					modePaiement: 'retrait',
					panier: [['Chou vert', 1]]
				},
				'non_recuperee'
			]
		];
		for (const [client, statut] of clients) {
			const id = await commander(db, passee, client, commandeLe);
			verifier(await changerStatutCommande(db, passee.venteId, id, statut), statut);
			if (statut === 'recuperee') {
				verifier(await marquerPayee(db, passee.venteId, id, true), 'payée');
			}
		}
		verifier(await changerStatutVente(db, passee.venteId, 'archivee'), 'archivage');
		ventePasseeCreee = true;
	}

	// Vente de la semaine : ouverte depuis une heure, jusqu'au vendredi 20 h.
	const vente = await creerVenteDemo(
		db,
		new Date(maintenant.getTime() - 3_600_000),
		heureParis(ajouterJours(samedi, -1), '20:00'),
		existants,
		[
			{ date: samedi, heureDebut: '09:00', heureFin: '12:00', lieu: 'À la ferme', capacite: 20 },
			{
				date: samedi,
				heureDebut: '16:00',
				heureFin: '19:00',
				lieu: 'Marché de la place',
				capacite: 3
			},
			{
				date: ajouterJours(samedi, 3),
				heureDebut: '17:30',
				heureFin: '19:00',
				lieu: 'À la ferme',
				capacite: null
			}
		]
	);
	const commande = (client: ClientDemo) => commander(db, vente, client, maintenant);

	// À retirer, paiement sur place.
	await commande({
		nom: 'Camille Martin',
		telephone: '0612345678',
		creneau: 0,
		modePaiement: 'retrait',
		panier: [
			['Carottes', 1000],
			['Poireaux', 2],
			['Radis noir', 1]
		]
	});
	// Virement pas encore reçu.
	await commande({
		nom: 'Léa Dubois',
		telephone: '0645678901',
		creneau: 0,
		modePaiement: 'virement',
		panier: [
			['Potimarron', 2],
			['Mâche', 250]
		]
	});
	// Virement reçu.
	const hugo = await commande({
		nom: 'Hugo Bernard',
		telephone: '0623456789',
		creneau: 1,
		modePaiement: 'virement',
		panier: [
			['Pommes de terre', 3000],
			['Radis noir', 1]
		]
	});
	verifier(await confirmerPaiement(db, vente.venteId, hugo), 'paiement reçu');
	// Déjà préparée.
	const ines = await commande({
		nom: 'Inès Moreau',
		telephone: '0656789012',
		creneau: 1,
		modePaiement: 'retrait',
		panier: [
			['Betteraves', 1500],
			['Céleri-rave', 1],
			['Persil', 1]
		]
	});
	verifier(await changerStatutCommande(db, vente.venteId, ines, 'prete'), 'prête');
	// Annulée : son stock et sa place sont revenus.
	const paul = await commande({
		nom: 'Paul Lefèvre',
		telephone: '0667890123',
		creneau: 2,
		modePaiement: 'retrait',
		panier: [['Chou vert', 2]]
	});
	await annulerCommande(db, paul);

	return { produitsCrees, venteCreee: true, ventePasseeCreee };
}
