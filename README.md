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
push sur la branche `main`. Réglages côté Cloudflare :

- Commande de build : `npm run build`
- Commande de déploiement : `npx wrangler deploy`

### Worker des tâches planifiées

`workers/taches/` est un second Worker (`maraichage-taches`) qui, toutes les
15 minutes, annule les virements non reçus à temps et envoie les e-mails de
rappel de la veille. Il partage la base D1. Pour le
déployer avec le site, la commande de déploiement Cloudflare devient :

```sh
npm run db:migrate:remote && npx wrangler deploy && npm run deploy:taches
```

Journaux : tableau de bord Cloudflare → Workers → `maraichage-taches` → Logs.

⚠️ Le système de build de Cloudflare impose le nom du Worker du site
(`WRANGLER_CI_OVERRIDE_NAME`) : `deploy:taches` retire cette variable (et
`WRANGLER_CI_MATCH_TAG`), sinon le Worker des tâches écraserait le site.

### Secrets

Paiement par virement : `VIREMENT_IBAN`, `VIREMENT_TITULAIRE` et
(facultatif) `VIREMENT_BIC`, à définir comme **secrets** du Worker `maraichage`
(tableau de bord → Settings → Variables and Secrets → Add → type Secret). Sans
eux, ou si l'IBAN est invalide, seul le paiement au retrait est proposé.

E-mails : secret `RESEND_API_KEY` à définir dans **les deux** Workers
(`maraichage` pour la confirmation, `maraichage-taches` pour le rappel de la
veille). Sans lui, la boutique fonctionne mais n'envoie aucun e-mail.

Les secrets (clé Resend, etc.) ne sont jamais commités : en local dans
`.dev.vars` (voir `.dev.vars.example`), en production dans le dashboard
Cloudflare ou via `npx wrangler secret put`.
