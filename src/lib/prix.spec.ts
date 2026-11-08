import { describe, expect, it } from 'vitest';
import { prixLigneCentimes } from './prix';

describe('prixLigneCentimes', () => {
	it('multiplie le prix unitaire pour la pièce', () => {
		expect(prixLigneCentimes('piece', 80, 3)).toBe(240);
	});

	it('calcule au gramme pour le kg', () => {
		// 2,50 €/kg × 1,5 kg = 3,75 €
		expect(prixLigneCentimes('kg', 250, 1500)).toBe(375);
	});

	it('arrondit au centime', () => {
		// 3,99 €/kg × 500 g = 1,995 € → 2,00 €
		expect(prixLigneCentimes('kg', 399, 500)).toBe(200);
	});
});
