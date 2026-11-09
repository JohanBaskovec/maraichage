<script lang="ts">
	import { resolve } from '$app/paths';
	import { NOM_BOUTIQUE } from '#lib/config.ts';
	import { formatEuros, formatQuantite } from '#lib/format.ts';
	import { formatDateHeure, formatJour } from '#lib/heure.ts';
	import { quantiteMax, quantitesVersUrl, recapitulatif } from '#lib/panier.ts';
	import { chargerPanier, enregistrerPanier } from '#lib/stockage.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const vente = $derived(data.vente);
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

	function changer(offre: NonNullable<typeof vente>['offres'][number], sens: 1 | -1) {
		const max = quantiteMax(offre);
		const actuelle = Math.min(panier[offre.id] ?? 0, max);
		const nouvelle = Math.max(0, Math.min(max, actuelle + sens * offre.pas));
		if (nouvelle === 0) delete panier[offre.id];
		else panier[offre.id] = nouvelle;
	}

	const lieux = $derived([...new Set(vente?.creneaux.map((c) => c.lieu) ?? [])]);
</script>

<svelte:head>
	<title>{NOM_BOUTIQUE} – légumes de la semaine</title>
	<meta name="description" content="Commandez les légumes de la semaine et venez les chercher." />
</svelte:head>

<header>
	<h1>{NOM_BOUTIQUE}</h1>
	<p>Légumes de la ferme, à commander en ligne et à retirer sur place.</p>
</header>

<main class:avec-barre={lignes.length > 0}>
	{#if !vente}
		<div class="carte">
			<h2>Pas de vente en cours</h2>
			{#if data.prochaine}
				<p>
					La prochaine vente ouvre le <strong>{formatDateHeure(data.prochaine.ouverture)}</strong>.
				</p>
			{:else}
				<p>Revenez bientôt pour découvrir les légumes de la semaine.</p>
			{/if}
		</div>
	{:else}
		<section class="infos carte">
			<p>
				Commandes jusqu’au <strong>{formatDateHeure(vente.cloture)}</strong>.
			</p>
			<p class="discret">
				Retrait {lieux.length === 1 ? `à : ${lieux[0]}` : 'sur place'}, le {[
					...new Set(vente.creneaux.map((c) => formatJour(c.date)))
				].join(' ou le ')}. Paiement au retrait.
			</p>
		</section>

		<noscript>
			<p class="avert">Activez JavaScript pour remplir votre panier.</p>
		</noscript>

		{#if vente.offres.length === 0}
			<p class="vide">Aucun produit cette semaine.</p>
		{/if}

		<ul class="produits">
			{#each vente.offres as offre (offre.id)}
				{@const max = quantiteMax(offre)}
				{@const qte = Math.min(panier[offre.id] ?? 0, max)}
				<li class="carte produit" class:choisi={qte > 0}>
					<div class="nom">
						<strong>{offre.produit}</strong>
						<span class="prix">{formatEuros(offre.prixCentimes)} {PRIX_PAR[offre.unite]}</span>
						<span class="discret">
							{offre.restant > 0 ? `reste ${formatQuantite(offre.unite, offre.restant)}` : 'épuisé'}
						</span>
						{#if qte > 0 && qte === max && max < offre.restant}
							<span class="discret limite">
								{formatQuantite(offre.unite, max)} au plus par commande
							</span>
						{/if}
					</div>
					<div class="quantite" role="group" aria-label="Quantité de {offre.produit}">
						<button
							type="button"
							class="secondaire rond"
							onclick={() => changer(offre, -1)}
							disabled={qte === 0}
							aria-label="Retirer {formatQuantite(offre.unite, offre.pas)}">−</button
						>
						<output aria-live="polite">{qte > 0 ? formatQuantite(offre.unite, qte) : '0'}</output>
						<button
							type="button"
							class="rond"
							onclick={() => changer(offre, 1)}
							disabled={qte + offre.pas > max}
							aria-label="Ajouter {formatQuantite(offre.unite, offre.pas)}">+</button
						>
					</div>
				</li>
			{/each}
		</ul>
	{/if}
</main>

{#if lignes.length > 0 && recap}
	<div class="barre">
		<div>
			<strong>{formatEuros(recap.totalCentimes)}</strong>
			<span class="discret">· {lignes.length} produit{lignes.length > 1 ? 's' : ''}</span>
		</div>
		<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- chemin résolu ci-dessus, avec les quantités en paramètres -->
		<a class="bouton" href={lienValidation}>Valider mon panier</a>
	</div>
{/if}

<style>
	header {
		background: var(--accent);
		color: var(--accent-texte);
		padding: 1.25rem 1rem;
	}
	header h1,
	header p {
		max-width: 56rem;
		margin: 0 auto;
	}
	header p {
		opacity: 0.9;
		margin-top: 0.25rem;
	}
	.infos p {
		margin: 0;
	}
	.infos p + p {
		margin-top: 0.35rem;
	}
	.produits {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		gap: 0.75rem;
	}
	@media (min-width: 40rem) {
		.produits {
			grid-template-columns: 1fr 1fr;
		}
	}
	.produit {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.75rem;
		margin: 0;
	}
	.produit.choisi {
		border-color: var(--accent);
	}
	.nom {
		display: grid;
		gap: 0.1rem;
	}
	.prix {
		font-weight: 500;
	}
	.limite {
		font-style: italic;
	}
	.quantite {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		flex-shrink: 0;
	}
	.quantite output {
		min-width: 4.2rem;
		text-align: center;
		font-variant-numeric: tabular-nums;
	}
	.rond {
		width: 2.5rem;
		height: 2.5rem;
		padding: 0;
		border-radius: 999px;
		font-size: 1.3rem;
		line-height: 1;
	}
	main.avec-barre {
		padding-bottom: 6rem;
	}
	.barre {
		position: fixed;
		inset: auto 0 0 0;
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
		padding: 0.75rem max(1rem, calc((100vw - 54rem) / 2));
		padding-bottom: max(0.75rem, env(safe-area-inset-bottom));
		background: var(--carte);
		border-top: 1px solid var(--bord);
		box-shadow: 0 -4px 16px rgb(0 0 0 / 0.08);
	}
	.bouton {
		background: var(--accent);
		color: var(--accent-texte);
		text-decoration: none;
		font-weight: 600;
		padding: 0.7rem 1.1rem;
		border-radius: 6px;
		white-space: nowrap;
	}
</style>
