<script lang="ts">
	import { applyAction, enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import EnTeteBoutique from '#lib/composants/EnTeteBoutique.svelte';
	import { NOM_BOUTIQUE } from '#lib/config.ts';
	import { formatEuros, formatQuantite } from '#lib/format.ts';
	import { formatDateHeure, formatJour, formatPlage } from '#lib/heure.ts';
	import { urlIllustration } from '#lib/illustrations.ts';
	import { chargerCoordonnees, enregistrerCoordonnees, enregistrerPanier } from '#lib/stockage.ts';
	import { chargerTurnstile, type ApiTurnstile } from '#lib/turnstile.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const lignes = $derived(data.recap?.lignes ?? []);
	const aCommander = $derived(lignes.filter((l) => l.quantite > 0));
	const ajustees = $derived(lignes.filter((l) => l.reduite));
	const creneauxLibres = $derived(data.vente?.creneaux.filter((c) => !c.complet) ?? []);

	let nom = $state('');
	let email = $state('');
	let telephone = $state('');
	let envoi = $state(false);
	let mode = $state<'retrait' | 'virement'>('retrait');
	$effect(() => {
		if (form?.mode) mode = form.mode;
	});

	// Créneau choisi : celui renvoyé après une erreur, ou le seul encore libre.
	let creneau = $state<number | null>(null);
	$effect(() => {
		const libres = creneauxLibres;
		if (form?.creneau && libres.some((c) => c.id === form.creneau)) creneau = form.creneau;
		else if (libres.length === 1) creneau = libres[0].id;
		else if (!libres.some((c) => c.id === creneau)) creneau = null;
	});
	const creneauChoisi = $derived(data.vente?.creneaux.find((c) => c.id === creneau));
	const statutCreneau = (c: { complet: boolean; places: number | null }) =>
		c.complet
			? 'Complet'
			: c.places !== null && c.places <= 3
				? `Plus que ${c.places} place${c.places > 1 ? 's' : ''}`
				: 'Disponible';
	const total = $derived(formatEuros(data.recap?.totalCentimes ?? 0));
	const majuscule = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
	const nbProduits = (n: number) => `${n} produit${n > 1 ? 's' : ''}`;

	$effect(() => {
		// Valeurs renvoyées après une erreur, sinon coordonnées mémorisées dans ce navigateur.
		const memo = form ?? chargerCoordonnees();
		if (memo) ({ nom, email, telephone } = memo);
	});

	// Si le panier a été ajusté au stock restant, le panier mémorisé suit.
	$effect(() => {
		if (data.vente && ajustees.length > 0) {
			enregistrerPanier(
				data.vente.id,
				Object.fromEntries(aCommander.map((l) => [l.offre.id, l.quantite]))
			);
		}
	});

	// Vérification anti-robot (Turnstile) : le widget ajoute au formulaire un jeton
	// à usage unique ; on en redemande un après chaque refus du serveur.
	let conteneurTurnstile = $state<HTMLElement>();
	let apiTurnstile: ApiTurnstile | null = null;
	let widget: string | null = null;
	let humainVerifie = $state(false);
	let turnstileIndisponible = $state(false);
	// Valeur dérivée : le widget n'est pas recréé quand `data` est rechargé.
	const cleTurnstile = $derived(data.turnstile);
	$effect(() => {
		const cleSite = cleTurnstile;
		const element = conteneurTurnstile;
		if (!cleSite || !element) return;
		let actif = true;
		chargerTurnstile().then(
			(api) => {
				if (!actif) return;
				apiTurnstile = api;
				widget = api.render(element, {
					sitekey: cleSite,
					action: 'commande',
					language: 'fr',
					size: 'flexible',
					callback: () => (humainVerifie = true),
					'expired-callback': () => (humainVerifie = false),
					'error-callback': () => {
						humainVerifie = false;
					}
				});
			},
			() => {
				if (actif) turnstileIndisponible = true;
			}
		);
		return () => {
			actif = false;
			if (apiTurnstile && widget) apiTurnstile.remove(widget);
			widget = null;
			humainVerifie = false;
		};
	});
	function nouveauJeton() {
		if (apiTurnstile && widget) {
			humainVerifie = false;
			apiTurnstile.reset(widget);
		}
	}

	// Les quantités restent dans l'URL de l'action pour réafficher le panier après une erreur.
	const action = $derived(`?${page.url.searchParams.toString()}&/commander`);
</script>

<svelte:head><title>Ma commande – {NOM_BOUTIQUE}</title></svelte:head>

<EnTeteBoutique>
	<a class="retour" href={resolve('/')}>
		<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" class="trait">
			<path d="M19 12H5M11 6l-6 6 6 6" />
		</svg>
		Continuer mes achats
	</a>
</EnTeteBoutique>

<nav class="etapes" aria-label="Étapes de la commande">
	<ol>
		<li class="faite">
			<span class="rond" aria-hidden="true">
				<svg width="16" height="16" viewBox="0 0 24 24" class="trait epais">
					<path d="M5 12.5l4.5 4.5L19 7.5" />
				</svg>
			</span>
			Vos légumes
		</li>
		<li class="trait-etape faite" aria-hidden="true"></li>
		<li aria-current="step" class="en-cours">
			<span class="rond" aria-hidden="true">2</span>Coordonnées et retrait
		</li>
		<li class="trait-etape" aria-hidden="true"></li>
		<li class="a-venir"><span class="rond" aria-hidden="true">3</span>Confirmation</li>
	</ol>
</nav>

<main>
	{#if !data.vente}
		<h1>Ma commande</h1>
		<p class="carte">La vente est terminée : les commandes ne sont plus acceptées.</p>
	{:else if aCommander.length === 0}
		<h1>Ma commande</h1>
		<div class="carte">
			{#if ajustees.length > 0}
				<p>Les produits de votre panier sont épuisés.</p>
			{:else}
				<p>Votre panier est vide.</p>
			{/if}
			<a class="bouton" href={resolve('/')}>Voir les produits</a>
		</div>
	{:else}
		<p class="manuscrit">presque fini !</p>
		<h1>Quand passez-vous chercher vos légumes ?</h1>

		{#if ajustees.length > 0}
			<p class="avert">
				Le stock a changé : {ajustees
					.map((l) =>
						l.quantite > 0
							? `${l.offre.produit} ramené à ${formatQuantite(l.offre.unite, l.quantite)}`
							: `${l.offre.produit} épuisé`
					)
					.join(', ')}.
			</p>
		{/if}

		<div class="colonnes">
			<aside class="resume" aria-label="Récapitulatif">
				<section class="cagette" aria-labelledby="titre-cagette">
					<header class="motif-sombre entete-cagette">
						<div>
							<p class="manuscrit">Votre cagette</p>
							<h2 id="titre-cagette">{nbProduits(aCommander.length)}</h2>
						</div>
						<a href={resolve('/')}>Modifier</a>
					</header>
					<ul>
						{#each aCommander as l (l.offre.id)}
							<li>
								<img src={urlIllustration(l.offre.illustration)} alt="" />
								<span class="produit-ligne">
									<strong>{l.offre.produit}</strong>
									<span>{formatQuantite(l.offre.unite, l.quantite)}</span>
								</span>
								<span class="montant">{formatEuros(l.prixCentimes)}</span>
							</li>
						{/each}
					</ul>
					<div class="total">
						<span>Total</span>
						<strong>{total}</strong>
					</div>
				</section>
				<div class="rappel motif-clair">
					<p>
						<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" class="trait">
							<rect x="3" y="5" width="18" height="16" rx="3" />
							<path d="M3 10h18M8 3v4M16 3v4" />
						</svg>
						<span>
							<strong>Retrait</strong>
							{#if creneauChoisi}
								{majuscule(formatJour(creneauChoisi.date))}, {formatPlage(
									creneauChoisi.heureDebut,
									creneauChoisi.heureFin
								)}
								<br />{creneauChoisi.lieu}
							{:else}
								Choisissez votre créneau.
							{/if}
						</span>
					</p>
					<p>
						<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" class="trait">
							<circle cx="12" cy="12" r="9" />
							<path d="M15.5 8.6a4.2 4.2 0 1 0 0 6.8M7 10.8h6M7 13.2h6" />
						</svg>
						<span>
							<strong>Paiement</strong>
							{mode === 'virement' ? 'Par virement' : 'Au retrait, en espèces ou par chèque'}
						</span>
					</p>
				</div>
			</aside>

			<form
				method="POST"
				{action}
				use:enhance={() => {
					envoi = true;
					enregistrerCoordonnees({ nom, email, telephone });
					return async ({ result, update }) => {
						if (result.type === 'failure') {
							nouveauJeton();
							// Rafraîchir le panier (stock à jour) puis afficher le message.
							await invalidateAll();
							await applyAction(result);
						} else {
							await update();
						}
						envoi = false;
					};
				}}
			>
				{#each aCommander as l (l.offre.id)}
					<input type="hidden" name="o{l.offre.id}" value={l.quantite} />
				{/each}

				<section class="carte etape">
					<h2><span class="numero" aria-hidden="true">1</span>Vos coordonnées</h2>
					<div class="champs">
						<label>
							Nom et prénom
							<input name="nom" required autocomplete="name" bind:value={nom} />
						</label>
						<label>
							Téléphone
							<input
								name="telephone"
								type="tel"
								required
								autocomplete="tel"
								bind:value={telephone}
							/>
						</label>
						<label class="large">
							E-mail
							<input name="email" type="email" required autocomplete="email" bind:value={email} />
							<span class="aide">
								Pour la confirmation, puis un rappel la veille avec un lien d’annulation.
							</span>
						</label>
					</div>
				</section>

				<section class="carte etape">
					<h2><span class="numero" aria-hidden="true">2</span>Votre créneau de retrait</h2>
					<p class="discret sous-titre">
						Commandes jusqu’au {formatDateHeure(data.vente.cloture)}.
					</p>
					{#if creneauxLibres.length === 0}
						<p class="erreur">Tous les créneaux sont complets.</p>
					{/if}
					<fieldset class="creneaux">
						<legend class="visuellement-cache">Créneau de retrait</legend>
						{#each data.vente.creneaux as c (c.id)}
							<label class="choix">
								<input
									type="radio"
									name="creneau"
									value={c.id}
									required
									disabled={c.complet}
									bind:group={creneau}
								/>
								<span>
									<strong class="jour">{formatJour(c.date)}</strong>
									<span class="heure" class:barre={c.complet}>
										{formatPlage(c.heureDebut, c.heureFin)}
									</span>
									<span class="lieu">{c.lieu}</span>
									<span
										class="statut"
										class:presse={!c.complet && c.places !== null && c.places <= 3}
									>
										{statutCreneau(c)}
									</span>
								</span>
							</label>
						{/each}
					</fieldset>
				</section>

				<section class="carte etape">
					<h2><span class="numero" aria-hidden="true">3</span>Paiement, sans frais</h2>
					{#if data.virement}
						<fieldset class="paiements">
							<legend class="visuellement-cache">Mode de paiement</legend>
							<label class="choix">
								<input type="radio" name="mode" value="retrait" bind:group={mode} />
								<span>
									<strong>Au retrait</strong>
									<span class="discret">En espèces ou par chèque, sur place.</span>
								</span>
							</label>
							<label class="choix">
								<input type="radio" name="mode" value="virement" bind:group={mode} />
								<span>
									<strong>Par virement</strong>
									<span class="discret">
										Coordonnées bancaires affichées après la commande. Sans paiement dans les
										délais, la commande est annulée.
									</span>
								</span>
							</label>
						</fieldset>
					{:else}
						<input type="hidden" name="mode" value="retrait" />
						<p class="sans-choix">Au retrait, en espèces ou par chèque.</p>
					{/if}
				</section>

				<div class="validation">
					<label class="cgv">
						<input type="checkbox" name="cgv" value="oui" required />
						<span>
							J’ai lu et j’accepte les
							<a href={resolve('/cgv')} target="_blank">conditions générales de vente</a>. Les
							légumes frais sont exclus du droit de rétractation.
						</span>
					</label>

					{#if data.turnstile}
						<div class="turnstile" bind:this={conteneurTurnstile}></div>
						{#if turnstileIndisponible}
							<p class="erreur" role="alert">
								La vérification anti-robot n’a pas pu se charger. Vérifiez votre connexion ou
								désactivez le bloqueur de contenu pour ce site, puis rechargez la page.
							</p>
						{:else if !humainVerifie}
							<p class="discret" role="status">Vérification anti-robot en cours…</p>
						{/if}
					{/if}

					{#if form?.message}<p class="erreur" role="alert">{form.message}</p>{/if}

					<button
						class="tomate grand"
						disabled={envoi || creneauxLibres.length === 0 || (!!data.turnstile && !humainVerifie)}
					>
						{envoi ? 'Envoi…' : `Commander avec obligation de paiement · ${total}`}
					</button>
					<p class="note-paiement">
						{mode === 'virement'
							? 'L’IBAN et la référence à indiquer s’affichent sur la page suivante.'
							: `Vous réglerez ${total} au moment du retrait.`}
					</p>
				</div>
			</form>
		</div>
	{/if}
</main>

<style>
	.trait {
		fill: none;
		stroke: currentColor;
		stroke-width: 2.2;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.trait.epais {
		stroke-width: 3;
	}
	.retour {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		min-height: 44px;
		font-weight: 600;
		text-decoration: none;
	}

	/* Étapes */
	.etapes {
		max-width: var(--largeur);
		margin: 0 auto;
		padding: 1.75rem 1.5rem 0;
	}
	.etapes ol {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.6rem 0.9rem;
		font-size: 0.95rem;
		font-weight: 600;
	}
	.etapes li {
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}
	.rond {
		width: 32px;
		height: 32px;
		border-radius: 999px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 700;
	}
	.faite {
		color: var(--feuille);
	}
	.faite .rond {
		background: var(--feuille);
		color: var(--blanc);
	}
	.en-cours .rond {
		background: var(--foret);
		color: var(--creme);
	}
	.a-venir {
		color: var(--discret);
	}
	.a-venir .rond {
		border: 2px solid var(--sable);
	}
	.trait-etape {
		width: 40px;
		height: 2px;
		background: var(--bord-fort);
	}
	.trait-etape.faite {
		background: var(--feuille);
	}

	main > h1 {
		margin-bottom: 1.75rem;
	}
	.colonnes {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		gap: 1.75rem;
	}
	form {
		flex: 999 1 35rem;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}
	.resume {
		flex: 1 1 20rem;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	@media (min-width: 60rem) {
		.resume {
			order: 2;
			position: sticky;
			top: 1rem;
		}
	}
	@media (max-width: 59.99rem) {
		/* Sur téléphone, le choix est visible juste en dessous. */
		.rappel {
			display: none;
		}
	}

	/* Étapes du formulaire */
	.etape {
		margin: 0;
	}
	.etape h2 {
		margin: 0 0 1.1rem;
		display: flex;
		align-items: center;
		gap: 0.75rem;
		font-size: 1.45rem;
	}
	.numero {
		width: 34px;
		height: 34px;
		flex: none;
		border-radius: 999px;
		background: var(--soleil);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.05rem;
		font-weight: 800;
	}
	.sous-titre {
		margin: -0.6rem 0 1.1rem;
	}
	.champs {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
	}
	@media (max-width: 34rem) {
		.champs {
			grid-template-columns: 1fr;
		}
	}
	.champs .large {
		grid-column: 1 / -1;
	}
	.champs input {
		width: 100%;
		min-height: 52px;
		font-size: 1rem;
	}
	.aide {
		font-weight: 400;
		color: var(--discret);
	}
	fieldset {
		border: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 0.75rem;
	}
	.creneaux {
		grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr));
	}
	.paiements {
		grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
	}
	.choix > span {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
		min-width: 0;
	}
	.choix strong {
		font-size: 1.05rem;
	}
	.jour::first-letter {
		text-transform: uppercase;
	}
	.heure {
		font-family: var(--police-titre);
		font-weight: 700;
		font-size: 1.3rem;
	}
	.heure.barre {
		text-decoration: line-through;
	}
	.lieu {
		font-size: 0.9rem;
	}
	.statut {
		font-size: 0.875rem;
		font-weight: 700;
		color: var(--feuille);
	}
	.statut.presse {
		color: var(--tomate);
	}
	.choix:has(input:disabled) .statut {
		color: inherit;
	}
	.sans-choix {
		margin: 0;
	}

	/* Validation */
	.validation {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 0.25rem 0.25rem 0;
	}
	.cgv {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		font-size: 0.95rem;
		font-weight: 400;
		line-height: 1.5;
		cursor: pointer;
	}
	.cgv input {
		flex: none;
		margin-top: 0.1rem;
	}
	.turnstile {
		min-height: 65px;
	}
	.validation p {
		margin: 0;
	}
	.note-paiement {
		font-size: 0.875rem;
		color: var(--discret);
		text-align: center;
	}

	/* Récapitulatif */
	.entete-cagette {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 0.75rem;
	}
	.entete-cagette a {
		padding: 0.6rem 0;
		font-size: 0.875rem;
		font-weight: 600;
	}
	.rappel {
		padding: 1.25rem 1.4rem;
		border-radius: var(--rayon);
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
	}
	.rappel p {
		margin: 0;
		display: flex;
		gap: 0.75rem;
		align-items: flex-start;
	}
	.rappel svg {
		flex: none;
		margin-top: 2px;
	}
	.rappel strong {
		display: block;
	}

	@media (max-width: 40rem) {
		.etapes {
			padding: 1.25rem 1rem 0;
		}
		.etapes ol {
			font-size: 0.85rem;
		}
		.trait-etape {
			width: 16px;
		}
		main {
			padding: 1.25rem 1rem 3rem;
		}
		.etape {
			padding: 1.25rem;
		}
		.etape h2 {
			font-size: 1.25rem;
		}
	}
</style>
