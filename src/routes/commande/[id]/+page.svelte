<script lang="ts">
	import { resolve } from '$app/paths';
	import { NOM_BOUTIQUE } from '#lib/config.ts';
	import { formatEuros, formatQuantite } from '#lib/format.ts';
	import { formatDateHeure, formatJour } from '#lib/heure.ts';
	import { prixLigneCentimes } from '#lib/prix.ts';
	import { viderPanier } from '#lib/stockage.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const c = $derived(data.commande);
	const active = $derived(['en_attente_paiement', 'confirmee', 'prete'].includes(c.statut));

	$effect(() => {
		viderPanier(c.venteId);
	});
</script>

<svelte:head>
	<title>Commande {c.reference} – {NOM_BOUTIQUE}</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<main>
	{#if c.statut === 'annulee'}
		<h1>Commande annulée</h1>
	{:else if c.statut === 'recuperee'}
		<h1>Commande récupérée</h1>
		<p>Merci, et à bientôt !</p>
	{:else}
		<h1>Merci {c.nom.split(' ')[0]}, votre commande est enregistrée</h1>
	{/if}

	<section class="carte reference">
		<span class="discret">Votre référence</span>
		<strong>{c.reference}</strong>
		{#if active}
			<span class="discret">À donner au retrait. Notez-la ou gardez cette page.</span>
		{/if}
	</section>

	{#if active}
		<section class="carte">
			<h2>Retrait</h2>
			<p>
				<strong>{formatJour(c.creneau.date)}</strong>, entre {c.creneau.heureDebut} et
				{c.creneau.heureFin}
				<br />{c.creneau.lieu}
			</p>
			<p class="discret">
				{#if c.modePaiement === 'retrait'}
					Paiement au retrait, en espèces ou par chèque.
				{/if}
			</p>
		</section>
	{/if}

	<section class="carte">
		<h2>Détail</h2>
		<table>
			<tbody>
				{#each c.lignes as l (l.produit)}
					<tr>
						<td>{l.produit}</td>
						<td class="qte">{formatQuantite(l.unite, l.quantite)}</td>
						<td class="montant">
							{formatEuros(prixLigneCentimes(l.unite, l.prixUnitaireCentimes, l.quantite))}
						</td>
					</tr>
				{/each}
			</tbody>
			<tfoot>
				<tr>
					<th colspan="2">Total</th>
					<td class="montant"><strong>{formatEuros(c.totalCentimes)}</strong></td>
				</tr>
			</tfoot>
		</table>
	</section>

	{#if active && new Date() < c.limiteAnnulation}
		<p class="discret">
			Un empêchement ?
			<a href={resolve('/annuler/[jeton]', { jeton: c.jetonAnnulation })}>Annuler ma commande</a>
			(possible jusqu’au {formatDateHeure(c.limiteAnnulation)}).
		</p>
	{/if}

	<p><a href={resolve('/')}>Retour à la boutique</a></p>
</main>

<style>
	main {
		max-width: 40rem;
	}
	h2 {
		margin-top: 0;
	}
	.reference {
		display: grid;
		gap: 0.25rem;
		text-align: center;
	}
	.reference strong {
		font-size: 2rem;
		letter-spacing: 0.08em;
		font-variant-numeric: tabular-nums;
	}
	table {
		width: 100%;
		border-collapse: collapse;
	}
	td,
	th {
		padding: 0.4rem 0;
		border-bottom: 1px solid var(--bord);
		text-align: left;
		font-weight: normal;
	}
	tfoot th,
	tfoot td {
		border-bottom: none;
		padding-top: 0.6rem;
	}
	.qte {
		color: var(--discret);
		padding: 0.4rem 0.5rem;
		white-space: nowrap;
	}
	.montant {
		text-align: right;
		white-space: nowrap;
	}
</style>
