import { afterEach, describe, expect, it, vi } from 'vitest';
import { contenuEpc, formaterIban, ibanValide, lireCoordonneesVirement } from './virement';

// IBAN d'exemple publiés (fictifs mais valides).
const IBAN_FR = 'FR7630006000011234567890189';
const IBAN_DE = 'DE89370400440532013000';

describe('ibanValide', () => {
	it('accepte des IBAN valides, avec ou sans espaces', () => {
		expect(ibanValide(IBAN_FR)).toBe(true);
		expect(ibanValide('fr76 3000 6000 0112 3456 7890 189')).toBe(true);
		expect(ibanValide(IBAN_DE)).toBe(true);
	});
	it('refuse une faute de frappe ou un format impossible', () => {
		expect(ibanValide('FR7630006000011234567890188')).toBe(false);
		expect(ibanValide('FR7630006000011234567809189')).toBe(false);
		expect(ibanValide('')).toBe(false);
		expect(ibanValide('pas un iban')).toBe(false);
	});
});

describe('formaterIban', () => {
	it('groupe par 4 en majuscules', () => {
		expect(formaterIban('fr7630006000011234567890189')).toBe('FR76 3000 6000 0112 3456 7890 189');
	});
});

describe('lireCoordonneesVirement', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('lit les secrets', () => {
		expect(
			lireCoordonneesVirement({
				VIREMENT_IBAN: IBAN_FR,
				VIREMENT_BIC: ' AGRIFRPP ',
				VIREMENT_TITULAIRE: ' Ferme des Tests '
			})
		).toEqual({
			iban: 'FR76 3000 6000 0112 3456 7890 189',
			bic: 'AGRIFRPP',
			titulaire: 'Ferme des Tests'
		});
	});

	it('désactive le virement si un secret manque ou si l’IBAN est faux', () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		expect(lireCoordonneesVirement({})).toBeNull();
		expect(lireCoordonneesVirement({ VIREMENT_IBAN: IBAN_FR })).toBeNull();
		expect(
			lireCoordonneesVirement({
				VIREMENT_IBAN: 'FR7630006000011234567890188',
				VIREMENT_TITULAIRE: 'X'
			})
		).toBeNull();
		expect(console.error).toHaveBeenCalledOnce();
	});
});

describe('contenuEpc', () => {
	it('suit le format EPC 002 (bénéficiaire, IBAN compact, montant, libellé)', () => {
		expect(
			contenuEpc({
				titulaire: 'La ferme d’Océane',
				iban: 'FR76 3000 6000 0112 3456 7890 189',
				bic: 'agrifrpp',
				montantCentimes: 1125,
				libelle: 'MAR-4F7K'
			}).split('\n')
		).toEqual([
			'BCD',
			'002',
			'1',
			'SCT',
			'AGRIFRPP',
			'La ferme d’Océane',
			'FR7630006000011234567890189',
			'EUR11.25',
			'',
			'',
			'MAR-4F7K'
		]);
	});

	it('laisse le BIC vide s’il est inconnu et tronque le nom à 70 caractères', () => {
		const lignes = contenuEpc({
			titulaire: 'x'.repeat(80),
			iban: 'FR7630006000011234567890189',
			bic: null,
			montantCentimes: 80,
			libelle: 'MAR-AAAA'
		}).split('\n');
		expect(lignes[4]).toBe('');
		expect(lignes[5]).toHaveLength(70);
		expect(lignes[7]).toBe('EUR0.80');
	});
});
