<script lang="ts">
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';
	import { eurosPourChamp, formatQuantite, libellePrix, quantitePourChamp } from '#lib/format.ts';
	import { formatDateHeure, formatJour, versChampParis } from '#lib/heure.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const vente = $derived(data.vente);
	const STATUTS = { brouillon: 'Brouillon', publiee: 'Publiée', archivee: 'Archivée' };
	const UNITE_SAISIE = { piece: 'pièces', botte: 'bottes', kg: 'kg' };

	let produitChoisi = $state<number | undefined>();
	const uniteChoisie = $derived(data.produits.find((p) => p.id === produitChoisi)?.unite);
	const dernierCreneau = $derived(vente.creneaux.at(-1));

	/** Les formulaires d'édition gardent leurs valeurs après envoi. */
	const garder =
		() =>
		async ({ update }: { update: (o?: { reset?: boolean }) => Promise<void> }) =>
			update({ reset: false });
	const erreur = (action: string) => (form?.action === action ? form?.message : undefined);
</script>

<svelte:head><title>Vente – back-office</title></svelte:head>

<p><a href={resolve('/admin')}>← Ventes</a></p>
<h1>
	Commandes jusqu’au {formatDateHeure(vente.cloture)}
	<span class="badge {vente.statut}">{STATUTS[vente.statut]}</span>
</h1>

<section class="carte">
	<form method="POST" action="?/statut" use:enhance class="ligne">
		{#if vente.statut === 'brouillon'}
			<button name="statut" value="publiee">Publier la vente</button>
		{:else if vente.statut === 'publiee'}
			<button name="statut" value="brouillon" class="secondaire">Repasser en brouillon</button>
			<button name="statut" value="archivee" class="secondaire">Archiver</button>
		{:else}
			<button name="statut" value="brouillon" class="secondaire">Désarchiver</button>
		{/if}
	</form>
	<p class="discret">
		{#if vente.statut === 'brouillon'}
			Invisible des clients. Publie-la quand les produits et créneaux sont prêts : les commandes
			seront acceptées entre l’ouverture et la clôture.
		{:else if vente.statut === 'publiee'}
			Visible des clients ; commandes acceptées entre l’ouverture et la clôture.
		{:else}
			Vente terminée, conservée pour l’historique.
		{/if}
	</p>
	{#if erreur('statut')}<p class="erreur">{erreur('statut')}</p>{/if}

	<form method="POST" action="?/dates" use:enhance={garder} class="ligne">
		<label>
			Ouverture des commandes
			<input
				type="datetime-local"
				name="ouverture"
				required
				value={versChampParis(vente.ouverture)}
			/>
		</label>
		<label>
			Clôture des commandes
			<input type="datetime-local" name="cloture" required value={versChampParis(vente.cloture)} />
		</label>
		<button class="secondaire">Enregistrer les dates</button>
	</form>
	{#if erreur('dates')}<p class="erreur">{erreur('dates')}</p>{/if}
	{#if form?.action === 'dates' && form.ok}<p class="ok">Dates enregistrées.</p>{/if}
</section>

<h2>Produits en vente</h2>

{#if vente.offres.length === 0}
	<p class="vide">Aucun produit dans cette vente.</p>
{/if}
{#each vente.offres as offre (offre.id)}
	<div class="carte offre">
		<form method="POST" action="?/modifierOffre" use:enhance={garder} class="ligne">
			<input type="hidden" name="offre" value={offre.id} />
			<strong class="nom">{offre.produit}</strong>
			<label>
				Prix ({libellePrix(offre.unite)})
				<input
					name="prix"
					required
					inputmode="decimal"
					size="6"
					value={eurosPourChamp(offre.prixCentimes)}
				/>
			</label>
			<label>
				Quantité ({UNITE_SAISIE[offre.unite]})
				<input
					name="quantite"
					required
					inputmode="decimal"
					size="6"
					value={quantitePourChamp(offre.unite, offre.qteInitiale)}
				/>
			</label>
			<button class="secondaire">Enregistrer</button>
		</form>
		<p class="discret">
			Commandé : {formatQuantite(offre.unite, offre.qteReservee)} · reste {formatQuantite(
				offre.unite,
				offre.qteInitiale - offre.qteReservee
			)}
			{#if !offre.actif}· produit masqué{/if}
		</p>
		{#if form?.action === 'modifierOffre' && form.offre === offre.id}
			{#if form.message}
				<div class="erreur">
					{form.message}
					{#if form.sousReserve}
						Déjà commandé : {formatQuantite(offre.unite, form.sousReserve.reservee)}. Réduis ou
						annule d’abord ces commandes :
						<ul>
							{#each form.sousReserve.commandes as c (c.reference)}
								<li>{c.reference} – {c.nom} : {formatQuantite(offre.unite, c.quantite)}</li>
							{/each}
						</ul>
					{/if}
				</div>
			{:else}
				<p class="ok">Enregistré.</p>
			{/if}
		{/if}
		{#if offre.qteReservee === 0}
			<form method="POST" action="?/retirerOffre" use:enhance>
				<input type="hidden" name="offre" value={offre.id} />
				<button class="danger">Retirer de la vente</button>
			</form>
		{/if}
		{#if form?.action === 'retirerOffre' && form.offre === offre.id}
			<p class="erreur">{form.message}</p>
		{/if}
	</div>
{/each}

{#if data.produits.length > 0}
	<form
		method="POST"
		action="?/ajouterOffre"
		class="carte"
		use:enhance={() =>
			async ({ result, update }) => {
				await update();
				// Après un ajout, le menu revient sur « Choisir… » : l'unité affichée doit suivre.
				if (result.type === 'success') produitChoisi = undefined;
			}}
	>
		<h3>Ajouter un produit</h3>
		<div class="ligne">
			<label>
				Produit
				<select name="produit" required bind:value={produitChoisi}>
					<option value={undefined} disabled selected>Choisir…</option>
					{#each data.produits as p (p.id)}
						<option value={p.id}>{p.nom}</option>
					{/each}
				</select>
			</label>
			<label>
				Prix ({uniteChoisie ? libellePrix(uniteChoisie) : '€'})
				<input name="prix" required inputmode="decimal" size="6" placeholder="0,80" />
			</label>
			<label>
				Quantité ({uniteChoisie ? UNITE_SAISIE[uniteChoisie] : '…'})
				<input name="quantite" required inputmode="decimal" size="6" />
			</label>
			<button>Ajouter</button>
		</div>
		{#if erreur('ajouterOffre')}<p class="erreur">{erreur('ajouterOffre')}</p>{/if}
	</form>
{:else}
	<p class="discret">
		Tous tes produits actifs sont dans la vente. <a href={resolve('/admin/produits')}
			>Gérer les produits</a
		>
	</p>
{/if}

<h2>Créneaux de retrait</h2>

{#if vente.creneaux.length === 0}
	<p class="vide">Aucun créneau.</p>
{/if}
{#each vente.creneaux as c (c.id)}
	<div class="carte ligne creneau">
		<div>
			<strong>{formatJour(c.date)}</strong>, {c.heureDebut}–{c.heureFin} · {c.lieu}
			<div class="discret">
				{c.nbCommandes} commande{c.nbCommandes > 1 ? 's' : ''}{c.capacite !== null
					? ` sur ${c.capacite}`
					: ''}
			</div>
		</div>
		{#if c.nbCommandes === 0}
			<form method="POST" action="?/retirerCreneau" use:enhance>
				<input type="hidden" name="creneau" value={c.id} />
				<button class="danger">Retirer</button>
			</form>
		{/if}
		{#if form?.action === 'retirerCreneau' && form.creneau === c.id}
			<p class="erreur">{form.message}</p>
		{/if}
	</div>
{/each}

<form method="POST" action="?/ajouterCreneau" use:enhance class="carte">
	<h3>Ajouter un créneau</h3>
	<div class="ligne">
		<label>Jour <input type="date" name="date" required value={dernierCreneau?.date ?? ''} /></label
		>
		<label>
			De <input
				type="time"
				name="heureDebut"
				required
				value={dernierCreneau?.heureDebut ?? '09:00'}
			/>
		</label>
		<label>
			À <input type="time" name="heureFin" required value={dernierCreneau?.heureFin ?? '12:00'} />
		</label>
		<label
			>Lieu <input
				name="lieu"
				required
				value={dernierCreneau?.lieu ?? ''}
				placeholder="À la ferme"
			/></label
		>
		<label>
			Commandes max
			<input name="capacite" inputmode="numeric" size="4" placeholder="sans limite" />
		</label>
		<button>Ajouter</button>
	</div>
	{#if erreur('ajouterCreneau')}<p class="erreur">{erreur('ajouterCreneau')}</p>{/if}
</form>

{#if vente.statut !== 'publiee'}
	<h2>Supprimer</h2>
	<form
		method="POST"
		action="?/supprimer"
		use:enhance={({ cancel }) => {
			if (!confirm('Supprimer définitivement cette vente ?')) cancel();
		}}
	>
		<button class="danger">Supprimer cette vente</button>
		<span class="discret">Possible seulement si elle n’a reçu aucune commande.</span>
	</form>
	{#if erreur('supprimer')}<p class="erreur">{erreur('supprimer')}</p>{/if}
{/if}

<style>
	h1 .badge {
		vertical-align: middle;
		font-size: 0.8rem;
	}
	.offre .nom {
		flex-basis: 100%;
	}
	.offre p,
	.creneau p {
		margin: 0.5rem 0 0;
	}
	.creneau {
		justify-content: space-between;
		align-items: center;
	}
	.erreur ul {
		margin: 0.25rem 0 0;
	}
</style>
