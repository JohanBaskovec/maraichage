import type { Db } from '../db/index.ts';

/**
 * Faux événement SvelteKit pour appeler un `load` ou une action de formulaire
 * dans un test, avec la base de test.
 */
export function evenement(
	db: Db,
	options: { url?: string; params?: Record<string, string>; form?: Record<string, string> } = {}
) {
	const url = new URL(options.url ?? 'http://localhost/');
	const corps = new FormData();
	for (const [cle, valeur] of Object.entries(options.form ?? {})) corps.append(cle, valeur);
	return {
		locals: { db },
		url,
		params: options.params ?? {},
		request: new Request(url, { method: 'POST', body: corps }),
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
