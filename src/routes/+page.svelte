<script lang="ts">
	import { resolve } from '$app/paths';
	import EnTeteBoutique from '#lib/composants/EnTeteBoutique.svelte';
	import { NOM_BOUTIQUE } from '#lib/config.ts';
	import { formatEuros, formatQuantite } from '#lib/format.ts';
	import { formatDateHeure, formatJour, formatPlage, jourSemaine } from '#lib/heure.ts';
	import { urlIllustration } from '#lib/illustrations.ts';
	import { quantiteMax, quantitesVersUrl, recapitulatif } from '#lib/panier.ts';
	import { chargerPanier, enregistrerPanier } from '#lib/stockage.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const vente = $derived(data.vente);
	type Offre = NonNullable<typeof vente>['offres'][number];
	const PRIX_PAR = { piece: 'la pièce', botte: 'la botte', kg: 'le kg' };

	let panier = $state<Record<number, number>>({});
	let charge = $state(false);

	$effect(() => {
		if (!vente) return;
		panier = chargerPanier(vente.id);
		charge = true;
	});
	$effect(() => {
		if (vente && charge) enregistrerPanier(vente.id, $state.snapshot(panier));
	});

	const recap = $derived(
		vente
			? recapitulatif(vente.offres, new Map(Object.entries(panier).map(([k, v]) => [Number(k), v])))
			: null
	);
	const lignes = $derived(recap?.lignes.filter((l) => l.quantite > 0) ?? []);
	const lienValidation = $derived(
		resolve('/commande') +
			'?' +
			quantitesVersUrl(new Map(lignes.map((l) => [l.offre.id, l.quantite])))
	);
	const illustrations = $derived(new Map(vente?.offres.map((o) => [o.id, o.illustration]) ?? []));

	function changer(offre: Offre, sens: 1 | -1) {
		const max = quantiteMax(offre);
		const actuelle = Math.min(panier[offre.id] ?? 0, max);
		const nouvelle = Math.max(0, Math.min(max, actuelle + sens * offre.pas));
		if (nouvelle === 0) delete panier[offre.id];
		else panier[offre.id] = nouvelle;
	}
	function retirer(id: number) {
		delete panier[id];
	}

	/** « de radis », « d’oignons » */
	const de = (nom: string) =>
		(/^[aeiouyhàâéèêëîïôûü]/i.test(nom) ? 'd’' : 'de ') + nom.toLowerCase();
	/** Stock bas : cinq ajouts ou moins. */
	const stockBas = (o: Offre) => o.restant > 0 && o.restant <= 5 * o.pas;

	// Retrait : jours, heures et lieux de la vente.
	const jours = $derived([...new Set(vente?.creneaux.map((c) => c.date) ?? [])]);
	const lieux = $derived([...new Set(vente?.creneaux.map((c) => c.lieu) ?? [])]);
	const plageDuJour = (jour: string) => {
		const duJour = vente!.creneaux.filter((c) => c.date === jour);
		const debut = duJour.map((c) => c.heureDebut).sort()[0];
		const fin = duJour
			.map((c) => c.heureFin)
			.sort()
			.at(-1)!;
		return formatPlage(debut, fin);
	};
	const quandRetirer = $derived(
		jours.length === 1 ? jourSemaine(jours[0]) : jours.length > 1 ? 'sur place' : ''
	);
	const nbChoisis = (n: number) => `${n} produit${n > 1 ? 's' : ''} choisi${n > 1 ? 's' : ''}`;
</script>

<svelte:head>
	<title>{NOM_BOUTIQUE} – légumes de la semaine</title>
	<meta name="description" content="Commandez les légumes de la semaine et venez les chercher." />
</svelte:head>

<EnTeteBoutique>
	{#if vente}
		<a class="bouton bouton-panier" href="#panier">
			<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" class="trait">
				<path d="M5 8h14l-1.2 12H6.2L5 8z" />
				<path d="M9 8V6a3 3 0 0 1 6 0v2" />
			</svg>
			Mon panier
			<span class="compteur">{lignes.length}</span>
		</a>
	{/if}
</EnTeteBoutique>

<section class="bandeau motif-sombre">
	<div class="contenu">
		<div class="accroche">
			{#if vente}
				<p class="manuscrit">La récolte de la semaine est en ligne !</p>
				<h1>
					Des légumes cueillis pour vous,
					{quandRetirer === 'sur place' ? 'à retirer sur place.' : `à retirer ${quandRetirer}.`}
				</h1>
				<p class="chapo">
					Choisissez librement vos légumes et vos quantités. Pas de panier imposé, pas de compte à
					créer : vous payez au retrait{data.virement ? ' ou par virement' : ''}.
				</p>
				<a class="bouton soleil" href="#catalogue">
					Voir les légumes
					<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" class="trait">
						<path d="M5 12h14M13 6l6 6-6 6" />
					</svg>
				</a>
			{:else}
				<p class="manuscrit">À très vite !</p>
				<h1>Pas de vente en cours</h1>
				<p class="chapo">
					{#if data.prochaine}
						La prochaine vente ouvre le <strong>{formatDateHeure(data.prochaine.ouverture)}</strong
						>.
					{:else}
						Revenez bientôt pour découvrir les légumes de la semaine.
					{/if}
				</p>
			{/if}
		</div>
		<img
			class="illustration"
			src="/illustrations/potager.svg"
			alt=""
			width="520"
			height="420"
			fetchpriority="high"
		/>
	</div>
</section>
<div class="festons" aria-hidden="true"></div>

<main class:avec-barre={lignes.length > 0}>
	{#if vente}
		<section aria-label="Infos pratiques">
			<ul class="infos">
				<li>
					<span class="pastille" aria-hidden="true">
						<svg width="22" height="22" viewBox="0 0 24 24" class="trait">
							<rect x="3" y="5" width="18" height="16" rx="3" />
							<path d="M3 10h18M8 3v4M16 3v4" />
						</svg>
					</span>
					<span>
						<strong>Commandes jusqu’au {formatDateHeure(vente.cloture)}</strong>
						<span class="discret">Ou jusqu’à épuisement des légumes</span>
					</span>
				</li>
				<li>
					<span class="pastille" aria-hidden="true">
						<svg width="22" height="22" viewBox="0 0 24 24" class="trait">
							<path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z" />
							<circle cx="12" cy="10" r="2.5" />
						</svg>
					</span>
					<span>
						<strong>
							Retrait {jours.map((j) => `${formatJour(j)}, ${plageDuJour(j)}`).join(' ou ')}
						</strong>
						<span class="discret">{lieux.join(' · ')}</span>
					</span>
				</li>
				<li>
					<span class="pastille" aria-hidden="true">
						<svg width="22" height="22" viewBox="0 0 24 24" class="trait">
							<circle cx="12" cy="12" r="9" />
							<path d="M15.5 8.6a4.2 4.2 0 1 0 0 6.8M7 10.8h6M7 13.2h6" />
						</svg>
					</span>
					<span>
						<strong>Paiement sans frais</strong>
						<span class="discret">
							Espèces ou chèque au retrait{data.virement ? ', ou virement' : ''}
						</span>
					</span>
				</li>
			</ul>
		</section>

		<noscript>
			<p class="avert">Activez JavaScript pour remplir votre panier.</p>
		</noscript>

		<section id="catalogue" aria-labelledby="titre-catalogue">
			<p class="manuscrit">fraîchement cueillis</p>
			<h2 id="titre-catalogue">Au jardin cette semaine</h2>

			<div class="rayon">
				{#if vente.offres.length === 0}
					<p class="vide">Aucun produit cette semaine.</p>
				{/if}
				<ul class="produits">
					{#each vente.offres as offre (offre.id)}
						{@const max = quantiteMax(offre)}
						{@const qte = Math.min(panier[offre.id] ?? 0, max)}
						{@const unPas = formatQuantite(offre.unite, offre.pas)}
						<li class="produit" class:choisi={qte > 0} class:epuise={offre.restant === 0}>
							<div class="visuel motif-clair">
								<img src={urlIllustration(offre.illustration)} alt="" width="126" height="126" />
								<p class="etiquette">
									<span class="prix">{formatEuros(offre.prixCentimes)}</span>
									<span class="par">{PRIX_PAR[offre.unite]}</span>
								</p>
							</div>
							<div class="corps">
								<div class="titre">
									<h3>{offre.produit}</h3>
									<p class="prix-ligne" aria-hidden="true">
										<span class="prix">{formatEuros(offre.prixCentimes)}</span>
										<span class="par">{PRIX_PAR[offre.unite]}</span>
									</p>
								</div>
								{#if offre.description}<p class="description">{offre.description}</p>{/if}
								<p class="stock" class:bas={stockBas(offre) || offre.restant === 0}>
									<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" class="trait">
										<path d="M5 19c0-8 5-13 14-14-1 9-6 14-14 14z" />
										<path d="M5 19l7-7" />
									</svg>
									{offre.restant === 0
										? 'Épuisé'
										: stockBas(offre)
											? `Plus que ${formatQuantite(offre.unite, offre.restant)}\u00a0!`
											: `Reste ${formatQuantite(offre.unite, offre.restant)}`}
								</p>
								<div class="actions">
									{#if offre.restant === 0}
										<button type="button" class="secondaire large" disabled>Épuisé</button>
									{:else if qte === 0}
										<button
											type="button"
											class="tomate large"
											onclick={() => changer(offre, 1)}
											aria-label="Ajouter {unPas} {de(offre.produit)}"
										>
											<svg
												width="18"
												height="18"
												viewBox="0 0 24 24"
												aria-hidden="true"
												class="trait"
											>
												<path d="M12 5v14M5 12h14" />
											</svg>
											Ajouter
										</button>
									{:else}
										<div class="quantite" role="group" aria-label="Quantité {de(offre.produit)}">
											<button
												type="button"
												class="pas"
												onclick={() => changer(offre, -1)}
												aria-label="Retirer {unPas} {de(offre.produit)}"
											>
												<svg
													width="18"
													height="18"
													viewBox="0 0 24 24"
													aria-hidden="true"
													class="trait"
												>
													<path d="M5 12h14" />
												</svg>
											</button>
											<output aria-live="polite">{formatQuantite(offre.unite, qte)}</output>
											<button
												type="button"
												class="pas"
												onclick={() => changer(offre, 1)}
												disabled={qte + offre.pas > max}
												aria-label="Ajouter {unPas} {de(offre.produit)}"
											>
												<svg
													width="18"
													height="18"
													viewBox="0 0 24 24"
													aria-hidden="true"
													class="trait"
												>
													<path d="M12 5v14M5 12h14" />
												</svg>
											</button>
										</div>
									{/if}
								</div>
								{#if qte > 0 && qte === max && max < offre.restant}
									<p class="limite">{formatQuantite(offre.unite, max)} au plus par commande</p>
								{/if}
							</div>
						</li>
					{/each}
				</ul>

				<aside id="panier" class="cagette panier-lateral" aria-labelledby="titre-panier">
					<header class="motif-sombre">
						<p class="manuscrit">Votre cagette</p>
						<h2 id="titre-panier">
							{lignes.length === 0 ? 'Rien pour l’instant' : nbChoisis(lignes.length)}
						</h2>
					</header>
					{#if lignes.length === 0}
						<p class="panier-vide">Ajoutez des légumes depuis la liste : ils apparaîtront ici.</p>
					{:else}
						<ul>
							{#each lignes as l (l.offre.id)}
								<li>
									<img src={urlIllustration(illustrations.get(l.offre.id))} alt="" />
									<span class="produit-ligne">
										<strong>{l.offre.produit}</strong>
										<span>{formatQuantite(l.offre.unite, l.quantite)}</span>
									</span>
									<span class="montant">{formatEuros(l.prixCentimes)}</span>
									<button
										type="button"
										class="retirer"
										onclick={() => retirer(l.offre.id)}
										aria-label="Retirer {l.offre.produit.toLowerCase()} du panier"
									>
										<svg
											width="16"
											height="16"
											viewBox="0 0 24 24"
											aria-hidden="true"
											class="trait"
										>
											<path d="M6 6l12 12M18 6L6 18" />
										</svg>
									</button>
								</li>
							{/each}
						</ul>
						<div class="total">
							<span>Total</span>
							<strong>{formatEuros(recap!.totalCentimes)}</strong>
						</div>
						<div class="pied-panier">
							<p>
								Au poids, nous servons au plus près de la quantité commandée ; le prix reste celui
								affiché.
							</p>
							<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- chemin résolu ci-dessus, avec les quantités en paramètres -->
							<a class="bouton soleil grand" href={lienValidation}>
								Valider mon panier
								<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" class="trait">
									<path d="M5 12h14M13 6l6 6-6 6" />
								</svg>
							</a>
						</div>
					{/if}
					<p class="sans-compte">
						Sans compte · paiement au retrait{data.virement ? ' ou par virement' : ''}
					</p>
				</aside>
			</div>
		</section>
	{/if}
</main>

{#if lignes.length > 0 && recap}
	<div class="barre">
		<div>
			<span class="nb">{nbChoisis(lignes.length)}</span>
			<strong>{formatEuros(recap.totalCentimes)}</strong>
		</div>
		<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- chemin résolu ci-dessus, avec les quantités en paramètres -->
		<a class="bouton soleil" href={lienValidation}>
			Valider mon panier
			<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" class="trait">
				<path d="M5 12h14M13 6l6 6-6 6" />
			</svg>
		</a>
	</div>
{/if}

<style>
	.trait {
		fill: none;
		stroke: currentColor;
		stroke-width: 2.2;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	/* En-tête : bouton panier (sur grand écran, le panier est à côté de la liste). */
	.bouton-panier {
		padding: 0 0.5rem 0 1rem;
	}
	.compteur {
		min-width: 28px;
		height: 28px;
		padding: 0 0.5rem;
		border-radius: 999px;
		background: var(--soleil);
		color: var(--foret);
		font-size: 0.875rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}

	/* Bandeau d'accueil */
	.bandeau {
		overflow: hidden;
	}
	.bandeau .contenu {
		max-width: var(--largeur);
		margin: 0 auto;
		padding: 3.5rem 1.5rem 0;
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: 1.5rem 2.5rem;
	}
	.accroche {
		flex: 1 1 26rem;
		min-width: 0;
		padding-bottom: 4rem;
	}
	.accroche .manuscrit {
		color: var(--soleil);
		font-size: 1.9rem;
		margin-bottom: 0.6rem;
	}
	.accroche h1 {
		margin: 0;
		font-size: clamp(2.2rem, 5.2vw, 4.1rem);
		line-height: 1.02;
		letter-spacing: -0.025em;
	}
	.chapo {
		margin: 1.4rem 0 2rem;
		max-width: 30rem;
		font-size: 1.125rem;
		line-height: 1.6;
		color: var(--feuille-pale);
	}
	.chapo strong {
		color: var(--creme);
	}
	.accroche .bouton {
		min-height: 54px;
		padding: 0 1.6rem;
		font-size: 1.05rem;
	}
	.illustration {
		flex: 1 1 22rem;
		max-width: 520px;
		min-width: 0;
		width: 100%;
		height: auto;
		display: block;
	}

	/* Infos pratiques */
	.infos {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(15.5rem, 1fr));
		gap: 1rem;
	}
	.infos li {
		display: flex;
		gap: 0.9rem;
		align-items: flex-start;
		padding: 1.1rem 1.25rem;
		border-radius: 18px;
		background: var(--carte);
		border: 1px solid var(--bord);
	}
	.infos strong {
		display: block;
	}
	.pastille {
		flex: none;
		width: 44px;
		height: 44px;
		border-radius: 12px;
		background: var(--feuille-doux);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	/* Catalogue */
	#catalogue {
		padding-top: 3rem;
	}
	#catalogue > h2 {
		margin: 0 0 1.75rem;
		font-size: clamp(1.9rem, 3.6vw, 2.75rem);
		font-weight: 800;
	}
	.rayon {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		gap: 1.75rem;
	}
	.produits {
		flex: 999 1 35rem;
		min-width: 0;
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(14.5rem, 1fr));
		gap: 1.25rem;
	}
	.produit {
		display: flex;
		flex-direction: column;
		border-radius: var(--rayon);
		background: var(--carte);
		border: 1px solid var(--bord);
		overflow: hidden;
		transition:
			transform 0.2s,
			box-shadow 0.2s,
			border-color 0.2s;
	}
	.produit:hover {
		transform: translateY(-4px);
		box-shadow: var(--ombre);
	}
	.produit.choisi {
		border-color: var(--feuille);
	}
	.visuel {
		position: relative;
		height: 170px;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.visuel img {
		width: 126px;
		height: 126px;
	}
	.epuise .visuel img {
		opacity: 0.45;
		filter: grayscale(1);
	}
	.etiquette {
		position: absolute;
		top: 14px;
		left: 14px;
		margin: 0;
		padding: 0.4rem 0.9rem 0.5rem;
		border-radius: 10px;
		background: var(--foret);
		color: var(--creme);
		transform: rotate(-4deg);
		box-shadow: 0 6px 12px -6px rgb(31 61 43 / 0.6);
		line-height: 1;
	}
	.etiquette .prix {
		display: block;
		font-family: var(--police-main);
		font-weight: 700;
		font-size: 1.7rem;
	}
	.etiquette .par {
		display: block;
		margin-top: 0.15rem;
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--feuille-pale);
	}
	.prix-ligne {
		display: none;
	}
	.corps {
		flex: 1;
		padding: 1rem 1.1rem 1.1rem;
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}
	.corps h3 {
		margin: 0;
		font-size: 1.3rem;
		letter-spacing: -0.01em;
		line-height: 1.2;
	}
	.description {
		margin: -0.35rem 0 0;
		font-size: 0.875rem;
		line-height: 1.45;
		color: var(--discret);
	}
	.stock {
		margin: 0;
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.875rem;
		font-weight: 700;
		color: var(--feuille);
	}
	.stock.bas {
		color: var(--tomate);
	}
	.limite {
		margin: 0;
		font-size: 0.85rem;
		font-style: italic;
		color: var(--discret);
	}
	.actions {
		margin-top: auto;
		padding-top: 0.25rem;
	}
	.large {
		width: 100%;
		min-height: 52px;
		font-size: 1rem;
	}
	.quantite {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		padding: 4px;
		border-radius: 999px;
		background: var(--feuille-doux);
	}
	.quantite output {
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		text-align: center;
	}
	.pas {
		width: 44px;
		height: 44px;
		min-height: 44px;
		flex: none;
		padding: 0;
		border: 0;
		background: var(--carte);
		color: var(--foret);
	}
	.pas:hover:not(:disabled) {
		background: var(--feuille-pale);
		color: var(--foret);
	}

	/* Panier à côté de la liste (grand écran) */
	.panier-lateral {
		flex: 1 1 18.75rem;
		min-width: 0;
		position: sticky;
		top: 1rem;
	}
	.panier-vide {
		margin: 1rem 1.5rem;
		color: var(--feuille-pale);
	}
	.retirer {
		width: 44px;
		height: 44px;
		min-height: 44px;
		flex: none;
		margin-right: -12px;
		padding: 0;
		border: 0;
		background: transparent;
		color: var(--sur-foret);
	}
	.retirer:hover:not(:disabled) {
		background: rgb(247 243 234 / 0.12);
		color: var(--creme);
	}
	.cagette .total {
		padding-bottom: 0.4rem;
	}
	.pied-panier {
		padding: 0 1.5rem;
	}
	.pied-panier p {
		margin: 0 0 1.1rem;
		font-size: 0.82rem;
		line-height: 1.5;
		color: var(--sur-foret);
	}
	.sans-compte {
		margin: 0;
		padding: 0.9rem 1.5rem 1.4rem;
		font-size: 0.82rem;
		color: var(--sur-foret);
		text-align: center;
	}

	/* Barre du panier en bas de l'écran (téléphone, tablette) */
	.barre {
		position: fixed;
		inset: auto 0 0 0;
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.75rem;
		padding: 0.9rem max(1rem, calc((100vw - var(--largeur)) / 2 + 1.5rem));
		padding-bottom: max(1.2rem, env(safe-area-inset-bottom));
		background: var(--foret);
		color: var(--creme);
		border-radius: 24px 24px 0 0;
		box-shadow: 0 -12px 28px -14px rgb(31 61 43 / 0.55);
		z-index: 10;
	}
	.barre > div {
		line-height: 1.15;
	}
	.barre .nb {
		display: block;
		font-size: 0.82rem;
		color: var(--sur-foret);
	}
	.barre strong {
		font-family: var(--police-titre);
		font-size: 1.7rem;
		font-weight: 800;
	}
	.barre .bouton {
		min-height: 52px;
		white-space: nowrap;
	}
	main.avec-barre {
		padding-bottom: 7rem;
	}

	@media (min-width: 64rem) {
		.barre {
			display: none;
		}
		main.avec-barre {
			padding-bottom: 3rem;
		}
	}
	@media (max-width: 63.99rem) {
		.panier-lateral,
		.bouton-panier {
			display: none;
		}
	}

	/* Téléphone : cartes en ligne, comme dans la maquette mobile */
	@media (max-width: 40rem) {
		.bandeau .contenu {
			padding: 1.75rem 1.25rem 0;
		}
		.accroche {
			padding-bottom: 2rem;
		}
		.accroche .manuscrit {
			font-size: 1.55rem;
		}
		.illustration {
			display: none;
		}
		main {
			padding: 1.25rem 1rem 3rem;
		}
		#catalogue {
			padding-top: 2rem;
		}
		.produits {
			grid-template-columns: 1fr;
			gap: 0.75rem;
		}
		.produit {
			flex-direction: row;
			gap: 0.9rem;
			padding: 0.75rem;
			border-radius: 20px;
		}
		.produit:hover {
			transform: none;
			box-shadow: none;
		}
		.visuel {
			flex: none;
			width: 84px;
			height: 84px;
			border-radius: 16px;
		}
		.visuel img {
			width: 66px;
			height: 66px;
		}
		/* Prix affiché à côté du nom ; l'étiquette reste lue par les lecteurs d'écran. */
		.etiquette {
			clip-path: inset(50%);
			width: 1px;
			height: 1px;
			padding: 0;
			overflow: hidden;
			white-space: nowrap;
		}
		.corps {
			padding: 0;
			gap: 0.4rem;
			min-width: 0;
		}
		.titre {
			display: flex;
			justify-content: space-between;
			align-items: baseline;
			gap: 0.5rem;
		}
		.corps h3 {
			font-size: 1.05rem;
		}
		.prix-ligne {
			display: block;
			margin: 0;
			white-space: nowrap;
			font-family: var(--police-main);
			font-size: 1.45rem;
			font-weight: 700;
			line-height: 1;
		}
		.prix-ligne .par {
			font-family: var(--police-texte);
			font-size: 0.75rem;
			font-weight: 600;
			color: var(--discret);
		}
		.description {
			margin: 0;
			font-size: 0.82rem;
		}
		/* Stock à gauche, bouton à droite. */
		.corps {
			display: grid;
			grid-template-columns: 1fr auto;
			align-items: center;
			gap: 0.4rem 0.5rem;
		}
		.titre,
		.description,
		.limite {
			grid-column: 1 / -1;
		}
		.actions {
			margin: 0;
			padding: 0;
		}
		/* Une fois au panier, le sélecteur de quantité prend toute la ligne. */
		.actions:has(.quantite) {
			grid-column: 1 / -1;
		}
		.stock {
			font-size: 0.82rem;
		}
		.large {
			width: auto;
			min-height: 44px;
			padding: 0 1rem 0 0.75rem;
			font-size: 0.95rem;
		}
	}
</style>
