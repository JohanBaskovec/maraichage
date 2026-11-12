<script lang="ts">
	import { enhance } from '$app/forms';
	import { DESCRIPTION_MAX, ILLUSTRATIONS, urlIllustration } from '#lib/illustrations.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	// Formulaire « nouveau produit » piloté par l'état : après un ajout, on vide
	// seulement le nom (une remise à zéro native viderait aussi le pas).
	let nomNouveau = $state('');
	let uniteNouveau = $state<'piece' | 'botte' | 'kg'>('piece');
	let pasNouveau = $state('1');
	let descriptionNouveau = $state('');
	let illustrationNouveau = $state('');
	// Aperçu du dessin choisi dans chaque formulaire de modification.
	let illustrations = $state<Record<number, string>>({});
	const pasParDefaut = (unite: string) => (unite === 'kg' ? '0,5' : '1');

	const UNITES = { piece: 'à la pièce', botte: 'à la botte', kg: 'au kg' };
	const pasPourChamp = (unite: string, pas: number) =>
		unite === 'kg' ? String(pas / 1000).replace('.', ',') : String(pas);
</script>

<svelte:head><title>Produits – back-office</title></svelte:head>

<h1>Produits</h1>
<p class="discret">
	Ton catalogue permanent. Chaque semaine, tu choisis lesquels mettre en vente, avec leur prix et
	leur quantité.
</p>

<form
	method="POST"
	action="?/creer"
	class="carte"
	use:enhance={() =>
		async ({ result, update }) => {
			await update({ reset: false });
			if (result.type === 'success') {
				nomNouveau = '';
				descriptionNouveau = '';
				illustrationNouveau = '';
			}
		}}
>
	<h2>Nouveau produit</h2>
	<div class="ligne">
		<label>Nom <input name="nom" required placeholder="Concombre" bind:value={nomNouveau} /></label>
		<label>
			Vendu
			<select
				name="unite"
				bind:value={uniteNouveau}
				onchange={() => (pasNouveau = pasParDefaut(uniteNouveau))}
			>
				{#each Object.entries(UNITES) as [valeur, libelle] (valeur)}
					<option value={valeur}>{libelle}</option>
				{/each}
			</select>
		</label>
		<label>
			Le client ajoute par
			<span class="avec-unite">
				<input name="pas" required inputmode="decimal" size="5" bind:value={pasNouveau} />
				{uniteNouveau === 'kg' ? 'kg' : uniteNouveau === 'botte' ? 'botte(s)' : 'pièce(s)'}
			</span>
		</label>
	</div>
	<div class="presentation">
		<img src={urlIllustration(illustrationNouveau)} alt="" width="56" height="56" />
		<label>
			Dessin
			<select name="illustration" bind:value={illustrationNouveau}>
				<option value="">Cagette (générique)</option>
				{#each Object.entries(ILLUSTRATIONS) as [cle, libelle] (cle)}
					<option value={cle}>{libelle}</option>
				{/each}
			</select>
		</label>
		<label class="description">
			Description pour les clients (facultative)
			<input
				name="description"
				maxlength={DESCRIPTION_MAX}
				placeholder="Doux et fondant, parfait en velouté"
				bind:value={descriptionNouveau}
			/>
		</label>
	</div>
	<button>Ajouter</button>
	{#if form?.action === 'creer' && form.message}<p class="erreur">{form.message}</p>{/if}
</form>

{#if data.produits.length === 0}
	<p class="vide">Aucun produit pour l’instant.</p>
{:else}
	{#each data.produits as produit (produit.id)}
		<div class="carte" class:inactif={!produit.actif}>
			<form
				method="POST"
				action="?/modifier"
				use:enhance={() =>
					({ update }) =>
						update({ reset: false })}
			>
				<input type="hidden" name="id" value={produit.id} />
				<div class="ligne">
					<label>Nom <input name="nom" required value={produit.nom} /></label>
					<label>
						Vendu
						<select name="unite" value={produit.unite}>
							{#each Object.entries(UNITES) as [valeur, libelle] (valeur)}
								<option value={valeur}>{libelle}</option>
							{/each}
						</select>
					</label>
					<label>
						Pas
						<input
							name="pas"
							required
							inputmode="decimal"
							size="5"
							value={pasPourChamp(produit.unite, produit.pas)}
						/>
					</label>
				</div>
				<div class="presentation">
					<img
						src={urlIllustration(illustrations[produit.id] ?? produit.illustration)}
						alt=""
						width="56"
						height="56"
					/>
					<label>
						Dessin
						<select
							name="illustration"
							value={produit.illustration ?? ''}
							onchange={(e) => (illustrations[produit.id] = e.currentTarget.value)}
						>
							<option value="">Cagette (générique)</option>
							{#each Object.entries(ILLUSTRATIONS) as [cle, libelle] (cle)}
								<option value={cle}>{libelle}</option>
							{/each}
						</select>
					</label>
					<label class="description">
						Description pour les clients
						<input
							name="description"
							maxlength={DESCRIPTION_MAX}
							value={produit.description ?? ''}
						/>
					</label>
				</div>
				<button class="secondaire">Enregistrer</button>
			</form>
			<form method="POST" action="?/actif" use:enhance>
				<input type="hidden" name="id" value={produit.id} />
				<input type="hidden" name="actif" value={produit.actif ? '0' : '1'} />
				<p class="discret">
					{produit.actif ? 'Actif' : 'Masqué : ne sera plus proposé dans les nouvelles ventes.'}
					<button class="secondaire">{produit.actif ? 'Masquer' : 'Réactiver'}</button>
				</p>
			</form>
			{#if form?.action === 'modifier' && form.id === produit.id}
				{#if form.message}<p class="erreur">{form.message}</p>{:else}<p class="ok">
						Enregistré.
					</p>{/if}
			{/if}
		</div>
	{/each}
{/if}

<style>
	.inactif {
		opacity: 0.65;
	}
	.presentation {
		display: flex;
		flex-wrap: wrap;
		align-items: end;
		gap: 0.75rem;
		margin: 0.75rem 0;
	}
	.presentation img {
		flex: none;
		width: 56px;
		height: 56px;
		padding: 4px;
		border-radius: 12px;
		background: var(--feuille-doux);
	}
	.presentation .description {
		flex: 1 1 16rem;
	}
	.presentation .description input {
		width: 100%;
	}
	.avec-unite {
		display: flex;
		gap: 0.4rem;
		align-items: center;
		color: inherit;
	}
</style>
