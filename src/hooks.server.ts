import type { Handle } from '@sveltejs/kit/hooks';
import { getDb } from '#lib/server/db/index.ts';

export const handle: Handle = async ({ event, resolve }) => {
	const d1 = event.platform?.env.DB;
	if (d1) event.locals.db = getDb(d1);
	return resolve(event);
};
