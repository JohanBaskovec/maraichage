import { error } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit/hooks';
import { dev } from '$app/env';
import { env } from 'cloudflare:workers';
import { verifierAcces } from '#lib/server/acces.ts';
import { getDb } from '#lib/server/db/index.ts';

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.db = getDb(env.DB);

	if (event.url.pathname === '/admin' || event.url.pathname.startsWith('/admin/')) {
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
			if (!email) error(403, 'Accès réservé.');
			event.locals.admin = email;
		}
	}

	return resolve(event);
};
