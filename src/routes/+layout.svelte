<script lang="ts">
	import '../app.css';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import favicon from '#lib/assets/favicon.svg';
	import Logo from '#lib/composants/Logo.svelte';
	import { INFOS_LEGALES, NOM_BOUTIQUE } from '#lib/config.ts';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children()}

{#if !page.url.pathname.startsWith('/admin')}
	<footer class="pied motif-sombre">
		<div class="festons-pied" aria-hidden="true"></div>
		<div class="contenu">
			<div class="marque">
				<Logo />
				<span>
					<strong>{NOM_BOUTIQUE}</strong>
					<span>Vente directe de légumes de saison</span>
				</span>
			</div>
			<p>
				<strong>Une question ?</strong><br />
				<a href="mailto:{INFOS_LEGALES.email}">{INFOS_LEGALES.email}</a>
			</p>
			<nav aria-label="Informations légales">
				<a href={resolve('/mentions-legales')}>Mentions légales</a>
				<a href={resolve('/cgv')}>Conditions générales de vente</a>
				<a href={resolve('/confidentialite')}>Confidentialité</a>
			</nav>
		</div>
		<p class="cookies">Ce site ne dépose aucun cookie de mesure d’audience ni de publicité.</p>
	</footer>
{/if}

<style>
	.pied {
		margin-top: 3rem;
		color: var(--feuille-pale);
		font-size: 0.95rem;
	}
	.festons-pied {
		height: 14px;
		background-image: radial-gradient(circle at 14px 0, var(--creme) 13px, transparent 13.5px);
		background-size: 28px 14px;
		background-repeat: repeat-x;
	}
	.contenu {
		max-width: var(--largeur);
		margin: 0 auto;
		padding: 2.25rem 1.5rem 1.75rem;
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		gap: 1.75rem 3rem;
	}
	.marque {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}
	.marque > span {
		display: flex;
		flex-direction: column;
		line-height: 1.25;
	}
	.marque strong {
		font-family: var(--police-titre);
		font-weight: 800;
		font-size: 1.25rem;
		color: var(--creme);
	}
	p {
		margin: 0;
		line-height: 1.6;
	}
	p strong {
		color: var(--creme);
	}
	nav {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	a {
		color: var(--creme);
	}
	a:hover {
		color: var(--soleil);
	}
	.cookies {
		max-width: var(--largeur);
		margin: 0 auto;
		padding: 1rem 1.5rem 1.5rem;
		border-top: 1px dashed rgb(220 229 208 / 0.25);
		font-size: 0.82rem;
		color: var(--sur-foret);
	}
</style>
