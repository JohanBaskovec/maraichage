import { describe, expect, it } from 'vitest';
import {
	ajouterJours,
	depuisChampParis,
	formatHeure,
	formatPlage,
	jourSemaine,
	versChampParis
} from './heure';

describe('heure de Paris', () => {
	it('convertit en hiver (UTC+1) et en été (UTC+2)', () => {
		expect(depuisChampParis('2026-11-12T20:00')?.toISOString()).toBe('2026-11-12T19:00:00.000Z');
		expect(depuisChampParis('2026-07-01T20:00')?.toISOString()).toBe('2026-07-01T18:00:00.000Z');
	});
	it('fait l’aller-retour, y compris autour des changements d’heure', () => {
		for (const v of [
			'2026-03-29T01:30',
			'2026-03-29T03:30',
			'2026-10-25T04:00',
			'2026-11-12T20:00'
		]) {
			expect(versChampParis(depuisChampParis(v)!)).toBe(v);
		}
	});
	it('refuse une saisie illisible', () => {
		expect(depuisChampParis('demain')).toBeNull();
	});
	it('ajoute des jours en passant les mois', () => {
		expect(ajouterJours('2026-11-28', 7)).toBe('2026-12-05');
	});
});

describe('heures de retrait', () => {
	it('écrit les heures à la française', () => {
		expect(formatHeure('09:00')).toBe('9 h');
		expect(formatHeure('09:30')).toBe('9 h 30');
		expect(formatHeure('18:05')).toBe('18 h 05');
		expect(formatPlage('09:00', '12:30')).toBe('9 h – 12 h 30');
	});

	it('donne le jour de la semaine', () => {
		expect(jourSemaine('2026-11-14')).toBe('samedi');
	});
});
