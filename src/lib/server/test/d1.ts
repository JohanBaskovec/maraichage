import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getPlatformProxy } from 'wrangler';
import { getDb } from '../db/index.ts';

const DOSSIER_MIGRATIONS = join(import.meta.dirname, '../../../../drizzle');

/**
 * Base D1 locale (Miniflare, le même moteur que Cloudflare), vide et migrée.
 * À appeler dans un `beforeEach` ; appeler `fermer()` dans le `afterEach`.
 */
export async function baseDeTest() {
	const proxy = await getPlatformProxy<Env>({ persist: false });
	const d1 = proxy.env.DB;
	const fichiers = readdirSync(DOSSIER_MIGRATIONS)
		.filter((f) => f.endsWith('.sql'))
		.sort();
	for (const fichier of fichiers) {
		const requetes = readFileSync(join(DOSSIER_MIGRATIONS, fichier), 'utf8')
			.split('--> statement-breakpoint')
			.map((r) => r.trim())
			.filter(Boolean);
		await d1.batch(requetes.map((r) => d1.prepare(r)));
	}
	return { db: getDb(d1), d1, fermer: () => proxy.dispose() };
}
