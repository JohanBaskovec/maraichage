import type { Handle } from '@sveltejs/kit/hooks';
import { dev } from '$app/env';
import { env } from 'cloudflare:workers';
import { estRouteAdmin, verifierAcces } from '#lib/server/acces.ts';
import { courrielleurResend } from '#lib/server/courriels/envoi.ts';
import { getDb } from '#lib/server/db/index.ts';
import { lireCoordonneesVirement } from '#lib/virement.ts';

/**
 * En-têtes ajoutés à toutes les réponses :
 * - pas d'affichage dans un cadre (« clickjacking » sur le back-office) ;
 * - l'adresse de la page n'est pas transmise aux autres sites (celle de la
 *   confirmation contient l'identifiant secret de la commande) ;
 * - le navigateur ne devine pas le type des fichiers.
 */
const EN_TETES_SECURITE = {
	'x-frame-options': 'DENY',
	'content-security-policy': "frame-ancestors 'none'",
	'referrer-policy': 'same-origin',
	'x-content-type-options': 'nosniff'
};

function avecEnTetes(reponse: Response): Response {
	for (const [nom, valeur] of Object.entries(EN_TETES_SECURITE)) reponse.headers.set(nom, valeur);
	return reponse;
}

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.db = getDb(env.DB);
	event.locals.virement = lireCoordonneesVirement(env);
	event.locals.courriels = courrielleurResend(env.RESEND_API_KEY);

	if (estRouteAdmin(event.route.id, event.url.pathname)) {
		if (dev) {
			event.locals.admin = 'dev@local';
		} else {
			const jeton =
				event.request.headers.get('cf-access-jwt-assertion') ??
				event.cookies.get('CF_Authorization') ??
				null;
			const email = await verifierAcces(jeton, {
				equipe: env.ACCESS_EQUIPE,
				aud: env.ACCESS_AUD
			});
			if (!email) {
				return avecEnTetes(
					new Response('Accès réservé.', {
						status: 403,
						headers: { 'content-type': 'text/plain; charset=utf-8' }
					})
				);
			}
			event.locals.admin = email;
		}
	}

	return avecEnTetes(await resolve(event));
};
