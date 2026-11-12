import { describe, expect, it } from 'vitest';
import { qrCodeSvg } from './qrcode.ts';

describe('qrCodeSvg', () => {
	it('produit un SVG autonome, accessible et sans contenu injecté', () => {
		const svg = qrCodeSvg('BCD\n002\n1\nSCT\n\nLa ferme d’Océane', 'QR <code> "virement"');
		expect(svg).toMatch(/^<svg [^>]*viewBox="0 0 (\d+) \1"/);
		expect(svg).toContain('role="img"');
		expect(svg).toContain('aria-label="QR &lt;code> &quot;virement&quot;"');
		expect(svg).toMatch(/<path d="(M\d+ \d+h1v1h-1z)+" fill="#1F3D2B"\/>/);
		expect(svg).not.toContain('<script');
	});

	it('donne le même QR code pour le même texte', () => {
		expect(qrCodeSvg('MAR-4F7K', 'a')).toBe(qrCodeSvg('MAR-4F7K', 'a'));
	});
});

describe('encodage', () => {
	it('encode les accents en UTF-8 (QR code plus grand qu’en Latin-1 tronqué)', () => {
		const taille = (svg: string) => Number(/viewBox="0 0 (\d+)/.exec(svg)![1]);
		// 30 caractères accentués = 60 octets en UTF-8 : il faut une version de QR code plus grande.
		expect(taille(qrCodeSvg('é'.repeat(30), 'a'))).toBeGreaterThan(
			taille(qrCodeSvg('e'.repeat(30), 'a'))
		);
	});
});
