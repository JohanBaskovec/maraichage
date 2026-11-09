import { afterEach, describe, expect, it, vi } from 'vitest';
import { turnstile } from './turnstile.ts';

afterEach(() => {
	vi.restoreAllMocks();
});

const reponse = (corps: object, status = 200) =>
	vi.fn(async () => new Response(JSON.stringify(corps), { status }));

describe('turnstile', () => {
	it('est désactivé sans clé du site ou sans clé secrète', () => {
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		expect(turnstile(undefined, undefined)).toBeNull();
		expect(turnstile('cle', undefined)).toBeNull();
		expect(turnstile('cle', '  ')).toBeNull();
		expect(turnstile(undefined, 'secret')).toBeNull();
		expect(turnstile(' cle ', 'secret')?.cleSite).toBe('cle');
	});

	it('envoie le secret, le jeton et l’adresse à Cloudflare', async () => {
		const appel = reponse({ success: true, action: 'commande' });
		expect(await turnstile('cle', 'secret', appel)!.verifier('jeton', '203.0.113.7')).toBe(true);
		const [url, init] = appel.mock.calls[0] as unknown as [string, RequestInit];
		expect(url).toBe('https://challenges.cloudflare.com/turnstile/v0/siteverify');
		expect(init.method).toBe('POST');
		const corps = init.body as FormData;
		expect(corps.get('secret')).toBe('secret');
		expect(corps.get('response')).toBe('jeton');
		expect(corps.get('remoteip')).toBe('203.0.113.7');
	});

	it('refuse sans jeton, sans appeler Cloudflare', async () => {
		const appel = vi.fn();
		const t = turnstile('cle', 'secret', appel)!;
		expect(await t.verifier(null, null)).toBe(false);
		expect(await t.verifier('x'.repeat(3000), null)).toBe(false);
		expect(appel).not.toHaveBeenCalled();
	});

	it('refuse un jeton rejeté par Cloudflare', async () => {
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		const appel = reponse({ success: false, 'error-codes': ['timeout-or-duplicate'] });
		expect(await turnstile('cle', 'secret', appel)!.verifier('jeton', null)).toBe(false);
	});

	it('refuse un jeton obtenu pour une autre action', async () => {
		const appel = reponse({ success: true, action: 'inscription' });
		expect(await turnstile('cle', 'secret', appel)!.verifier('jeton', null)).toBe(false);
	});

	it('accepte la réponse des clés de test (sans action)', async () => {
		const appel = reponse({ success: true });
		expect(await turnstile('cle', 'secret', appel)!.verifier('jeton', null)).toBe(true);
	});

	it('refuse si Cloudflare ne répond pas (sans lever d’erreur)', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const panne = vi.fn(async () => {
			throw new Error('réseau');
		});
		expect(await turnstile('cle', 'secret', panne)!.verifier('jeton', null)).toBe(false);
		const erreur = reponse({}, 500);
		expect(await turnstile('cle', 'secret', erreur)!.verifier('jeton', null)).toBe(false);
	});
});
