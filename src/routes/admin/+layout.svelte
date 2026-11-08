<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	const liens = [
		{ href: '/admin' as const, texte: 'Ventes' },
		{ href: '/admin/produits' as const, texte: 'Produits' }
	];
	const actif = (href: string) =>
		href === '/admin'
			? page.url.pathname === '/admin' || page.url.pathname.startsWith('/admin/ventes')
			: page.url.pathname.startsWith(href);
</script>

<svelte:head>
	<meta name="robots" content="noindex" />
</svelte:head>

<nav>
	<strong>Back-office</strong>
	{#each liens as lien (lien.href)}
		<a href={resolve(lien.href)} aria-current={actif(lien.href) ? 'page' : undefined}
			>{lien.texte}</a
		>
	{/each}
</nav>
<main>
	{@render children()}
</main>

<style>
	nav {
		display: flex;
		gap: 1rem;
		align-items: baseline;
		flex-wrap: wrap;
		padding: 0.75rem 1rem;
		border-bottom: 1px solid var(--bord);
		background: var(--carte);
	}
	nav a {
		color: var(--discret);
		text-decoration: none;
	}
	nav a[aria-current='page'] {
		color: var(--accent);
		font-weight: 600;
	}
</style>
