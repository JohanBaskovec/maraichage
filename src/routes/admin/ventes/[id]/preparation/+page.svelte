<script lang="ts">
	import { resolve } from '$app/paths';
	import { formatEuros, formatQuantite } from '#lib/format.ts';
	import { formatDateHeure, formatJour } from '#lib/heure.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const id = $derived(String(data.vente.id));
	const appliquer = (e: Event) => (e.currentTarget as HTMLElement).closest('form')?.requestSubmit();
</script>

<svelte:head><title>Préparation – back-office</title></svelte:head>

<p class="pas-imprime">
	<a href={resolve('/admin/ventes/[id]/commandes', { id })}>← Commandes</a>
</p>
<h1>
	Préparation
	{#if data.creneau}
		– {formatJour(data.creneau.date)}, {data.creneau.heureDebut}–{data.creneau.heureFin} ·
		{data.creneau.lieu}
	{/if}
</h1>
<p class="discret">
	Commandes à retirer · vente ouverte jusqu’au {formatDateHeure(data.vente.cloture)}.
</p>

<div class="carte ligne pas-imprime">
	<form method="GET">
		<label>
			Créneau
			<select name="creneau" value={data.creneau?.id ?? ''} onchange={appliquer}>
				<option value="">Tous</option>
				{#each data.vente.creneaux as c (c.id)}
					<option value={c.id}>{formatJour(c.date)} {c.heureDebut} · {c.lieu}</option>
				{/each}
			</select>
		</label>
		<noscript><button class="secondaire">Afficher</button></noscript>
	</form>
	<button type="button" onclick={() => window.print()}>Imprimer</button>
</div>

{#if data.fiches.length === 0}
	<p class="vide">Aucune commande à préparer.</p>
{:else}
	<section>
		<h2>À cueillir</h2>
		<table class="carte totaux">
			<thead>
				<tr><th>Produit</th><th>Quantité</th><th>Commandes</th></tr>
			</thead>
			<tbody>
				{#each data.totaux as t (t.produit)}
					<tr>
						<td>{t.produit}</td>
						<td><strong>{formatQuantite(t.unite, t.quantite)}</strong></td>
						<td>{t.nbCommandes}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</section>

	<section>
		<h2>Sacs ({data.fiches.length})</h2>
		<div class="fiches">
			{#each data.fiches as f (f.id)}
				<article class="carte fiche">
					<header>
						<strong class="reference">{f.reference}</strong>
						<strong>{f.nom}</strong>
					</header>
					<p class="discret">
						{formatJour(f.creneau.date)}, {f.creneau.heureDebut}–{f.creneau.heureFin} · {f.creneau
							.lieu}
						· {f.telephone.replace(/(\d{2})(?=\d)/g, '$1 ')}
					</p>
					<ul>
						{#each f.lignes as l (l.produit)}
							<li>
								<span class="case" aria-hidden="true"></span>
								<span>{l.produit}</span>
								<strong>{formatQuantite(l.unite, l.quantite)}</strong>
							</li>
						{/each}
					</ul>
					<p class="paiement">
						{f.payee
							? 'Payée'
							: f.statut === 'en_attente_paiement'
								? `Virement attendu : ${formatEuros(f.totalCentimes)}`
								: `À encaisser : ${formatEuros(f.totalCentimes)}`}
					</p>
				</article>
			{/each}
		</div>
	</section>
{/if}

<style>
	h1 {
		font-size: 1.35rem;
	}
	.totaux {
		width: 100%;
		border-collapse: separate;
		border-spacing: 0;
		padding: 0.5rem 1rem;
	}
	.totaux th,
	.totaux td {
		text-align: left;
		padding: 0.4rem 0.5rem 0.4rem 0;
		border-bottom: 1px solid var(--bord);
	}
	.totaux th {
		color: var(--discret);
		font-weight: normal;
		font-size: 0.9rem;
	}
	.totaux tr:last-child td {
		border-bottom: none;
	}
	.fiches {
		display: grid;
		gap: 0.75rem;
	}
	@media (min-width: 40rem) {
		.fiches {
			grid-template-columns: 1fr 1fr;
		}
	}
	.fiche {
		margin: 0;
		break-inside: avoid;
	}
	.fiche header {
		display: flex;
		gap: 0.6rem;
		flex-wrap: wrap;
	}
	.reference {
		font-variant-numeric: tabular-nums;
		letter-spacing: 0.04em;
	}
	.fiche p {
		margin: 0.3rem 0;
	}
	.fiche ul {
		list-style: none;
		padding: 0;
		margin: 0.5rem 0;
	}
	.fiche li {
		display: grid;
		grid-template-columns: auto 1fr auto;
		gap: 0.5rem;
		align-items: center;
		padding: 0.2rem 0;
	}
	.case {
		width: 0.9rem;
		height: 0.9rem;
		border: 1.5px solid var(--discret);
		border-radius: 3px;
	}
	.paiement {
		font-weight: 600;
	}
</style>
