import { createRemoteJWKSet, jwtVerify } from 'jose';

// Le back-office est protégé par Cloudflare Access. Access ajoute à chaque
// requête autorisée un jeton signé (en-tête `Cf-Access-Jwt-Assertion`). On le
// vérifie ici, comme le recommande Cloudflare : si Access était désactivé ou
// mal réglé, /admin resterait fermé au lieu d'être public.

const cles = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function clesEquipe(equipe: string) {
	let jwks = cles.get(equipe);
	if (!jwks) {
		jwks = createRemoteJWKSet(
			new URL(`https://${equipe}.cloudflareaccess.com/cdn-cgi/access/certs`)
		);
		cles.set(equipe, jwks);
	}
	return jwks;
}

export interface ConfigAcces {
	/** Nom d'équipe Zero Trust : https://<equipe>.cloudflareaccess.com */
	equipe: string;
	/** « Application Audience (AUD) Tag » de l'application Access. */
	aud: string;
}

/** Renvoie l'e-mail de la personne autorisée, ou `null` si le jeton manque ou est invalide. */
export async function verifierAcces(
	jeton: string | null,
	config: ConfigAcces
): Promise<string | null> {
	if (!jeton || !config.equipe || !config.aud) return null;
	try {
		const { payload } = await jwtVerify(jeton, clesEquipe(config.equipe), {
			issuer: `https://${config.equipe}.cloudflareaccess.com`,
			audience: config.aud
		});
		return typeof payload.email === 'string' ? payload.email : null;
	} catch {
		return null;
	}
}
