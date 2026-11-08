# Maraîchage – vente directe

Site de vente en ligne pour un maraîcher : catalogue de la semaine, commande sans
compte, retrait sur créneau, paiement au retrait ou par virement.
Conception et règles du projet : voir [`CLAUDE.md`](./CLAUDE.md).

Pile : SvelteKit 3 sur Cloudflare Workers, base Cloudflare D1, Drizzle ORM.

## Démarrer en local

```sh
npm ci
npm run db:migrate:local   # crée/met à jour la base D1 locale (.wrangler/)
npm run dev                # http://localhost:5173
```

`npm run preview` sert le build de production avec wrangler (http://localhost:4173).

## Commandes

| Commande                          | Rôle                                                        |
| --------------------------------- | ----------------------------------------------------------- |
| `npm run dev`                     | Serveur de développement                                    |
| `npm run build`                   | Build de production (génère aussi les types Cloudflare)     |
| `npm run check`                   | Vérification des types                                      |
| `npm run lint` / `npm run format` | Prettier + ESLint                                           |
| `npm test`                        | Tests unitaires (Vitest)                                    |
| `npm run db:generate`             | Génère une migration SQL dans `drizzle/` à partir du schéma |
| `npm run db:migrate:local`        | Applique les migrations à la base locale                    |
| `npm run db:migrate:remote`       | Applique les migrations à la base de production             |
| `npm run deploy`                  | Build et déploiement manuel avec wrangler                   |

## Déploiement

Le déploiement se fait automatiquement par Cloudflare (Workers Builds) à chaque
push sur la branche de production. Réglages côté Cloudflare :

- Commande de build : `npm run build`
- Commande de déploiement : `npx wrangler deploy`

Avant le premier déploiement, remplacer `database_id` dans `wrangler.jsonc` par
l'identifiant de la base D1 créée dans le dashboard.

Les secrets (clé Resend, etc.) ne sont jamais commités : en local dans
`.dev.vars` (voir `.dev.vars.example`), en production dans le dashboard
Cloudflare ou via `npx wrangler secret put`.
