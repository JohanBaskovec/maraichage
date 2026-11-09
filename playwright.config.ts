import { defineConfig, devices } from '@playwright/test';

// Lancer avec `npm run test:e2e` (qui fait le build avant). Deux serveurs, chacun avec sa base locale recréée à chaque lancement :
// - « production » : le build réel servi par wrangler (boutique, sécurité) ;
//   /admin y est fermé faute de jeton Cloudflare Access, comme en ligne ;
// - « développement » : vite dev, où /admin est ouvert (tests du back-office).
const PROD = 'http://localhost:4180';
const DEV = 'http://localhost:5180';

export default defineConfig({
	testDir: 'e2e',
	fullyParallel: false,
	workers: 1,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	reporter: process.env.CI ? [['github'], ['list']] : 'list',
	use: {
		...devices['Pixel 7'],
		locale: 'fr-FR',
		timezoneId: 'Europe/Paris',
		trace: 'retain-on-failure'
	},
	projects: [
		{
			name: 'boutique',
			testMatch: ['boutique.spec.ts', 'securite.spec.ts'],
			use: { baseURL: PROD }
		},
		{ name: 'back-office', testMatch: 'back-office.spec.ts', use: { baseURL: DEV } }
	],
	webServer: [
		{
			command:
				'node e2e/preparer-base.mjs .wrangler/e2e-prod e2e/donnees-boutique.sql && npx wrangler dev --port 4180 --persist-to .wrangler/e2e-prod',
			url: PROD,
			timeout: 180_000,
			reuseExistingServer: false,
			env: { WRANGLER_SEND_METRICS: 'false' }
		},
		{
			command:
				'node e2e/preparer-base.mjs .wrangler/e2e-dev && npx vite dev --port 5180 --strictPort',
			url: `${DEV}/admin`,
			timeout: 180_000,
			reuseExistingServer: false,
			env: { E2E_PERSIST: '.wrangler/e2e-dev/v3', WRANGLER_SEND_METRICS: 'false' }
		}
	]
});
