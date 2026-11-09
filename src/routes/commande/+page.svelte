<script lang="ts">
	import { applyAction, enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { NOM_BOUTIQUE } from '#lib/config.ts';
	import { formatEuros, formatQuantite } from '#lib/format.ts';
	import { formatDateHeure, formatJour } from '#lib/heure.ts';
	import { chargerCoordonnees, enregistrerCoordonnees, enregistrerPanier } from '#lib/stockage.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const lignes = $derived(data.recap?.lignes ?? []);
	const aCommander = $derived(lignes.filter((l) => l.quantite > 0));
	const ajustees = $derived(lignes.filter((l) => l.reduite));
	const creneauxLibres = $derived(data.vente?.creneaux.filter((c) => !c.complet) ?? []);

	let nom = $state('');
	let email = $state('');
	let telephone = $state('');
	let envoi = $state(false);
	let mode = $state<'retrait' | 'virement'>('retrait');
	$effect(() => {
		if (form?.mode) mode = form.mode;
	});

	$effect(() => {
		// Valeurs renvoyées après une erreur, sinon coordonnées mémorisées dans ce navigateur.
		const memo = form ?? chargerCoordonnees();
		if (memo) ({ nom, email, telephone } = memo);
	});

	// Si le panier a été ajusté au stock restant, le panier mémorisé suit.
	$effect(() => {
		if (data.vente && ajustees.length > 0) {
			enregistrerPanier(
				data.vente.id,
				Object.fromEntries(aCommander.map((l) => [l.offre.id, l.quantite]))
			);
		}
	});

	// Les quantités restent dans l'URL de l'action pour réafficher le panier après une erreur.
	const action = $derived(`?${page.url.searchParams.toString()}&/commander`);
</script>

<svelte:head><title>Ma commande – {NOM_BOUTIQUE}</title></svelte:head>

<main>
	<p><a href={resolve('/')}>← Continuer mes achats</a></p>
	<h1>Ma commande</h1>

	{#if !data.vente}
		<p class="carte">La vente est terminée : les commandes ne sont plus acceptées.</p>
	{:else if aCommander.length === 0}
		<div class="carte">
			{#if ajustees.length > 0}
				<p>Les produits de votre panier sont épuisés.</p>
			{:else}
				<p>Votre panier est vide.</p>
			{/if}
			<a href={resolve('/')}>Voir les produits</a>
		</div>
	{:else}
		<section class="carte">
			<h2>Votre panier</h2>
			{#if ajustees.length > 0}
				<p class="avert">
					Le stock a changé : {ajustees
						.map((l) =>
							l.quantite > 0
								? `${l.offre.produit} ramené à ${formatQuantite(l.offre.unite, l.quantite)}`
								: `${l.offre.produit} épuisé`
						)
						.join(', ')}.
				</p>
			{/if}
			<table>
				<tbody>
					{#each aCommander as l (l.offre.id)}
						<tr>
							<td>{l.offre.produit}</td>
							<td class="qte">{formatQuantite(l.offre.unite, l.quantite)}</td>
							<td class="montant">{formatEuros(l.prixCentimes)}</td>
						</tr>
					{/each}
				</tbody>
				<tfoot>
					<tr>
						<th colspan="2">Total</th>
						<td class="montant"><strong>{formatEuros(data.recap!.totalCentimes)}</strong></td>
					</tr>
				</tfoot>
			</table>
			<p class="discret">
				Produits au poids : nous servons au plus près du poids commandé, au prix indiqué ici.
			</p>
		</section>

		<form
			method="POST"
			{action}
			use:enhance={() => {
				envoi = true;
				enregistrerCoordonnees({ nom, email, telephone });
				return async ({ result, update }) => {
					if (result.type === 'failure') {
						// Rafraîchir le panier (stock à jour) puis afficher le message.
						await invalidateAll();
						await applyAction(result);
					} else {
						await update();
					}
					envoi = false;
				};
			}}
		>
			{#each aCommander as l (l.offre.id)}
				<input type="hidden" name="o{l.offre.id}" value={l.quantite} />
			{/each}

			<section class="carte">
				<h2>Vos coordonnées</h2>
				<div class="champs">
					<label>
						Nom et prénom
						<input name="nom" required autocomplete="name" bind:value={nom} />
					</label>
					<label>
						E-mail
						<input name="email" type="email" required autocomplete="email" bind:value={email} />
					</label>
					<label>
						Téléphone
						<input name="telephone" type="tel" required autocomplete="tel" bind:value={telephone} />
					</label>
				</div>
			</section>

			<section class="carte">
				<h2>Retrait</h2>
				{#if creneauxLibres.length === 0}
					<p class="erreur">Tous les créneaux sont complets.</p>
				{/if}
				<fieldset>
					<legend class="visuellement-cache">Créneau de retrait</legend>
					{#each data.vente.creneaux as c (c.id)}
						<label class="choix" class:complet={c.complet}>
							<input
								type="radio"
								name="creneau"
								value={c.id}
								required
								disabled={c.complet}
								checked={form?.creneau === c.id ||
									(creneauxLibres.length === 1 && creneauxLibres[0].id === c.id)}
							/>
							<span>
								<strong>{formatJour(c.date)}</strong>, {c.heureDebut}–{c.heureFin}
								<br /><span class="discret">{c.lieu}{c.complet ? ' · complet' : ''}</span>
							</span>
						</label>
					{/each}
				</fieldset>
				<p class="discret">Commandes jusqu’au {formatDateHeure(data.vente.cloture)}.</p>
			</section>

			<section class="carte">
				<h2>Paiement</h2>
				{#if data.virement}
					<fieldset>
						<legend class="visuellement-cache">Mode de paiement</legend>
						<label class="choix">
							<input type="radio" name="mode" value="retrait" bind:group={mode} />
							<span>
								<strong>Au retrait</strong>
								<br /><span class="discret">En espèces ou par chèque.</span>
							</span>
						</label>
						<label class="choix">
							<input type="radio" name="mode" value="virement" bind:group={mode} />
							<span>
								<strong>Par virement</strong>
								<br /><span class="discret">
									Coordonnées bancaires affichées après la commande. Sans paiement dans les délais,
									la commande est annulée.
								</span>
							</span>
						</label>
					</fieldset>
				{:else}
					<input type="hidden" name="mode" value="retrait" />
					<p>Au retrait, en espèces ou par chèque.</p>
				{/if}
			</section>

			<label class="choix cgv">
				<input type="checkbox" name="cgv" value="oui" required />
				<span>
					J’ai lu et j’accepte les
					<a href={resolve('/cgv')} target="_blank">conditions générales de vente</a>.
				</span>
			</label>

			{#if form?.message}<p class="erreur" role="alert">{form.message}</p>{/if}

			<button class="grand" disabled={envoi || creneauxLibres.length === 0}>
				{envoi
					? 'Envoi…'
					: `Commander – je paierai ${formatEuros(data.recap!.totalCentimes)} ${
							mode === 'virement' ? 'par virement' : 'au retrait'
						}`}
			</button>
		</form>
	{/if}
</main>

<style>
	main {
		max-width: 40rem;
	}
	h2 {
		margin-top: 0;
	}
	table {
		width: 100%;
		border-collapse: collapse;
	}
	td,
	th {
		padding: 0.4rem 0;
		border-bottom: 1px solid var(--bord);
		text-align: left;
		font-weight: normal;
	}
	tfoot th,
	tfoot td {
		border-bottom: none;
		padding-top: 0.6rem;
	}
	.qte {
		color: var(--discret);
		padding: 0.4rem 0.5rem;
		white-space: nowrap;
	}
	.montant {
		text-align: right;
		white-space: nowrap;
		font-variant-numeric: tabular-nums;
	}
	.champs {
		display: grid;
		gap: 0.75rem;
	}
	fieldset {
		border: none;
		padding: 0;
		margin: 0;
		display: grid;
		gap: 0.5rem;
	}
	.choix {
		display: flex;
		gap: 0.6rem;
		align-items: flex-start;
		font-size: 1rem;
		color: var(--texte);
		border: 1px solid var(--bord);
		border-radius: 8px;
		padding: 0.6rem 0.75rem;
		cursor: pointer;
	}
	.choix:has(input:checked) {
		border-color: var(--accent);
		background: var(--accent-doux);
	}
	.choix.complet {
		opacity: 0.55;
		cursor: not-allowed;
	}
	.choix input {
		margin-top: 0.25rem;
		accent-color: var(--accent);
	}
	.cgv {
		margin: 0 0 1rem;
		border: none;
		padding: 0;
	}
	.cgv:has(input:checked) {
		background: none;
	}
</style>
