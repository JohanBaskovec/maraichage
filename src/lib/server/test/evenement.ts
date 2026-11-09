import type { CoordonneesVirement } from '#lib/virement.ts';
import type { Courriel, Courrielleur } from '../courriels/envoi.ts';
import type { Db } from '../db/index.ts';
import type { Turnstile } from '../turnstile.ts';

/**
 * Faux événement SvelteKit pour appeler un `load` ou une action de formulaire
 * dans un test, avec la base de test.
 */
export function evenement(
	db: Db,
	options: {
		url?: string;
		params?: Record<string, string>;
		form?: Record<string, string>;
		virement?: CoordonneesVirement | null;
		courriels?: Courrielleur;
		turnstile?: Turnstile | null;
		headers?: Record<string, string>;
	} = {}
) {
	const url = new URL(options.url ?? 'http://localhost/');
	const corps = new FormData();
	for (const [cle, valeur] of Object.entries(options.form ?? {})) corps.append(cle, valeur);
	return {
		locals: {
			db,
			virement: options.virement ?? null,
			courriels: options.courriels ?? { envoyer: async () => true },
			turnstile: options.turnstile ?? null
		},
		url,
		params: options.params ?? {},
		request: new Request(url, { method: 'POST', body: corps, headers: options.headers }),
		getClientAddress: () => '127.0.0.1',
		setHeaders: () => {}
		// eslint-disable-next-line @typescript-eslint/no-explicit-any -- seuls ces champs sont utilisés
	} as any;
}

/** Exécute une action et renvoie soit la redirection, soit le résultat. */
export async function executer<T>(
	action: () => T | Promise<T>
): Promise<{ redirection: string } | { resultat: Awaited<T> }> {
	try {
		return { resultat: await action() };
	} catch (e) {
		const r = e as { status?: number; location?: string };
		if (r && typeof r.location === 'string' && r.status && r.status >= 300 && r.status < 400) {
			return { redirection: r.location };
		}
		throw e;
	}
}

/** Faux envoyeur d'e-mails qui garde les messages pour les vérifier. */
export function courrielsDeTest(reussite = true) {
	const envoyes: Courriel[] = [];
	return {
		envoyes,
		courriels: {
			async envoyer(c: Courriel) {
				envoyes.push(c);
				return reussite;
			}
		} satisfies Courrielleur
	};
}
