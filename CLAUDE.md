# Maraîchage – site de vente en ligne

Site de vente directe pour un maraîcher. Chaque semaine, le maraîcher saisit sa
récolte (produits, quantités, prix). Les clients choisissent librement produits
et quantités, sans compte ni panier imposé, réservent un créneau de retrait et
paient au retrait ou par virement.

Coût cible : le nom de domaine seul (environ 10 €/an). Tout le reste doit tenir
dans les offres gratuites.

Document de conception complet (source de vérité) :
https://claude.ai/artifact/6anJ2ptSqbBRx8bpBUMWvz

Langue : interface, contenus et messages de commit en français. Noms de tables
et de colonnes en français, sans accents (`commandes`, `qte_reservee`).

## Périmètre du MVP

Dans le MVP :

- Saisie hebdomadaire des produits et quantités (« 200 concombres à 0,80 € pièce »,
  « 80 kg de pommes de terre à 2,50 €/kg »).
- Catalogue public avec le stock restant, panier, commande sans compte.
- Choix d'un créneau de retrait.
- Paiement au retrait ou par virement, sans frais.
- Back-office : liste des commandes, statut payé / récupéré, récap de préparation.

Hors MVP (ne pas implémenter sans demande explicite) : paiement par carte,
comptes clients, livraison, abonnements aux paniers.

## Pile technique

| Poste             | Outil                                                      |
| ----------------- | ---------------------------------------------------------- |
| Framework         | SvelteKit + `@sveltejs/adapter-cloudflare`                 |
| Hébergement       | Cloudflare Pages / Workers                                 |
| Base de données   | Cloudflare D1 (SQLite) + Drizzle ORM                       |
| Accès admin       | Cloudflare Access (aucun code d'authentification à écrire) |
| E-mails           | Resend                                                     |
| Anti-abus         | Cloudflare Turnstile                                       |
| Tâches planifiées | Worker séparé avec Cron Trigger, même base D1              |

Garder la pile minimale : pas de framework CSS lourd, pas de bibliothèque
d'état, pas de comptes clients, aucun traceur (pas d'analytics, pas de pub,
donc pas de bandeau cookies).

Le back-office vit sous `/admin` ; ce chemin est protégé par Cloudflare Access.
Le code ne gère ni comptes ni mots de passe : `src/hooks.server.ts` vérifie
seulement le jeton signé qu'Access ajoute (`Cf-Access-Jwt-Assertion`), avec les
variables `ACCESS_EQUIPE` et `ACCESS_AUD` de `wrangler.jsonc`. Sans elles ou sans
jeton valide, `/admin` répond 403 en production (fermé par défaut). En
développement (`npm run dev`), `/admin` est ouvert.

## Modèle de données

Six tables. Les prix sont toujours des entiers en **centimes**. Les quantités
sont des entiers dans l'**unité de base** : pièces, bottes, ou **grammes** pour
les produits au kg.

| Table             | Rôle                                    | Champs principaux                                                                                                                             |
| ----------------- | --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `produits`        | Catalogue permanent                     | id, nom, unite (`piece`, `botte`, `kg`), pas (ex. 1 pièce, 500 g), photo, actif                                                               |
| `ventes`          | Session de vente (souvent hebdomadaire) | id, ouverture, cloture (fin des commandes), statut                                                                                            |
| `offres`          | Ce qui est disponible pour une vente    | vente_id, produit_id, prix_centimes (par pièce/botte ou par kg), qte_initiale, qte_reservee                                                   |
| `creneaux`        | Retraits possibles                      | vente_id, date, heure_debut, heure_fin, lieu, capacite                                                                                        |
| `commandes`       | Une commande client                     | id, reference (ex. `MAR-4F7K`), vente_id, creneau_id, nom, email, telephone, mode_paiement, statut, total_centimes, cree_le, jeton_annulation |
| `lignes_commande` | Détail                                  | commande_id, offre_id, quantite, prix_unitaire_centimes                                                                                       |

Colonnes ajoutées au schéma réel (`src/lib/server/db/schema.ts`) :
`commandes.payee` (le paiement est suivi à part du statut : une commande au
retrait est `confirmee` puis payée sur place) et `creneaux.nb_commandes`
(compteur tenu à jour pour faire respecter `capacite`, null = sans limite).
Statuts d'une vente : `brouillon`, `publiee`, `archivee` ; une vente prend des
commandes si elle est `publiee` et que `ouverture <= maintenant < cloture`.

Règles :

- Le prix est **recopié** dans `lignes_commande` : un changement de prix ne
  modifie jamais une commande passée.
- Prix d'une ligne au poids = `prix_centimes × grammes ÷ 1000`, arrondi au
  centime. Le client ajoute par pas de 500 g (ou le `pas` du produit).
- Au kg, le maraîcher sert au plus près du poids commandé et le prix reste
  celui de la commande (tolérance précisée dans les CGV).
- Référence de commande courte, sans caractères ambigus (pas de 0/O, 1/I).

Statuts d'une commande :

```
en_attente_paiement → confirmee → prete → recuperee
                    ↘ annulee
confirmee / prete   → non_recuperee   (posé par le maraîcher après le créneau)
```

Après **deux** commandes `non_recuperee`, le même e-mail ou téléphone ne peut
plus commander ; le maraîcher peut débloquer depuis le back-office
(`/admin/clients`). Débloquer passe `commandes.absence_excusee` à vrai : les
commandes restent `non_recuperee` dans l'historique mais ne comptent plus
(`estBloque`, `debloquerClient`).

Réglages dans `src/lib/config.ts` : `MAX_PAS_PAR_PRODUIT` (20 pas par produit et
par commande, appliqué côté serveur et dans le panier), `ABSENCES_AVANT_BLOCAGE`
(2), `ANNULATION_HEURES_AVANT_RETRAIT` (12 h).

Annulation par le client : lien `/annuler/[jeton]` (jeton secret
`jeton_annulation`), proposé sur la page de confirmation et plus tard dans les
e-mails. Ouvrir la page n'annule rien (les messageries ouvrent les liens pour
les vérifier) : il faut cliquer sur le bouton (POST). Possible tant que la
commande est à retirer, jusqu'à 12 h avant le début du créneau (`annulerParClient`).

## Stock sans survente (critique)

La réservation ne fait jamais « lire puis écrire ». Elle repose sur une
contrainte de la base :

```sql
CONSTRAINT "offres_stock_suffisant"
  CHECK (qte_reservee >= 0 AND qte_reservee <= qte_initiale)
```

- Une commande = un seul `db.batch()` D1 (une transaction) : insertion de la
  commande, `qte_reservee = qte_reservee + quantite` pour chaque ligne,
  insertion des lignes, `creneaux.nb_commandes + 1`.
- S'il n'y a plus assez de stock, l'incrément viole la contrainte, D1 annule
  tout le lot : tout le panier passe ou rien ne passe. (Un `UPDATE … WHERE
stock suffisant` qui modifie 0 rangée n'échouerait pas et laisserait passer
  un panier partiel : ne pas l'utiliser seul.)
- Sur cet échec, on relit le stock et on affiche « il ne reste que 3
  concombres ». Même principe pour la capacité du créneau
  (`creneaux_capacite_respectee`).
- Une commande annulée ou expirée rend son stock et sa place de créneau, dans
  un lot dont chaque écriture est conditionnée au statut encore actif
  (idempotent). Voir `src/lib/server/commandes.ts`.
- La clôture de la vente est vérifiée **côté serveur**, jamais seulement dans
  l'interface.
- Limite par produit et par commande (par exemple 20) et Turnstile sur le
  formulaire, pour qu'une fausse commande ne bloque pas tout le stock.
- Un test automatisé lance 50 commandes simultanées sur un stock de 10 et
  vérifie qu'exactement 10 unités partent. Ce test existe **avant** la page de
  commande.
- Ajustement manuel du stock : si la nouvelle quantité passe sous
  `qte_reservee`, l'interface le signale et liste les commandes à réduire ou
  annuler.

## Paiement sans frais

- **Au retrait** (espèces, chèque) : commande `confirmee` immédiatement ; le
  maraîcher clique « payée » sur place.
- **Virement** : commande `en_attente_paiement`. La confirmation affiche l'IBAN
  et la référence à mettre en libellé. Le maraîcher valide à réception.
- **Expiration** : un Worker séparé (Cron Trigger) annule les virements non
  reçus après un délai (par exemple 24 h, ou la veille du retrait si c'est plus
  tôt) et libère le stock.
- Réalisé : `commandes.paiement_avant` = min(commande + 24 h, début du retrait −
  24 h) (`limitePaiementVirement`) ; virement refusé s'il reste moins de 2 h pour
  payer. Worker `workers/taches/` (cron toutes les 15 min, `expirerVirements`) :
  n'annule que le statut `en_attente_paiement` (`annulerCommande(db, id,
['en_attente_paiement'])`), jamais une commande validée entre-temps. Bouton
  « Paiement reçu » (`confirmerPaiement`) : `confirmee` + payée.
- Coordonnées bancaires : secrets `VIREMENT_IBAN`, `VIREMENT_TITULAIRE`,
  `VIREMENT_BIC` (déclarés dans `src/secrets.d.ts`), lus par le hook dans
  `event.locals.virement` (`null` si absents ou IBAN invalide → virement non
  proposé). En local : `.dev.vars` (voir `.dev.vars.example`).
- Option : QR code de virement au format EPC, toujours avec l'IBAN en clair à
  côté.

## Parcours

Client (trois écrans, sans compte) :

1. Catalogue de la semaine : produits, prix, « reste 143 », boutons + / −. Le
   panier vit dans le navigateur.
2. Validation : nom, e-mail, téléphone, créneau, mode de paiement, case
   d'acceptation des CGV, bouton qui dit clairement qu'il engage la commande.
3. Confirmation : référence, récapitulatif, IBAN et référence si virement. Le
   même contenu part par e-mail.

E-mail de rappel la veille avec un lien d'annulation en un clic
(`jeton_annulation`) ; le stock est remis en vente.

E-mails (réalisé) : `src/lib/server/courriels/` — `envoi.ts` (API Resend,
secret `RESEND_API_KEY` dans les deux Workers ; sans clé rien n'est envoyé, un
échec d'envoi ne lève jamais d'erreur et n'annule jamais une commande) et
`modeles.ts` (confirmation, rappel ; HTML à styles en ligne + texte brut ; tout
contenu saisi passe par `echapper`). La confirmation part depuis l'action de
`/commande` via `event.locals.courriels` (hook) ; le rappel part du Worker des
tâches (`envoyerRappels`, `src/lib/server/rappels.ts`) : à partir de 24 h avant
le retrait, sauf commande passée depuis moins de 6 h, une seule fois
(`commandes.rappel_envoye_le` réservé avant l'envoi, libéré si l'envoi échoue).
Expéditeur, adresse de réponse et `URL_BOUTIQUE` (liens des rappels) dans
`src/lib/config.ts` (adresses provisoires). Tests : `courrielsDeTest()`.

Back-office (`/admin`, utilisable depuis un téléphone) :

- Nouvelle vente : dupliquer la semaine précédente, ajuster quantités et prix,
  fixer la clôture et les créneaux. Cible : moins de 5 minutes.
- Commandes : liste filtrable par créneau et statut, boutons « payée » et
  « récupérée », marquage « non récupérée ».
- Récap de préparation : totaux par produit, puis une fiche par client.
  Imprimable.
- Ajustement manuel du stock.

## Obligations légales

Pages à prévoir : mentions légales (identité, SIRET, adresse, hébergeur), CGV
(prix TTC, commande, paiement, retrait, commandes non récupérées, exclusion du
droit de rétractation pour les denrées périssables, tolérance de poids),
confidentialité RGPD (données collectées, usage, durée, suppression).

Réalisé : `/mentions-legales`, `/cgv`, `/confidentialite` (composant
`src/lib/composants/PageLegale.svelte`), liées dans le pied de page de la
boutique. Les informations d'identification viennent de `INFOS_LEGALES` dans
`src/lib/config.ts` et les délais des constantes de config (jamais écrits en
dur dans les textes). ⚠️ Données **fictives** tant que `INFOS_LEGALES.provisoire`
vaut `true` (SIRET, adresse, exploitant, téléphone, médiateur) : un bandeau le
signale. Textes à faire relire (chambre d'agriculture, conseiller).

## Plan de développement

- **Phase 0 – Mise en place** : compte Cloudflare, domaine, dépôt Git, projet
  SvelteKit + adaptateur Cloudflare, D1, Drizzle, ce fichier, déploiement
  automatique à chaque push.
- **Phase 1 – MVP vendable** : schéma et migrations, back-office protégé,
  création de vente (offres, créneaux, duplication), catalogue + panier +
  validation + réservation atomique, paiement au retrait uniquement, liste des
  commandes et récap, test de concurrence.
- **Phase 2 – Prêt à ouvrir** : e-mail de confirmation, virement (IBAN,
  référence, expiration), pages légales, rappel la veille avec annulation,
  statut non récupérée et blocage, anti-abus, test complet sur téléphone.
- **Phase 3 – Confort** : photos (R2), export CSV, e-mail « commande prête »,
  paiement par carte seulement si nécessaire.

## Façon de travailler

- Avancer une étape à la fois.
- Schéma et tests d'abord, écrans ensuite.
- Toute requête SQL qui touche au stock ou aux statuts doit être relue avec
  soin et couverte par un test.
- Ne jamais committer de secret (clé Resend, IBAN réel, jetons Cloudflare) :
  utiliser les variables d'environnement / secrets Cloudflare.

## Conventions du code

- SvelteKit 3 : l'alias est `#lib` (plus `$lib`), avec l'extension explicite
  (`import { getDb } from '#lib/server/db/index.ts'`). Le type `Handle` vient de
  `@sveltejs/kit/hooks`.
- Les bindings et variables Cloudflare se lisent avec
  `import { env } from 'cloudflare:workers'` (adaptateur v8 ; pas
  `event.platform`). La base est accessible dans le serveur via
  `event.locals.db` (Drizzle, posé dans `src/hooks.server.ts`).
- Schéma dans `src/lib/server/db/schema.ts` ; migrations générées par
  `npm run db:generate` dans `drizzle/`, appliquées par wrangler
  (`npm run db:migrate:local` / `db:migrate:remote`).
- `worker-configuration.d.ts` est généré par `wrangler types` (non commité) ;
  le relancer après toute modification de `wrangler.jsonc`.
- Avant de committer : `npm run lint`, `npm run check`, `npm test`, et
  `npm run test:e2e` si une page change.
- npm 10.9 plante sur `npm install` (bug arborist) : utiliser `npm ci`, ou
  `npx npm@11 install` pour ajouter une dépendance.
- Opérations du back-office dans `src/lib/server/admin.ts` (testées) ; les
  pages `src/routes/admin/**` ne font que lire les formulaires et appeler ces
  fonctions. Saisie des montants/quantités : `src/lib/format.ts` ; heure de
  Paris ↔ UTC : `src/lib/heure.ts`.
- Suivi des commandes (`src/lib/server/admin-commandes.ts`, pages
  `/admin/ventes/[id]/commandes` et `/preparation`) : chaque écriture filtre
  sur la vente de la page et sur le statut de départ (transitions dans
  `TRANSITIONS`) ; une commande annulée ne revient jamais. Le tri et la
  recherche par nom se font en JavaScript (SQLite ignore les accents
  majuscules et trie octet par octet). D1 limite le nombre de paramètres :
  pas de `IN (…)` sur une liste longue.
- Boutique : `src/routes/+page.svelte` (catalogue), `src/routes/commande`
  (validation) et `src/routes/commande/[id]` (confirmation, l'UUID de la
  commande sert de clé d'accès). Lectures dans `src/lib/server/boutique.ts`.
  Le panier vit dans le `localStorage` (`src/lib/stockage.ts`, toujours dans un
  try/catch) et voyage vers la validation dans l'URL (`?o12=3&o14=1500`,
  `src/lib/panier.ts`). Le serveur ne fait jamais confiance au panier : tout est
  revalidé par `passerCommande`. Les clients sont vouvoyés.
- Nom affiché de la boutique : `NOM_BOUTIQUE` dans `src/lib/config.ts`.
- Tests de base de données : `baseDeTest()` (`src/lib/server/test/d1.ts`) donne
  une D1 locale en mémoire (Miniflare) avec les migrations appliquées.

## Tests

- **Unitaires** (`src/lib/*.spec.ts`) : fonctions pures (prix, formats, heure,
  panier, stockage navigateur).
- **Intégration sur D1 locale** (`src/lib/server/*.spec.ts`) : commandes et
  concurrence, back-office, boutique, vérification du jeton Access.
- **Pages serveur** (`src/routes/**/page.server.spec.ts`) : `load` et actions
  appelés avec `evenement()` (`src/lib/server/test/evenement.ts`). Déclarer
  `load` et `actions` avec `satisfies PageServerLoad` / `satisfies Actions`.
- **Bout en bout** (`e2e/`, Playwright, `npm run test:e2e`) : boutique et
  sécurité sur le build de production servi par wrangler (base pré-remplie par
  `e2e/donnees-boutique.sql`) ; back-office sur `vite dev` (seul endroit où
  `/admin` s'ouvre sans Access). Chaque page testée passe aussi un contrôle
  d'accessibilité (axe, WCAG AA) et de largeur sur téléphone. Dans les tests
  du back-office, attendre la fin d'un envoi avec `envoyer()`, pas avec
  `networkidle`.
- **GitHub Actions** (`.github/workflows/verifications.yml`) : lint, types,
  tests, synchronisation schéma ↔ migrations, bout en bout, à chaque push.
- Sécurité : le contrôle d'accès au back-office se fait sur la route choisie
  par SvelteKit (`estRouteAdmin`), jamais sur le texte de l'URL (`/%61dmin`).
  Toutes les réponses portent les en-têtes de `src/hooks.server.ts`.
