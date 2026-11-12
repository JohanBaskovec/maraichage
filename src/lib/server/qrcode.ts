import qrcode from 'qrcode-generator';

/**
 * QR code en SVG (modules vert forêt sur fond blanc, marge de 4 modules).
 * Le texte est encodé en UTF-8. Correction d'erreur M, comme le demande l'EPC.
 */
export function qrCodeSvg(texte: string, titre: string): string {
	const anciens = qrcode.stringToBytes;
	qrcode.stringToBytes = (t: string) => Array.from(new TextEncoder().encode(t));
	try {
		const qr = qrcode(0, 'M');
		qr.addData(texte, 'Byte');
		qr.make();
		const n = qr.getModuleCount();
		const marge = 4;
		const taille = n + 2 * marge;
		let chemin = '';
		for (let y = 0; y < n; y++) {
			for (let x = 0; x < n; x++) {
				if (qr.isDark(y, x)) chemin += `M${x + marge} ${y + marge}h1v1h-1z`;
			}
		}
		const echappe = titre.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
		return (
			`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${taille} ${taille}" role="img" aria-label="${echappe}" shape-rendering="crispEdges">` +
			`<rect width="${taille}" height="${taille}" fill="#fff"/>` +
			`<path d="${chemin}" fill="#1F3D2B"/></svg>`
		);
	} finally {
		qrcode.stringToBytes = anciens;
	}
}
