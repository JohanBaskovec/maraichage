import { expect, test } from '@playwright/test';

// Build de production, sans Cloudflare Access devant : le site doit rester sûr seul.

test.describe('le back-office est fermé sans jeton Cloudflare Access valide', () => {
	for (const chemin of [
		'/admin',
		'/admin/produits',
		'/admin/ventes/1',
		'/admin/__data.json',
		'/admin/inexistant',
		// « a » encodé : doit mener au même refus
		'/%61dmin',
		'/%61dmin/produits'
	]) {
		test(`GET ${chemin} → 403`, async ({ request }) => {
			const r = await request.get(chemin, { maxRedirects: 0 });
			expect(r.status()).toBe(403);
			expect(await r.text()).not.toContain('Back-office');
		});
	}

	test('une action du back-office est refusée', async ({ request, baseURL }) => {
		const r = await request.post('/admin/ventes/1?/statut', {
			form: { statut: 'archivee' },
			headers: { origin: baseURL! },
			maxRedirects: 0
		});
		expect(r.status()).toBe(403);
	});

	test('un faux jeton est refusé', async ({ request }) => {
		const faux =
			'eyJhbGciOiJSUzI1NiIsImtpZCI6IngifQ.eyJlbWFpbCI6InBpcmF0ZUBleGFtcGxlLmZyIn0.c2lnbmF0dXJl';
		const essais: Record<string, string>[] = [
			{ 'cf-access-jwt-assertion': faux },
			{ cookie: `CF_Authorization=${faux}` }
		];
		for (const headers of essais) {
			const r = await request.get('/admin', { headers, maxRedirects: 0 });
			expect(r.status()).toBe(403);
		}
	});
});

test('une commande envoyée depuis un autre site est refusée (CSRF)', async ({ request }) => {
	const r = await request.post('/commande?/commander', {
		form: {
			nom: 'X',
			email: 'x@example.fr',
			telephone: '0612345678',
			creneau: '1',
			cgv: 'oui',
			o1: '1'
		},
		headers: { origin: 'https://pirate.example' },
		maxRedirects: 0
	});
	expect(r.status()).toBe(403);
});

test('les en-têtes de sécurité sont présents', async ({ request }) => {
	for (const chemin of ['/', '/admin']) {
		const r = await request.get(chemin, { maxRedirects: 0 });
		expect(r.headers()['x-frame-options']).toBe('DENY');
		expect(r.headers()['content-security-policy']).toContain("frame-ancestors 'none'");
		expect(r.headers()['referrer-policy']).toBe('same-origin');
		expect(r.headers()['x-content-type-options']).toBe('nosniff');
	}
});
