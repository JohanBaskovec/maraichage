<script lang="ts">
	import { resolve } from '$app/paths';
	import { formatDateHeure } from '#lib/heure.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const STATUTS = { brouillon: 'Brouillon', publiee: 'Publiée', archivee: 'Archivée' };
	const derniere = $derived(data.ventes[0]);
</script>

<svelte:head><title>Ventes – back-office</title></svelte:head>

<h1>Ventes</h1>

{#if form?.message}<p class="erreur">{form.message}</p>{/if}

<div class="carte">
	<div class="ligne">
		{#if derniere}
			<form method="POST" action="?/dupliquer">
				<input type="hidden" name="id" value={derniere.id} />
				<button>Nouvelle vente à partir de la dernière</button>
			</form>
		{/if}
		<form method="POST" action="?/nouvelle">
			<button class={derniere ? 'secondaire' : ''}>Nouvelle vente vide</button>
		</form>
	</div>
	{#if derniere}
		<p class="discret">
			La copie reprend les produits, prix, quantités et créneaux de la dernière vente, décalés d’une
			semaine. Elle reste en brouillon jusqu’à ce que tu la publies.
		</p>
	{/if}
</div>

{#if data.ventes.length === 0}
	<p class="vide">
		Aucune vente pour l’instant. Commence par créer tes <a href={resolve('/admin/produits')}
			>produits</a
		>.
	</p>
{:else}
	<ul class="ventes">
		{#each data.ventes as vente (vente.id)}
			<li class="carte">
				<a href={resolve('/admin/ventes/[id]', { id: String(vente.id) })}>
					Commandes jusqu’au {formatDateHeure(vente.cloture)}
				</a>
				<span class="badge {vente.statut}">{STATUTS[vente.statut]}</span>
				<div class="discret">
					{vente.nbOffres} produit{vente.nbOffres > 1 ? 's' : ''} · {vente.nbCommandes} commande{vente.nbCommandes >
					1
						? 's'
						: ''}
				</div>
			</li>
		{/each}
	</ul>
{/if}

<style>
	.ventes {
		list-style: none;
		padding: 0;
	}
	.ventes a {
		font-weight: 600;
		margin-right: 0.5rem;
	}
</style>
