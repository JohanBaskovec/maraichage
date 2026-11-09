// Secrets Cloudflare, définis hors du code : dans le tableau de bord du Worker
// (Settings → Variables and Secrets, type « Secret ») ou avec
// `npx wrangler secret put NOM`. En local : fichier .dev.vars (non commité).
// Absents, le paiement par virement n'est simplement pas proposé.
declare namespace Cloudflare {
	interface Env {
		/** IBAN du compte qui reçoit les virements, ex. « FR76 3000 6000 0112 3456 7890 189 ». */
		VIREMENT_IBAN?: string;
		/** BIC de la banque (facultatif). */
		VIREMENT_BIC?: string;
		/** Nom du titulaire du compte, tel que la banque l'affiche. */
		VIREMENT_TITULAIRE?: string;
		/** Clé d'API Resend pour envoyer les e-mails (dans les deux Workers). */
		RESEND_API_KEY?: string;
		/** Clé secrète du widget Turnstile (anti-robot du formulaire de commande). */
		TURNSTILE_SECRET?: string;
	}
}
