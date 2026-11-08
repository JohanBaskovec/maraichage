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

<div class="admin">
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
</div>

<style>
	.admin {
		--fond: #fbfaf7;
		--texte: #1f2a1f;
		--discret: #5f6b5f;
		--bord: #d9ddd3;
		--accent: #2f6b3a;
		--accent-texte: #fff;
		--erreur: #a12a1f;
		--erreur-fond: #fbeae8;
		--ok-fond: #e8f3ea;
		--carte: #fff;
		color-scheme: light dark;
		background: var(--fond);
		color: var(--texte);
		min-height: 100vh;
		font:
			16px/1.45 system-ui,
			sans-serif;
	}
	@media (prefers-color-scheme: dark) {
		.admin {
			--fond: #161a16;
			--texte: #e6eae3;
			--discret: #a3ad9f;
			--bord: #3a4238;
			--accent: #6fbf7c;
			--accent-texte: #102012;
			--erreur: #f08a7e;
			--erreur-fond: #3a1c19;
			--ok-fond: #1c3320;
			--carte: #1e231e;
		}
	}
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
	main {
		max-width: 56rem;
		margin: 0 auto;
		padding: 1rem;
	}
	.admin :global {
		h1 {
			font-size: 1.5rem;
			margin: 0.5rem 0 1rem;
		}
		h2 {
			font-size: 1.15rem;
			margin: 2rem 0 0.75rem;
		}
		a {
			color: var(--accent);
		}
		input,
		select,
		button {
			font: inherit;
			color: inherit;
		}
		input,
		select {
			background: var(--carte);
			border: 1px solid var(--bord);
			border-radius: 6px;
			padding: 0.4rem 0.5rem;
			min-width: 0;
		}
		button {
			border: 1px solid var(--accent);
			background: var(--accent);
			color: var(--accent-texte);
			border-radius: 6px;
			padding: 0.4rem 0.8rem;
			cursor: pointer;
		}
		button.secondaire {
			background: transparent;
			color: var(--accent);
		}
		button.danger {
			background: transparent;
			border-color: var(--erreur);
			color: var(--erreur);
		}
		label {
			display: grid;
			gap: 0.2rem;
			font-size: 0.9rem;
			color: var(--discret);
		}
		.carte {
			background: var(--carte);
			border: 1px solid var(--bord);
			border-radius: 10px;
			padding: 1rem;
			margin-bottom: 1rem;
		}
		.ligne {
			display: flex;
			gap: 0.75rem;
			flex-wrap: wrap;
			align-items: end;
		}
		.erreur {
			background: var(--erreur-fond);
			color: var(--erreur);
			border-radius: 6px;
			padding: 0.5rem 0.75rem;
			margin: 0.5rem 0;
		}
		.ok {
			background: var(--ok-fond);
			border-radius: 6px;
			padding: 0.5rem 0.75rem;
			margin: 0.5rem 0;
		}
		.discret {
			color: var(--discret);
			font-size: 0.9rem;
		}
		.badge {
			display: inline-block;
			font-size: 0.8rem;
			padding: 0.1rem 0.5rem;
			border-radius: 999px;
			border: 1px solid var(--bord);
			color: var(--discret);
		}
		.badge.publiee {
			border-color: var(--accent);
			color: var(--accent);
		}
		.vide {
			color: var(--discret);
			font-style: italic;
		}
	}
</style>
