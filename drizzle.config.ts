import { defineConfig } from 'drizzle-kit';

// Drizzle sert uniquement à générer les migrations SQL (`npm run db:generate`).
// Elles sont appliquées par wrangler : `npm run db:migrate:local` / `db:migrate:remote`.
export default defineConfig({
	schema: './src/lib/server/db/schema.ts',
	out: './drizzle',
	dialect: 'sqlite',
	verbose: true,
	strict: true
});
