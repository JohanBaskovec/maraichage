// Recrée une base D1 locale vide pour les tests de bout en bout, applique les
// migrations, puis éventuellement un jeu de données SQL.
// Usage : node e2e/preparer-base.mjs <dossier> [fichier.sql]
import { execFileSync } from 'node:child_process';
import { rmSync } from 'node:fs';

const [dossier, donnees] = process.argv.slice(2);
if (!dossier) throw new Error('Usage : node e2e/preparer-base.mjs <dossier> [fichier.sql]');

const wrangler = (...args) =>
	execFileSync(
		'npx',
		['wrangler', 'd1', ...args, 'maraichage', '--local', '--persist-to', dossier],
		{
			stdio: ['ignore', 'ignore', 'inherit'],
			env: { ...process.env, WRANGLER_SEND_METRICS: 'false' }
		}
	);

rmSync(dossier, { recursive: true, force: true });
wrangler('migrations', 'apply');
if (donnees) wrangler('execute', '--file', donnees);
console.log(`Base de test prête : ${dossier}${donnees ? ` (${donnees})` : ''}`);
