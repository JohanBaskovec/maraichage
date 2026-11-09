<script lang="ts">
	import { resolve } from '$app/paths';
	import { NOM_BOUTIQUE } from '#lib/config.ts';
	import { formatEuros, formatQuantite } from '#lib/format.ts';
	import { formatDateHeure, formatJour } from '#lib/heure.ts';
	import { prixLigneCentimes } from '#lib/prix.ts';
	import { viderPanier } from '#lib/stockage.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const c = $derived(data.commande);
	const active = $derived(['en_attente_paiement', 'confirmee', 'prete'].includes(c.statut));

	$effect(() => {
		viderPanier(c.venteId);
	});

	let copie = $state<string | null>(null);
	async function copier(quoi: string, texte: string) {
		try {
			await navigator.clipboard.writeText(texte.replace(/\s/g, ''));
			copie = quoi;
			setTimeout(() => (copie = null), 2000);
		} catch {
			// Presse-papiers indisponible : le texte reste sélectionnable.
		}
	}
</script>

<svelte:head>
	<title>Commande {c.reference} – {NOM_BOUTIQUE}</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<main>
	{#if c.statut === 'annulee'}
		<h1>Commande annulée</h1>
	{:else if c.statut === 'recuperee'}
		<h1>Commande récupérée</h1>
		<p>Merci, et à bientôt !</p>
	{:else}
		<h1>Merci {c.nom.split(' ')[0]}, votre commande est enregistrée</h1>
	{/if}

	{#if c.statut === 'en_attente_paiement' && c.paiementAvant}
		<section class="carte virement" aria-labelledby="titre-virement">
			<h2 id="titre-virement">
				À payer par virement avant le {formatDateHeure(c.paiementAvant)}
			</h2>
			{#if data.virement}
				<dl>
					<dt>Montant</dt>
					<dd><strong>{formatEuros(c.totalCentimes)}</strong></dd>
					<dt>Bénéficiaire</dt>
					<dd>{data.virement.titulaire}</dd>
					<dt>IBAN</dt>
					<dd>
						<code>{data.virement.iban}</code>
						<button
							type="button"
							class="secondaire copier"
							onclick={() => copier('iban', data.virement!.iban)}
						>
							{copie === 'iban' ? 'Copié' : 'Copier'}
						</button>
					</dd>
					{#if data.virement.bic}
						<dt>BIC</dt>
						<dd><code>{data.virement.bic}</code></dd>
					{/if}
					<dt>Libellé du virement</dt>
					<dd>
						<code>{c.reference}</code>
						<button
							type="button"
							class="secondaire copier"
							onclick={() => copier('reference', c.reference)}
						>
							{copie === 'reference' ? 'Copié' : 'Copier'}
						</button>
					</dd>
				</dl>
				<p class="discret">
					Indiquez bien la référence <strong>{c.reference}</strong> dans le libellé. Sans virement reçu
					à temps, la commande est annulée automatiquement et les produits remis en vente.
				</p>
			{:else}
				<p class="avert">
					Les coordonnées bancaires sont momentanément indisponibles : contactez-nous pour régler
					votre commande.
				</p>
			{/if}
		</section>
	{/if}

	<section class="carte reference">
		<span class="discret">Votre référence</span>
		<strong>{c.reference}</strong>
		{#if active}
			<span class="discret">À donner au retrait. Notez-la ou gardez cette page.</span>
		{/if}
	</section>

	{#if active}
		<section class="carte">
			<h2>Retrait</h2>
			<p>
				<strong>{formatJour(c.creneau.date)}</strong>, entre {c.creneau.heureDebut} et
				{c.creneau.heureFin}
				<br />{c.creneau.lieu}
			</p>
			<p class="discret">
				{#if c.modePaiement === 'retrait'}
					Paiement au retrait, en espèces ou par chèque.
				{:else if c.payee}
					Virement reçu, merci.
				{/if}
			</p>
		</section>
	{/if}

	<section class="carte">
		<h2>Détail</h2>
		<table>
			<tbody>
				{#each c.lignes as l (l.produit)}
					<tr>
						<td>{l.produit}</td>
						<td class="qte">{formatQuantite(l.unite, l.quantite)}</td>
						<td class="montant">
							{formatEuros(prixLigneCentimes(l.unite, l.prixUnitaireCentimes, l.quantite))}
						</td>
					</tr>
				{/each}
			</tbody>
			<tfoot>
				<tr>
					<th colspan="2">Total</th>
					<td class="montant"><strong>{formatEuros(c.totalCentimes)}</strong></td>
				</tr>
			</tfoot>
		</table>
	</section>

	{#if active && new Date() < c.limiteAnnulation}
		<p class="discret">
			Un empêchement ?
			<a href={resolve('/annuler/[jeton]', { jeton: c.jetonAnnulation })}>Annuler ma commande</a>
			(possible jusqu’au {formatDateHeure(c.limiteAnnulation)}).
		</p>
	{/if}

	<p><a href={resolve('/')}>Retour à la boutique</a></p>
</main>

<style>
	main {
		max-width: 40rem;
	}
	h2 {
		margin-top: 0;
	}
	.virement {
		border-color: var(--accent);
	}
	dl {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 0.4rem 0.75rem;
		margin: 0.75rem 0;
		align-items: center;
	}
	dt {
		color: var(--discret);
		font-size: 0.9rem;
	}
	dd {
		margin: 0;
		display: flex;
		gap: 0.5rem;
		align-items: center;
		flex-wrap: wrap;
	}
	code {
		font-size: 0.95rem;
		/* À la ligne entre les groupes de 4, jamais au milieu. */
		overflow-wrap: break-word;
	}
	.copier {
		padding: 0.15rem 0.6rem;
		font-size: 0.85rem;
	}
	.reference {
		display: grid;
		gap: 0.25rem;
		text-align: center;
	}
	.reference strong {
		font-size: 2rem;
		letter-spacing: 0.08em;
		font-variant-numeric: tabular-nums;
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
	}
</style>
