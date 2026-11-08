import { describe, expect, it } from 'vitest';
import { genererJetonAnnulation, genererReference } from './jetons';

describe('genererReference', () => {
	it('produit MAR- suivi de 4 caractères non ambigus', () => {
		for (let i = 0; i < 500; i++) {
			expect(genererReference()).toMatch(/^MAR-[2-9A-HJKMNP-Z]{4}$/);
		}
	});
});

describe('genererJetonAnnulation', () => {
	it('produit un jeton base64url de 43 caractères, différent à chaque fois', () => {
		const a = genererJetonAnnulation();
		expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
		expect(genererJetonAnnulation()).not.toBe(a);
	});
});
