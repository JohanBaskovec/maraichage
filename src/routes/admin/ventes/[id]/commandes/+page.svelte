<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { formatEuros, formatQuantite } from '#lib/format.ts';
	import { formatDateHeure, formatJour } from '#lib/heure.ts';
	import { prixLigneCentimes } from '#lib/prix.ts';
	import { FILTRES_STATUT, LIBELLES_STATUT_COMMANDE } from '#lib/statuts.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const lienVente = $derived(resolve('/admin/ventes/[id]', { id: String(data.vente.id) }));
	const lienPreparation = $derived(
		resolve('/admin/ventes/[id]/preparation', { id: String(data.vente.id) })
	);
	const actives = ['en_attente_paiement', 'confirmee', 'prete'];

	/** Les filtres s'appliquent dès qu'on change un menu (avec JavaScript). */
	const appliquer = (e: Event) => (e.currentTarget as HTMLElement).closest('form')?.requestSubmit();
</script>

<svelte:head><title>Commandes – back-office</title></svelte:head>

<p class="pas-imprime"><a href={lienVente}>← Vente</a></p>
<h1>Commandes</h1>
<p class="discret">Commandes jusqu’au {formatDateHeure(data.vente.cloture)}.</p>

<form method="GET" class="carte ligne filtres pas-imprime" data-sveltekit-keepfocus>
	<label>
		Créneau
		<select name="creneau" value={data.filtres.creneauId ?? ''} onchange={appliquer}>
			<option value="">Tous</option>
			{#each data.vente.creneaux as c (c.id)}
				<option value={c.id}>{formatJour(c.date)} {c.heureDebut} · {c.lieu}</option>
			{/each}
		</select>
	</label>
	<label>
		Statut
		<select name="statut" value={data.filtres.statut} onchange={appliquer}>
			{#each Object.entries(FILTRES_STATUT) as [valeur, libelle] (valeur)}
				<option value={valeur}>{libelle}</option>
			{/each}
		</select>
	</label>
	<label>
		Rechercher
		<input
			name="q"
			type="search"
			value={data.filtres.recherche}
			placeholder="Nom, référence, téléphone"
		/>
	</label>
	<button class="secondaire">Filtrer</button>
</form>

<p class="resume">
	<strong>{data.resume.nombre} commande{data.resume.nombre > 1 ? 's' : ''}</strong>
	· à encaisser {formatEuros(data.resume.aEncaisserCentimes)} · encaissé {formatEuros(
		data.resume.encaisseCentimes
	)}
	· <a href={lienPreparation}>Récap de préparation</a>
</p>

{#if data.commandes.length === 0}
	<p class="vide">Aucune commande{data.filtres.recherche ? ' pour cette recherche' : ''}.</p>
{/if}

{#each data.commandes as c (c.id)}
	<article class="carte commande" class:terminee={!actives.includes(c.statut)}>
		<header>
			<div>
				<strong class="reference">{c.reference}</strong>
				<strong>{c.nom}</strong>
			</div>
			<div class="badges">
				<span class="badge statut-{c.statut}">{LIBELLES_STATUT_COMMANDE[c.statut]}</span>
				{#if c.statut !== 'annulee'}
					<span class="badge" class:payee={c.payee}>{c.payee ? 'Payée' : 'Non payée'}</span>
				{/if}
			</div>
		</header>
		<p class="discret">
			{formatJour(c.creneau.date)}, {c.creneau.heureDebut}–{c.creneau.heureFin} · {c.creneau.lieu}
			<br />
			<a href="tel:{c.telephone}">{c.telephone.replace(/(\d{2})(?=\d)/g, '$1 ')}</a> ·
			<a href="mailto:{c.email}">{c.email}</a>
		</p>
		<ul class="lignes">
			{#each c.lignes as l (l.produit)}
				<li>
					<span>{l.produit}</span>
					<span class="qte">{formatQuantite(l.unite, l.quantite)}</span>
					<span class="montant"
						>{formatEuros(prixLigneCentimes(l.unite, l.prixUnitaireCentimes, l.quantite))}</span
					>
				</li>
			{/each}
			<li class="total">
				<span>Total</span><span></span><span class="montant">{formatEuros(c.totalCentimes)}</span>
			</li>
		</ul>

		{#if c.statut !== 'annulee'}
			<div class="actions pas-imprime">
				<form method="POST" action="?/payee" use:enhance>
					<input type="hidden" name="commande" value={c.id} />
					<input type="hidden" name="payee" value={c.payee ? '0' : '1'} />
					<button class={c.payee ? 'secondaire' : ''}>
						{c.payee ? 'Annuler le paiement' : 'Payée'}
					</button>
				</form>
				<form method="POST" action="?/statut" use:enhance class="ligne">
					<input type="hidden" name="commande" value={c.id} />
					{#if c.statut === 'confirmee'}
						<button name="statut" value="prete" class="secondaire">Prête</button>
					{/if}
					{#if c.statut === 'confirmee' || c.statut === 'prete'}
						<button name="statut" value="recuperee">Récupérée</button>
					{:else if c.statut === 'recuperee'}
						<button name="statut" value="confirmee" class="secondaire">Remettre à retirer</button>
					{/if}
				</form>
				{#if actives.includes(c.statut)}
					<form
						method="POST"
						action="?/annuler"
						use:enhance={({ cancel }) => {
							if (
								!confirm(
									`Annuler la commande ${c.reference} de ${c.nom} ? Le stock sera remis en vente.`
								)
							)
								cancel();
						}}
					>
						<input type="hidden" name="commande" value={c.id} />
						<button class="danger">Annuler la commande</button>
					</form>
				{/if}
			</div>
		{/if}
		{#if form?.commande === c.id && form.message}<p class="erreur">{form.message}</p>{/if}
	</article>
{/each}

<style>
	.filtres label {
		flex: 1 1 10rem;
	}
	.resume {
		margin: 0 0 1rem;
	}
	.commande header {
		display: flex;
		justify-content: space-between;
		gap: 0.5rem;
		flex-wrap: wrap;
	}
	.reference {
		font-variant-numeric: tabular-nums;
		letter-spacing: 0.04em;
		margin-right: 0.5rem;
	}
	.badges {
		display: flex;
		gap: 0.35rem;
		flex-wrap: wrap;
	}
	.badge.payee,
	.badge.statut-recuperee {
		border-color: var(--accent);
		color: var(--accent);
	}
	.badge.statut-prete {
		background: var(--accent-doux);
	}
	.badge.statut-annulee {
		border-color: var(--erreur);
		color: var(--erreur);
	}
	.terminee {
		opacity: 0.75;
	}
	.commande p {
		margin: 0.4rem 0;
	}
	.lignes {
		list-style: none;
		padding: 0;
		margin: 0.5rem 0;
	}
	.lignes li {
		display: grid;
		grid-template-columns: 1fr auto 5.5rem;
		gap: 0.5rem;
		padding: 0.2rem 0;
		border-bottom: 1px solid var(--bord);
	}
	.lignes .total {
		border-bottom: none;
		font-weight: 600;
	}
	.qte {
		color: var(--discret);
	}
	.montant {
		text-align: right;
		font-variant-numeric: tabular-nums;
	}
	.actions {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
		margin-top: 0.75rem;
	}
	.actions .ligne {
		gap: 0.5rem;
	}
</style>
