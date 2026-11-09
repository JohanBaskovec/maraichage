import { URL_BOUTIQUE } from '../../src/lib/config.ts';
import { expirerVirements } from '../../src/lib/server/commandes.ts';
import { courrielleurResend, type Courrielleur } from '../../src/lib/server/courriels/envoi.ts';
import { getDb } from '../../src/lib/server/db/index.ts';
import { envoyerRappels } from '../../src/lib/server/rappels.ts';

export interface EnvTaches {
	DB: D1Database;
	RESEND_API_KEY?: string;
}

/** Une passe de tâches planifiées. Renvoie un résumé pour les journaux. */
export async function executerTaches(
	env: EnvTaches,
	maintenant: Date,
	courriels: Courrielleur = courrielleurResend(env.RESEND_API_KEY)
) {
	const db = getDb(env.DB);
	const virementsExpires = await expirerVirements(db, maintenant);
	const rappels = env.RESEND_API_KEY
		? await envoyerRappels(db, courriels, { maintenant, urlBase: URL_BOUTIQUE })
		: [];
	return { virementsExpires, rappels };
}

export default {
	async scheduled(controleur, env) {
		const resume = await executerTaches(env, new Date(controleur.scheduledTime));
		if (resume.virementsExpires.length > 0) {
			console.log(
				`Virements non reçus à temps, commandes annulées : ${resume.virementsExpires.join(', ')}`
			);
		}
		if (resume.rappels.length > 0) {
			console.log(`Rappels envoyés : ${resume.rappels.join(', ')}`);
		}
	}
} satisfies ExportedHandler<EnvTaches>;
