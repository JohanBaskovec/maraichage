import { expirerVirements } from '../../src/lib/server/commandes.ts';
import { getDb } from '../../src/lib/server/db/index.ts';

export interface EnvTaches {
	DB: D1Database;
}

/** Une passe de tâches planifiées. Renvoie un résumé pour les journaux. */
export async function executerTaches(env: EnvTaches, maintenant: Date) {
	const virementsExpires = await expirerVirements(getDb(env.DB), maintenant);
	return { virementsExpires };
}

export default {
	async scheduled(controleur, env) {
		const resume = await executerTaches(env, new Date(controleur.scheduledTime));
		if (resume.virementsExpires.length > 0) {
			console.log(
				`Virements non reçus à temps, commandes annulées : ${resume.virementsExpires.join(', ')}`
			);
		}
	}
} satisfies ExportedHandler<EnvTaches>;
