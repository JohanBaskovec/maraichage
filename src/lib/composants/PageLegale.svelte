<script lang="ts">
	import type { Snippet } from 'svelte';
	import { resolve } from '$app/paths';
	import { INFOS_LEGALES, NOM_BOUTIQUE } from '#lib/config.ts';

	let { titre, majLe, children }: { titre: string; majLe: string; children: Snippet } = $props();
</script>

<svelte:head><title>{titre} – {NOM_BOUTIQUE}</title></svelte:head>

<main class="legal">
	<p><a href={resolve('/')}>← Boutique</a></p>
	<h1>{titre}</h1>
	{#if INFOS_LEGALES.provisoire}
		<p class="avert" role="note">
			<strong>Version provisoire.</strong> Les informations d’identification de cette page sont fictives
			et doivent être complétées avant l’ouverture de la boutique.
		</p>
	{/if}
	<p class="discret">Dernière mise à jour : {majLe}</p>
	{@render children()}
</main>

<style>
	.legal {
		max-width: 46rem;
	}
	.legal :global(h2) {
		font-size: 1.1rem;
		margin: 1.75rem 0 0.5rem;
	}
	.legal :global(p),
	.legal :global(li) {
		line-height: 1.55;
	}
	.legal :global(dl) {
		display: grid;
		grid-template-columns: max-content 1fr;
		gap: 0.3rem 1rem;
	}
	.legal :global(dt) {
		color: var(--discret);
	}
	.legal :global(dd) {
		margin: 0;
	}
	@media (max-width: 30rem) {
		.legal :global(dl) {
			grid-template-columns: 1fr;
		}
		.legal :global(dd) {
			margin-bottom: 0.5rem;
		}
	}
</style>
