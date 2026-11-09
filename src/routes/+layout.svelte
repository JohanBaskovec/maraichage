<script lang="ts">
	import '../app.css';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import favicon from '#lib/assets/favicon.svg';
	import { INFOS_LEGALES, NOM_BOUTIQUE } from '#lib/config.ts';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children()}

{#if !page.url.pathname.startsWith('/admin')}
	<footer class="pied">
		<p>
			<strong>{NOM_BOUTIQUE}</strong> ·
			<a href="mailto:{INFOS_LEGALES.email}">{INFOS_LEGALES.email}</a>
		</p>
		<nav aria-label="Informations légales">
			<a href={resolve('/mentions-legales')}>Mentions légales</a>
			<a href={resolve('/cgv')}>Conditions générales de vente</a>
			<a href={resolve('/confidentialite')}>Confidentialité</a>
		</nav>
	</footer>
{/if}

<style>
	.pied {
		max-width: 56rem;
		margin: 2rem auto 0;
		padding: 1.25rem 1rem 6.5rem;
		border-top: 1px solid var(--bord);
		color: var(--discret);
		font-size: 0.9rem;
	}
	.pied p {
		margin: 0 0 0.5rem;
	}
	.pied nav {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem 1.25rem;
	}
</style>
