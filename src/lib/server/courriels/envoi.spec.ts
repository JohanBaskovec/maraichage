import { afterEach, describe, expect, it, vi } from 'vitest';
import { courrielleurResend } from './envoi';

const courriel = {
	a: 'camille@example.fr',
	sujet: 'Commande MAR-4F7K',
	html: '<p>Bonjour</p>',
	texte: 'Bonjour',
	cleIdempotence: 'confirmation-123'
};

afterEach(() => {
	vi.restoreAllMocks();
});

describe('courrielleurResend', () => {
	it('appelle l’API de Resend avec l’expéditeur, la réponse et la clé d’idempotence', async () => {
		const appel = vi.fn(async () => new Response('{"id":"abc"}', { status: 200 }));
		expect(await courrielleurResend('re_test', appel).envoyer(courriel)).toBe(true);
		expect(appel).toHaveBeenCalledOnce();
		const [url, init] = appel.mock.calls[0] as unknown as [string, RequestInit];
		expect(url).toBe('https://api.resend.com/emails');
		expect(init.headers).toMatchObject({
			authorization: 'Bearer re_test',
			'idempotency-key': 'confirmation-123'
		});
		expect(JSON.parse(init.body as string)).toEqual({
			from: 'La ferme d’Océane <commandes@johanbaskovec.fr>',
			to: ['camille@example.fr'],
			reply_to: 'contact@johanbaskovec.fr',
			subject: 'Commande MAR-4F7K',
			html: '<p>Bonjour</p>',
			text: 'Bonjour'
		});
	});

	it('n’envoie rien sans clé', async () => {
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		const appel = vi.fn();
		expect(await courrielleurResend(undefined, appel).envoyer(courriel)).toBe(false);
		expect(appel).not.toHaveBeenCalled();
	});

	it('ne lève jamais d’erreur : refus de l’API ou réseau coupé', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const refus = vi.fn(async () => new Response('{"message":"invalid"}', { status: 422 }));
		expect(await courrielleurResend('re_test', refus).envoyer(courriel)).toBe(false);
		const coupure = vi.fn(async () => {
			throw new TypeError('network');
		});
		expect(await courrielleurResend('re_test', coupure).envoyer(courriel)).toBe(false);
	});
});
