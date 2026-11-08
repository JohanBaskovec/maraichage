import { describe, expect, it } from 'vitest';
import {
	eurosPourChamp,
	formatEuros,
	formatQuantite,
	lireEuros,
	lireQuantite,
	quantitePourChamp
} from './format';

describe('euros', () => {
	it('lit les saisies usuelles', () => {
		expect(lireEuros('0,80')).toBe(80);
		expect(lireEuros('2.5')).toBe(250);
		expect(lireEuros(' 12 € ')).toBe(1200);
		expect(lireEuros('0,1')).toBe(10);
	});
	it('refuse le reste', () => {
		for (const s of ['', 'abc', '-1', '1,234', '1,2,3']) expect(lireEuros(s)).toBeNull();
	});
	it('formate', () => {
		expect(formatEuros(80).replace(/\s/g, ' ')).toBe('0,80 €');
		expect(eurosPourChamp(250)).toBe('2,50');
	});
});

describe('quantités', () => {
	it('lit des kg décimaux en grammes', () => {
		expect(lireQuantite('kg', '80')).toBe(80_000);
		expect(lireQuantite('kg', '2,5')).toBe(2500);
		expect(lireQuantite('kg', '0.125')).toBe(125);
		expect(quantitePourChamp('kg', 2500)).toBe('2,5');
	});
	it('lit des pièces entières', () => {
		expect(lireQuantite('piece', '200')).toBe(200);
		expect(lireQuantite('piece', '2,5')).toBeNull();
		expect(lireQuantite('botte', '')).toBeNull();
	});
	it('formate', () => {
		expect(formatQuantite('piece', 1)).toBe('1 pièce');
		expect(formatQuantite('botte', 3)).toBe('3 bottes');
		expect(formatQuantite('kg', 500)).toBe('500 g');
		expect(formatQuantite('kg', 0)).toBe('0 kg');
		expect(formatQuantite('kg', 1500)).toBe('1,5 kg');
	});
});
