import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';

// Le back-office est protégé par Cloudflare Access. Access ajoute à chaque
// requête autorisée un jeton signé (en-tête `Cf-Access-Jwt-Assertion`). On le
// vérifie ici, comme le recommande Cloudflare : si Access était désactivé ou
// mal réglé, /admin resterait fermé au lieu d'être public.

export interface ConfigAcces {
	/** Nom d'équipe Zero Trust : https://<equipe>.cloudflareaccess.com */
	equipe: string;
	/** « Application Audience (AUD) Tag » de l'application Access. */
	aud: string;
}

/**
 * Une page relève du back-office si la route choisie par SvelteKit est sous
 * /admin. On regarde la route et non le texte de l'URL : `/%61dmin` (« a »
 * encodé) mène à la même page que `/admin` mais ne commence pas par « /admin ».
 */
export function estRouteAdmin(routeId: string | null, chemin: string): boolean {
	const sousAdmin = (p: string) => p === '/admin' || p.startsWith('/admin/');
	return (routeId !== null && sousAdmin(routeId)) || sousAdmin(chemin);
}

const clesParEquipe = new Map<string, JWTVerifyGetKey>();

function clesDistantes(equipe: string): JWTVerifyGetKey {
	let cles = clesParEquipe.get(equipe);
	if (!cles) {
		cles = createRemoteJWKSet(
			new URL(`https://${equipe}.cloudflareaccess.com/cdn-cgi/access/certs`)
		);
		clesParEquipe.set(equipe, cles);
	}
	return cles;
}

/**
 * Renvoie l'e-mail de la personne autorisée, ou `null` si le jeton manque ou est
 * invalide (signature, émetteur, audience, expiration). `cles` sert aux tests ;
 * par défaut, les clés publiques de l'équipe Access sont téléchargées.
 */
export async function verifierAcces(
	jeton: string | null | undefined,
	config: ConfigAcces,
	cles?: JWTVerifyGetKey
): Promise<string | null> {
	if (!jeton || !config.equipe || !config.aud) return null;
	try {
		const { payload } = await jwtVerify(jeton, cles ?? clesDistantes(config.equipe), {
			issuer: `https://${config.equipe}.cloudflareaccess.com`,
			audience: config.aud,
			algorithms: ['RS256']
		});
		return typeof payload.email === 'string' && payload.email ? payload.email : null;
	} catch {
		return null;
	}
}
