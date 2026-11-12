import { describe, expect, it } from 'vitest';
import { estIllustration, ILLUSTRATIONS, urlIllustration } from './illustrations.ts';

describe('illustrations', () => {
	it('donne le dessin choisi, ou le dessin générique', () => {
		expect(urlIllustration('poireaux')).toBe('/illustrations/poireaux.svg');
		expect(urlIllustration(null)).toBe('/illustrations/panier.svg');
		expect(urlIllustration('inconnu')).toBe('/illustrations/panier.svg');
	});

	it('ne reconnaît que les clés de la liste', () => {
		expect(estIllustration('celeri-rave')).toBe(true);
		expect(estIllustration('toString')).toBe(false);
		expect(estIllustration('../potimarron')).toBe(false);
	});
});

describe('fichiers des illustrations', () => {
	it('existent pour chaque clé et pour le dessin générique', async () => {
		const { existsSync } = await import('node:fs');
		for (const cle of [...Object.keys(ILLUSTRATIONS), 'panier']) {
			expect(existsSync(`static/illustrations/${cle}.svg`), cle).toBe(true);
		}
	});
});
