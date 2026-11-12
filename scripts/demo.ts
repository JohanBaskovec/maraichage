// Prépare la base D1 locale pour `npm run dev` (lancé automatiquement par
// `predev`) : applique les migrations, puis ajoute les données de démonstration
// s'il n'y a pas de vente ouverte (voir src/lib/server/demo.ts).
//   node scripts/demo.ts                 → complète la base locale
//   node scripts/demo.ts --reinitialiser → efface la base locale et repart de zéro
// Ne touche jamais la base de production (toujours --local).
import { execFileSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { getPlatformProxy } from 'wrangler';
import { getDb } from '../src/lib/server/db/index.ts';
import { remplirDemo } from '../src/lib/server/demo.ts';

const DOSSIER = '.wrangler/state';
const env = { ...process.env, WRANGLER_SEND_METRICS: 'false' };

if (process.argv.includes('--reinitialiser')) {
	rmSync(DOSSIER, { recursive: true, force: true });
	console.log('Base locale effacée.');
}

execFileSync('npx', ['wrangler', 'd1', 'migrations', 'apply', 'maraichage', '--local'], {
	stdio: ['ignore', 'ignore', 'inherit'],
	env
});

// Même base que `vite dev` (.wrangler/state/v3).
const proxy = await getPlatformProxy<Env>({ persist: { path: `${DOSSIER}/v3` } });
try {
	const bilan = await remplirDemo(getDb(proxy.env.DB));
	if (bilan.produitsCrees) {
		console.log(`Données de démo : ${bilan.produitsCrees} produits ajoutés.`);
	}
	if (bilan.venteCreee) {
		console.log(
			`Données de démo : vente ouverte avec quelques commandes${bilan.ventePasseeCreee ? ', et une vente passée' : ''}.`
		);
	} else {
		console.log(
			'Une vente est déjà ouverte en local : elle est gardée telle quelle. ' +
				'Pour repartir des données de démo : npm run db:demo (efface la base locale).'
		);
	}
} finally {
	await proxy.dispose();
}
