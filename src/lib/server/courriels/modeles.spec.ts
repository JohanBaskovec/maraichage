import { describe, expect, it } from 'vitest';
import { courrielConfirmation, courrielRappel, echapper, type CommandeCourriel } from './modeles';

const base: CommandeCourriel = {
	id: '11111111-2222-4333-8444-555555555555',
	reference: 'MAR-4F7K',
	nom: 'Camille Martin',
	email: 'camille@example.fr',
	modePaiement: 'retrait',
	statut: 'confirmee',
	payee: false,
	totalCentimes: 615,
	paiementAvant: null,
	jetonAnnulation: 'jeton-secret',
	limiteAnnulation: new Date('2026-11-13T20:00:00Z'),
	creneau: { date: '2026-11-14', heureDebut: '09:00', heureFin: '12:00', lieu: 'À la ferme' },
	lignes: [
		{ produit: 'Concombre', unite: 'piece', quantite: 3, prixUnitaireCentimes: 80 },
		{ produit: 'Pommes de terre', unite: 'kg', quantite: 1500, prixUnitaireCentimes: 250 }
	]
};
const URL = 'https://ferme.example';
const AVANT = new Date('2026-11-10T10:00:00Z');
const VIREMENT = { iban: 'FR76 3000 6000 0112 3456 7890 189', bic: 'AGRIFRPP', titulaire: 'Ferme' };

describe('courrielConfirmation', () => {
	it('récapitule la commande au retrait, avec les liens', () => {
		const c = courrielConfirmation(base, { urlBase: URL, virement: VIREMENT, maintenant: AVANT });
		expect(c.a).toBe('camille@example.fr');
		expect(c.sujet).toBe('Commande MAR-4F7K – La ferme d’Océane');
		expect(c.cleIdempotence).toBe(`confirmation-${base.id}`);
		for (const contenu of [c.html, c.texte]) {
			expect(contenu).toContain('Bonjour Camille');
			expect(contenu).toContain('MAR-4F7K');
			expect(contenu).toContain('samedi 14 novembre, entre 09:00 et 12:00');
			expect(contenu).toContain('1,5 kg');
			expect(contenu.replace(/\s/g, ' ')).toContain('6,15 €');
			expect(contenu).toContain(`${URL}/commande/${base.id}`);
			expect(contenu).toContain(`${URL}/annuler/jeton-secret`);
			expect(contenu).toContain('Paiement au retrait');
			// Pas de coordonnées bancaires pour un paiement au retrait.
			expect(contenu).not.toContain('FR76');
		}
	});

	it('donne les coordonnées bancaires pour un virement attendu', () => {
		const c = courrielConfirmation(
			{
				...base,
				modePaiement: 'virement',
				statut: 'en_attente_paiement',
				paiementAvant: new Date('2026-11-11T10:00:00Z')
			},
			{ urlBase: URL, virement: VIREMENT, maintenant: AVANT }
		);
		expect(c.sujet).toContain('virement à effectuer');
		for (const contenu of [c.html, c.texte]) {
			expect(contenu).toContain('FR76 3000 6000 0112 3456 7890 189');
			expect(contenu).toContain('AGRIFRPP');
			expect(contenu).toContain('mercredi 11 novembre à 11:00');
			expect(contenu).toMatch(/Libellé/);
		}
	});

	it('ne propose plus l’annulation une fois le délai passé', () => {
		const c = courrielConfirmation(base, {
			urlBase: URL,
			virement: null,
			maintenant: new Date('2026-11-13T21:00:00Z')
		});
		expect(c.html).not.toContain('/annuler/');
		expect(c.texte).not.toContain('/annuler/');
	});

	it('échappe tout ce qui vient d’une saisie', () => {
		const c = courrielConfirmation(
			{
				...base,
				nom: '<script>alert(1)</script> Pirate',
				lignes: [
					{ produit: 'Radis & <b>gras</b>', unite: 'botte', quantite: 1, prixUnitaireCentimes: 150 }
				],
				creneau: { ...base.creneau, lieu: '"><img src=x onerror=alert(1)>' }
			},
			{ urlBase: URL, virement: null, maintenant: AVANT }
		);
		expect(c.html).not.toContain('<script>');
		expect(c.html).not.toContain('<img');
		expect(c.html).not.toContain('<b>gras');
		expect(c.html).toContain('&lt;script&gt;');
		expect(c.html).toContain('Radis &amp; &lt;b&gt;gras&lt;/b&gt;');
	});
});

describe('courrielRappel', () => {
	it('rappelle le retrait, le montant à régler et propose de libérer la commande', () => {
		const c = courrielRappel(base, { urlBase: URL, maintenant: new Date('2026-11-13T09:00:00Z') });
		expect(c.sujet).toBe('Rappel : retrait de votre commande MAR-4F7K samedi 14 novembre');
		expect(c.cleIdempotence).toBe(`rappel-${base.id}`);
		for (const contenu of [c.html, c.texte]) {
			expect(contenu).toContain('À régler au retrait');
			expect(contenu).toContain(`${URL}/annuler/jeton-secret`);
		}
	});

	it('dit qu’une commande payée l’est, et ne propose plus l’annulation trop tard', () => {
		const c = courrielRappel(
			{ ...base, payee: true },
			{ urlBase: URL, maintenant: new Date('2026-11-13T21:00:00Z') }
		);
		expect(c.texte).toContain('déjà payée');
		expect(c.texte).not.toContain('/annuler/');
		expect(c.texte).toContain('Répondez à cet e-mail');
	});
});

describe('echapper', () => {
	it('échappe les caractères HTML', () => {
		expect(echapper(`<a href="x">l'été & co</a>`)).toBe(
			'&lt;a href=&quot;x&quot;&gt;l&#39;été &amp; co&lt;/a&gt;'
		);
	});
});
