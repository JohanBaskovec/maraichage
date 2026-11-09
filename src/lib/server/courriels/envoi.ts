import { EXPEDITEUR_COURRIELS, REPONSE_COURRIELS } from '#lib/config.ts';

export interface Courriel {
	a: string;
	sujet: string;
	html: string;
	texte: string;
	/** Évite un doublon si le même envoi est retenté (ex. `confirmation-<id>`). */
	cleIdempotence?: string;
}

/** Envoie des e-mails. Ne lève jamais d'erreur : renvoie `false` en cas d'échec. */
export interface Courrielleur {
	envoyer(courriel: Courriel): Promise<boolean>;
}

/**
 * Envoi par l'API de Resend. Sans clé (`RESEND_API_KEY` absente), rien n'est
 * envoyé : la boutique fonctionne, les e-mails partiront dès la clé configurée.
 */
export function courrielleurResend(
	cle: string | undefined,
	appel: typeof fetch = (...args) => fetch(...args)
): Courrielleur {
	return {
		async envoyer(courriel) {
			if (!cle) {
				console.warn(`RESEND_API_KEY absente : e-mail « ${courriel.sujet} » non envoyé.`);
				return false;
			}
			try {
				const reponse = await appel('https://api.resend.com/emails', {
					method: 'POST',
					headers: {
						authorization: `Bearer ${cle}`,
						'content-type': 'application/json',
						...(courriel.cleIdempotence ? { 'idempotency-key': courriel.cleIdempotence } : {})
					},
					body: JSON.stringify({
						from: EXPEDITEUR_COURRIELS,
						to: [courriel.a],
						reply_to: REPONSE_COURRIELS,
						subject: courriel.sujet,
						html: courriel.html,
						text: courriel.texte
					})
				});
				if (!reponse.ok) {
					console.error(
						`Envoi de l'e-mail « ${courriel.sujet} » refusé (${reponse.status}) : ${await reponse.text()}`
					);
					return false;
				}
				return true;
			} catch (e) {
				console.error(`Envoi de l'e-mail « ${courriel.sujet} » impossible :`, e);
				return false;
			}
		}
	};
}
