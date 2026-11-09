// See https://svelte.dev/docs/kit/types#app.d.ts
import type { Courrielleur } from '#lib/server/courriels/envoi.ts';
import type { Db } from '#lib/server/db/index.ts';
import type { CoordonneesVirement } from '#lib/virement.ts';

declare global {
	namespace App {
		interface Locals {
			db: Db;
			/** Coordonnées bancaires ; `null` si le virement n'est pas configuré. */
			virement: CoordonneesVirement | null;
			/** Envoi des e-mails aux clients (Resend). */
			courriels: Courrielleur;
			/** E-mail de la personne connectée au back-office (Cloudflare Access). */
			admin?: string;
		}
	}
}

export {};
