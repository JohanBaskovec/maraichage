<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import Logo from '#lib/composants/Logo.svelte';
	import { NOM_BOUTIQUE } from '#lib/config.ts';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	const liens = [
		{ href: '/admin' as const, texte: 'Ventes' },
		{ href: '/admin/produits' as const, texte: 'Produits' },
		{ href: '/admin/clients' as const, texte: 'Clients bloqués' }
	];
	const actif = (href: string) =>
		href === '/admin'
			? page.url.pathname === '/admin' || page.url.pathname.startsWith('/admin/ventes')
			: page.url.pathname.startsWith(href);
</script>

<svelte:head>
	<meta name="robots" content="noindex" />
</svelte:head>

<header class="barre-admin">
	<a class="marque" href={resolve('/admin')}>
		<Logo taille={34} />
		<span>
			<strong>{NOM_BOUTIQUE}</strong>
			<span>Back-office</span>
		</span>
	</a>
	<nav aria-label="Back-office">
		{#each liens as lien (lien.href)}
			<a href={resolve(lien.href)} aria-current={actif(lien.href) ? 'page' : undefined}
				>{lien.texte}</a
			>
		{/each}
	</nav>
</header>
<main>
	{@render children()}
</main>

<style>
	.barre-admin {
		background: var(--foret);
		color: var(--creme);
	}
	.barre-admin {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem 1.5rem;
		padding: 0.6rem max(1rem, calc((100vw - 56rem) / 2));
	}
	.marque {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		color: var(--creme);
		text-decoration: none;
	}
	.marque > span {
		display: flex;
		flex-direction: column;
		line-height: 1.15;
	}
	.marque strong {
		font-family: var(--police-titre);
		font-weight: 800;
	}
	.marque span span {
		font-size: 0.8rem;
		color: var(--sur-foret);
	}
	nav {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
	}
	nav a {
		display: inline-flex;
		align-items: center;
		min-height: 40px;
		padding: 0 0.9rem;
		border-radius: 999px;
		color: var(--feuille-pale);
		font-weight: 600;
		text-decoration: none;
	}
	nav a:hover {
		color: var(--creme);
		background: rgb(247 243 234 / 0.1);
	}
	nav a[aria-current='page'] {
		background: var(--soleil);
		color: var(--foret);
	}
	/* Back-office : mise en page dense, pratique sur téléphone. */
	main {
		max-width: 56rem;
		padding: 1.25rem 1rem 3rem;
	}
	main :global(h1) {
		font-size: 1.9rem;
		margin: 0.5rem 0 1rem;
	}
	main :global(h2) {
		font-size: 1.25rem;
		margin: 1.75rem 0 0.75rem;
	}
	main :global(.carte) {
		padding: 1rem 1.1rem;
		border-radius: 16px;
		margin-bottom: 0.9rem;
	}
	main :global(.carte h2:first-child),
	main :global(.carte h3:first-child) {
		margin-top: 0;
	}
	main :global(input:not([type='checkbox'], [type='radio'])),
	main :global(select) {
		min-height: 44px;
		border-radius: 10px;
	}
	main :global(label) {
		color: var(--discret);
	}
</style>
