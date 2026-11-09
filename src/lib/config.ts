// Réglages de la boutique.

/** Nom affiché en tête de la boutique et dans les titres de page. */
export const NOM_BOUTIQUE = 'La ferme d’Océane';

/**
 * Quantité maximale d'un produit dans une commande, en nombre de « pas » :
 * 20 pièces, 20 bottes, ou 10 kg pour un produit vendu par 500 g. Évite qu'une
 * fausse commande bloque tout le stock.
 */
export const MAX_PAS_PAR_PRODUIT = 20;

/** Nombre de commandes non récupérées à partir duquel un client ne peut plus commander. */
export const ABSENCES_AVANT_BLOCAGE = 2;

/** Le client peut annuler lui-même sa commande jusqu'à ce délai avant le début du retrait. */
export const ANNULATION_HEURES_AVANT_RETRAIT = 12;

/** Virement : délai pour payer après la commande… */
export const DELAI_VIREMENT_HEURES = 24;
/** …et au plus tard ce délai avant le début du retrait (« la veille »). */
export const VIREMENT_HEURES_AVANT_RETRAIT = 24;
/** En dessous de ce délai pour payer, le virement n'est pas proposé (retrait trop proche). */
export const VIREMENT_DELAI_MINIMUM_HEURES = 2;

/**
 * Informations légales (mentions légales, CGV, confidentialité).
 * ⚠️ PROVISOIRES : données fictives en attendant le SIRET et l'adresse réels.
 * Tant que `provisoire` vaut `true`, un bandeau l'annonce sur les pages légales.
 * Tout remplacer et passer `provisoire` à `false` avant d'ouvrir au public.
 */
export const INFOS_LEGALES = {
	provisoire: true,
	exploitant: 'Océane Exemple',
	statut: 'Entrepreneur individuel – exploitant agricole',
	siret: '000 000 000 00000',
	adresse: '42 rue de la Ferme, 00000 Exempleville',
	email: 'contact@johanbaskovec.fr',
	telephone: '06 00 00 00 00',
	directeurPublication: 'Océane Exemple',
	/** Médiateur de la consommation (obligatoire pour vendre aux particuliers). */
	mediateur: null as { nom: string; site: string } | null,
	hebergeur: {
		nom: 'Cloudflare, Inc.',
		adresse: '101 Townsend Street, San Francisco, CA 94107, États-Unis',
		// À vérifier sur le site de Cloudflare avant l'ouverture.
		telephone: '+1 650 319 8930',
		site: 'https://www.cloudflare.com'
	}
};

/** Adresse publique de la boutique, pour les liens des e-mails envoyés par les tâches planifiées. */
export const URL_BOUTIQUE = 'https://ferme.johanbaskovec.fr';

/** Expéditeur des e-mails (domaine vérifié chez Resend). Adresse provisoire. */
export const EXPEDITEUR_COURRIELS = 'La ferme d’Océane <commandes@johanbaskovec.fr>';

/** Adresse à laquelle arrivent les réponses des clients. Adresse provisoire. */
export const REPONSE_COURRIELS = 'contact@johanbaskovec.fr';

/** L'e-mail de rappel part à partir de ce délai avant le début du retrait (« la veille »)… */
export const RAPPEL_HEURES_AVANT_RETRAIT = 24;
/** …mais pas pour une commande passée il y a moins de ce délai (la confirmation est récente). */
export const RAPPEL_DELAI_MINIMUM_APRES_COMMANDE_HEURES = 6;
