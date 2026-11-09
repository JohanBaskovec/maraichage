// Cloudflare Turnstile : vérification anti-robot du formulaire de commande.
// Le navigateur obtient un jeton à usage unique (widget sur la page) ; le
// serveur le fait valider par Cloudflare avant d'enregistrer la commande.

const URL_VERIFICATION = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/** Nom de l'action déclarée par le widget, contrôlé à la vérification. */
export const ACTION_TURNSTILE = 'commande';

/** Nom du champ que le widget ajoute au formulaire. */
export const CHAMP_TURNSTILE = 'cf-turnstile-response';

let avertissementDonne = false;

export interface Turnstile {
	/** Clé publique du widget, transmise à la page. */
	cleSite: string;
	/** `true` si Cloudflare confirme le jeton. Ne lève jamais d'erreur. */
	verifier(jeton: string | null, ip: string | null): Promise<boolean>;
}

/**
 * Vérificateur Turnstile, ou `null` (vérification désactivée) s'il manque la
 * clé du site ou la clé secrète : en développement sans `.dev.vars`, la boutique
 * fonctionne sans widget. En production, les deux sont configurées.
 */
export function turnstile(
	cleSite: string | undefined,
	secret: string | undefined,
	appel: typeof fetch = (...args) => fetch(...args)
): Turnstile | null {
	cleSite = cleSite?.trim();
	secret = secret?.trim();
	if (!cleSite || !secret) {
		if (cleSite && !avertissementDonne) {
			avertissementDonne = true;
			console.warn('TURNSTILE_SECRET absente : vérification anti-robot désactivée.');
		}
		return null;
	}
	return {
		cleSite,
		async verifier(jeton, ip) {
			if (!jeton || jeton.length > 2048) return false;
			const corps = new FormData();
			corps.append('secret', secret);
			corps.append('response', jeton);
			if (ip) corps.append('remoteip', ip);
			try {
				const reponse = await appel(URL_VERIFICATION, { method: 'POST', body: corps });
				if (!reponse.ok) {
					console.error(`Vérification Turnstile impossible (${reponse.status}).`);
					return false;
				}
				const r = (await reponse.json()) as {
					success?: boolean;
					action?: string;
					'error-codes'?: string[];
				};
				if (!r.success) {
					console.warn(`Jeton Turnstile refusé : ${(r['error-codes'] ?? []).join(', ')}`);
					return false;
				}
				// Les clés de test de Cloudflare ne renvoient pas d'action.
				return r.action === undefined || r.action === '' || r.action === ACTION_TURNSTILE;
			} catch (e) {
				console.error('Vérification Turnstile impossible :', e);
				return false;
			}
		}
	};
}
