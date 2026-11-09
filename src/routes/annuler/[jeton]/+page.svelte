<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { NOM_BOUTIQUE } from '#lib/config.ts';
	import { formatEuros, formatQuantite } from '#lib/format.ts';
	import { formatDateHeure, formatJour } from '#lib/heure.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const c = $derived(data.commande);
	let envoi = $state(false);
</script>

<svelte:head>
	<title>Annuler la commande {c.reference} – {NOM_BOUTIQUE}</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<main>
	{#if form?.resultat === 'annulee' || c.statut === 'annulee'}
		<h1>Commande annulée</h1>
		<p class="ok" role="status">
			La commande <strong>{c.reference}</strong> est annulée. Les produits sont remis en vente.
		</p>
	{:else if form?.resultat === 'trop_tard' || (c.annulable && data.tropTard)}
		<h1>Annulation impossible</h1>
		<p class="avert">
			Le délai d’annulation de la commande {c.reference} est passé (jusqu’au
			{formatDateHeure(c.limiteAnnulation)}). Contactez-nous directement.
		</p>
	{:else if !c.annulable || form?.resultat === 'deja_terminee'}
		<h1>Annulation impossible</h1>
		<p class="avert">La commande {c.reference} ne peut plus être annulée.</p>
	{:else}
		<h1>Annuler ma commande ?</h1>
		<section class="carte">
			<p>
				<strong>{c.reference}</strong> · {c.nom}<br />
				Retrait {formatJour(c.creneau.date)}, {c.creneau.heureDebut}–{c.creneau.heureFin} ·
				{c.creneau.lieu}
			</p>
			<ul>
				{#each c.lignes as l (l.produit)}
					<li>{l.produit} : {formatQuantite(l.unite, l.quantite)}</li>
				{/each}
			</ul>
			<p>Total : {formatEuros(c.totalCentimes)}</p>
		</section>
		<form
			method="POST"
			use:enhance={() => {
				envoi = true;
				return async ({ update }) => {
					await update();
					envoi = false;
				};
			}}
		>
			<button class="danger grand" disabled={envoi}>Oui, annuler ma commande</button>
		</form>
		<p class="discret">
			Possible jusqu’au {formatDateHeure(c.limiteAnnulation)}. Les produits seront remis en vente
			pour d’autres clients.
		</p>
	{/if}
	<p><a href={resolve('/')}>Retour à la boutique</a></p>
</main>

<style>
	main {
		max-width: 40rem;
	}
	ul {
		margin: 0.5rem 0;
		padding-left: 1.2rem;
	}
</style>
