<script lang="ts">
	import type { Snippet } from 'svelte';
	import { resolve } from '$app/paths';
	import { NOM_BOUTIQUE } from '#lib/config.ts';
	import Logo from './Logo.svelte';

	// En-tête des pages de la boutique : logo et nom (lien vers le catalogue),
	// et à droite ce que la page y met (panier, retour aux achats…).
	let { children }: { children?: Snippet } = $props();
</script>

<header class="entete">
	<div class="contenu">
		<a class="marque" href={resolve('/')}>
			<Logo />
			<span>
				<span class="nom">{NOM_BOUTIQUE}</span>
				<span class="slogan">Légumes de saison, cueillis pour vous</span>
			</span>
		</a>
		{#if children}
			<div class="droite">{@render children()}</div>
		{/if}
	</div>
</header>

<style>
	.entete {
		border-bottom: 1px solid var(--bord);
		background: var(--creme);
	}
	.contenu {
		max-width: var(--largeur);
		margin: 0 auto;
		padding: 0.85rem 1.5rem;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem 1.5rem;
	}
	.marque {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		text-decoration: none;
		color: var(--foret);
	}
	.marque > span {
		display: flex;
		flex-direction: column;
		line-height: 1.15;
	}
	.nom {
		font-family: var(--police-titre);
		font-weight: 800;
		font-size: 1.3rem;
		letter-spacing: -0.01em;
	}
	.slogan {
		font-size: 0.8rem;
		color: var(--discret);
	}
	.droite {
		display: flex;
		align-items: center;
		gap: 1rem;
	}
	@media (max-width: 30rem) {
		.contenu {
			padding: 0.75rem 1rem;
		}
		.slogan {
			display: none;
		}
	}
</style>
