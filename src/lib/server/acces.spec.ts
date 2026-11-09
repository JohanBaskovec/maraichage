import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWK } from 'jose';
import { beforeAll, describe, expect, it } from 'vitest';
import { estRouteAdmin, verifierAcces } from './acces';

const config = { equipe: 'ferme-test', aud: 'aud-de-test' };
const EMETTEUR = 'https://ferme-test.cloudflareaccess.com';

let cles: ReturnType<typeof createLocalJWKSet>;
let privee: CryptoKey;
let autrePrivee: CryptoKey;

beforeAll(async () => {
	const paire = await generateKeyPair('RS256');
	privee = paire.privateKey;
	autrePrivee = (await generateKeyPair('RS256')).privateKey;
	const publique: JWK = { ...(await exportJWK(paire.publicKey)), kid: 'cle-1', alg: 'RS256' };
	cles = createLocalJWKSet({ keys: [publique] });
});

function jeton(
	options: {
		email?: string | null;
		emetteur?: string;
		audience?: string;
		expiration?: string | number;
		cle?: CryptoKey;
	} = {}
) {
	const payload = options.email === null ? {} : { email: options.email ?? 'moi@example.fr' };
	return new SignJWT(payload)
		.setProtectedHeader({ alg: 'RS256', kid: 'cle-1' })
		.setIssuer(options.emetteur ?? EMETTEUR)
		.setAudience(options.audience ?? config.aud)
		.setIssuedAt()
		.setExpirationTime(options.expiration ?? '1h')
		.sign(options.cle ?? privee);
}

describe('verifierAcces', () => {
	it('accepte un jeton valide et renvoie l’e-mail', async () => {
		expect(await verifierAcces(await jeton(), config, cles)).toBe('moi@example.fr');
	});

	it('refuse l’absence de jeton ou une configuration vide', async () => {
		const valide = await jeton();
		expect(await verifierAcces(null, config, cles)).toBeNull();
		expect(await verifierAcces('', config, cles)).toBeNull();
		expect(await verifierAcces(valide, { ...config, equipe: '' }, cles)).toBeNull();
		expect(await verifierAcces(valide, { ...config, aud: '' }, cles)).toBeNull();
	});

	it('refuse un jeton signé par une autre clé', async () => {
		expect(await verifierAcces(await jeton({ cle: autrePrivee }), config, cles)).toBeNull();
	});

	it('refuse un jeton d’une autre application ou d’une autre équipe', async () => {
		expect(await verifierAcces(await jeton({ audience: 'autre-app' }), config, cles)).toBeNull();
		expect(
			await verifierAcces(
				await jeton({ emetteur: 'https://pirate.cloudflareaccess.com' }),
				config,
				cles
			)
		).toBeNull();
	});

	it('refuse un jeton expiré', async () => {
		const expire = await jeton({ expiration: Math.floor(Date.now() / 1000) - 60 });
		expect(await verifierAcces(expire, config, cles)).toBeNull();
	});

	it('refuse un jeton sans e-mail', async () => {
		expect(await verifierAcces(await jeton({ email: null }), config, cles)).toBeNull();
	});

	it('refuse un jeton modifié ou non signé', async () => {
		const valide = await jeton();
		const [entete, , signature] = valide.split('.');
		const autreContenu = Buffer.from(
			JSON.stringify({ email: 'pirate@example.fr', iss: EMETTEUR, aud: config.aud, exp: 4e9 })
		).toString('base64url');
		expect(await verifierAcces(`${entete}.${autreContenu}.${signature}`, config, cles)).toBeNull();

		const sansSignature = `${Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64url')}.${autreContenu}.`;
		expect(await verifierAcces(sansSignature, config, cles)).toBeNull();
		expect(await verifierAcces('pas-un-jeton', config, cles)).toBeNull();
	});
});

describe('estRouteAdmin', () => {
	it('reconnaît les pages du back-office par leur route', () => {
		expect(estRouteAdmin('/admin', '/admin')).toBe(true);
		expect(estRouteAdmin('/admin/ventes/[id]', '/admin/ventes/3')).toBe(true);
		// « a » encodé : même page, autre texte d'URL
		expect(estRouteAdmin('/admin/produits', '/%61dmin/produits')).toBe(true);
	});

	it('protège aussi les URL /admin qui ne correspondent à aucune page', () => {
		expect(estRouteAdmin(null, '/admin/inexistant')).toBe(true);
	});

	it('laisse passer la boutique', () => {
		expect(estRouteAdmin('/', '/')).toBe(false);
		expect(estRouteAdmin('/commande', '/commande')).toBe(false);
		expect(estRouteAdmin(null, '/administration')).toBe(false);
	});
});
