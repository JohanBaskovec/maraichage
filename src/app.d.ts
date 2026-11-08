// See https://svelte.dev/docs/kit/types#app.d.ts
import type { Db } from '#lib/server/db/index.ts';

declare global {
	namespace App {
		interface Locals {
			db: Db;
		}
		interface Platform {
			env: Env;
			ctx: ExecutionContext;
		}
	}
}

export {};
