// Chargement du widget Cloudflare Turnstile dans le navigateur (rendu explicite :
// la page de commande peut être ouverte par une navigation côté client, après le
// chargement initial, donc on ne compte pas sur le rendu automatique du script).

export interface ApiTurnstile {
	render(element: HTMLElement, options: Record<string, unknown>): string;
	reset(widget: string): void;
	remove(widget: string): void;
}

declare global {
	interface Window {
		turnstile?: ApiTurnstile;
	}
}

const SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

let chargement: Promise<ApiTurnstile> | null = null;

/** Charge le script de Cloudflare une seule fois. */
export function chargerTurnstile(): Promise<ApiTurnstile> {
	if (window.turnstile) return Promise.resolve(window.turnstile);
	chargement ??= new Promise<ApiTurnstile>((resoudre, rejeter) => {
		const script = document.createElement('script');
		script.src = SCRIPT;
		script.async = true;
		script.onload = () =>
			window.turnstile ? resoudre(window.turnstile) : rejeter(new Error('Turnstile absent'));
		script.onerror = () => {
			chargement = null;
			script.remove();
			rejeter(new Error('Script Turnstile non chargé'));
		};
		document.head.appendChild(script);
	});
	return chargement;
}
