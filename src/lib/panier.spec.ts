import { describe, expect, it } from 'vitest';
import { quantitesDepuisUrl, quantitesVersUrl, recapitulatif, type OffrePanier } from './panier';

const concombre: OffrePanier = {
	id: 1,
	produit: 'Concombre',
	unite: 'piece',
	pas: 1,
	prixCentimes: 80,
	restant: 5
};
const patates: OffrePanier = {
	id: 2,
	produit: 'Pommes de terre',
	unite: 'kg',
	pas: 500,
	prixCentimes: 250,
	restant: 10_000
};

describe('panier dans l’URL', () => {
	it('fait l’aller-retour et ignore le reste', () => {
		const q = quantitesDepuisUrl(new URLSearchParams('o1=3&o2=1500&o3=0&x=1&o4=abc&o5=-2'));
		expect([...q]).toEqual([
			[1, 3],
			[2, 1500]
		]);
		expect(quantitesVersUrl(q)).toBe('o1=3&o2=1500');
	});
});

describe('recapitulatif', () => {
	it('calcule les lignes et le total', () => {
		const r = recapitulatif(
			[concombre, patates],
			new Map([
				[1, 3],
				[2, 1500]
			])
		);
		expect(r.lignes.map((l) => [l.offre.id, l.quantite, l.prixCentimes, l.reduite])).toEqual([
			[1, 3, 240, false],
			[2, 1500, 375, false]
		]);
		expect(r.totalCentimes).toBe(615);
	});

	it('réduit au stock restant et au pas, ignore les produits disparus', () => {
		const r = recapitulatif(
			[concombre, { ...patates, restant: 0 }],
			new Map([
				[1, 8],
				[2, 1500],
				[99, 1]
			])
		);
		expect(r.lignes.map((l) => [l.offre.id, l.quantite, l.reduite])).toEqual([
			[1, 5, true],
			[2, 0, true]
		]);
		expect(r.totalCentimes).toBe(400);
		expect(recapitulatif([patates], new Map([[2, 1200]])).lignes[0].quantite).toBe(1000);
	});
});
