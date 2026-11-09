import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
	chargerCoordonnees,
	chargerPanier,
	enregistrerCoordonnees,
	enregistrerPanier,
	viderPanier
} from './stockage';

class FauxStockage {
	donnees = new Map<string, string>();
	getItem = (k: string) => this.donnees.get(k) ?? null;
	setItem = (k: string, v: string) => void this.donnees.set(k, v);
	removeItem = (k: string) => void this.donnees.delete(k);
}

const global = globalThis as { localStorage?: unknown };
let stockage: FauxStockage;

beforeEach(() => {
	stockage = new FauxStockage();
	global.localStorage = stockage;
});
afterEach(() => {
	delete global.localStorage;
});

describe('panier mémorisé', () => {
	it('fait l’aller-retour, par vente', () => {
		enregistrerPanier(1, { 12: 3, 14: 1500 });
		expect(chargerPanier(1)).toEqual({ 12: 3, 14: 1500 });
		expect(chargerPanier(2)).toEqual({});
		viderPanier(1);
		expect(chargerPanier(1)).toEqual({});
	});

	it('ignore les valeurs corrompues', () => {
		stockage.setItem('panier-1', JSON.stringify({ 1: 2, 2: -1, 3: 1.5, 4: 'x' }));
		expect(chargerPanier(1)).toEqual({ 1: 2 });
		stockage.setItem('panier-1', '{pas du json');
		expect(chargerPanier(1)).toEqual({});
	});

	it('n’enregistre pas un panier vide', () => {
		enregistrerPanier(1, {});
		expect(stockage.donnees.size).toBe(0);
	});
});

describe('stockage indisponible (navigation privée, données bloquées)', () => {
	it('ne fait jamais planter la page', () => {
		global.localStorage = {
			getItem: () => {
				throw new Error('SecurityError');
			},
			setItem: () => {
				throw new Error('QuotaExceededError');
			},
			removeItem: () => {
				throw new Error('SecurityError');
			}
		};
		expect(() => enregistrerPanier(1, { 1: 1 })).not.toThrow();
		expect(chargerPanier(1)).toEqual({});
		expect(() => viderPanier(1)).not.toThrow();
		expect(() => enregistrerCoordonnees({ nom: 'a', email: 'b', telephone: 'c' })).not.toThrow();
		expect(chargerCoordonnees()).toBeNull();
	});

	it('fonctionne aussi sans localStorage du tout', () => {
		delete global.localStorage;
		expect(chargerPanier(1)).toEqual({});
	});
});
