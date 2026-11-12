<script lang="ts">
	import { resolve } from '$app/paths';
	import EnTeteBoutique from '#lib/composants/EnTeteBoutique.svelte';
	import { NOM_BOUTIQUE } from '#lib/config.ts';
	import { formatEuros, formatQuantite } from '#lib/format.ts';
	import { formatDateHeure, formatJour, formatPlage } from '#lib/heure.ts';
	import { urlIllustration } from '#lib/illustrations.ts';
	import { prixLigneCentimes } from '#lib/prix.ts';
	import { viderPanier } from '#lib/stockage.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const c = $derived(data.commande);
	const active = $derived(['en_attente_paiement', 'confirmee', 'prete'].includes(c.statut));
	const attenteVirement = $derived(c.statut === 'en_attente_paiement' && !!c.paiementAvant);

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

	const majuscule = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
	const jour = $derived(majuscule(formatJour(c.creneau.date)));
	const plage = $derived(formatPlage(c.creneau.heureDebut, c.creneau.heureFin));
	const etat = $derived(
		c.statut === 'en_attente_paiement'
			? 'En attente du virement'
			: c.statut === 'annulee'
				? 'Annulée'
				: c.statut === 'recuperee'
					? 'Récupérée'
					: c.statut === 'non_recuperee'
						? 'Non récupérée'
						: c.payee
							? 'Payée'
							: c.statut === 'prete'
								? 'Prête'
								: 'Confirmée'
	);
</script>

<svelte:head>
	<title>Commande {c.reference} – {NOM_BOUTIQUE}</title>
	<meta name="robots" content="noindex" />
</svelte:head>

{#snippet iconeCopier()}
	<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" class="trait">
		<rect x="8" y="8" width="12" height="12" rx="2.5" />
		<path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
	</svg>
{/snippet}

<EnTeteBoutique>
	<a class="retour" href={resolve('/')}>
		<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" class="trait">
			<path d="M19 12H5M11 6l-6 6 6 6" />
		</svg>
		Retour à la boutique
	</a>
</EnTeteBoutique>

<main>
	<section class="bandeau motif-sombre">
		<div class="accroche">
			{#if c.statut === 'annulee'}
				<p class="manuscrit">C’est noté.</p>
				<h1>Commande annulée</h1>
				<p class="chapo">Les légumes ont été remis en vente. À bientôt peut-être !</p>
			{:else if c.statut === 'recuperee'}
				<p class="manuscrit">Bon appétit !</p>
				<h1>Commande récupérée</h1>
				<p class="chapo">Merci, et à bientôt !</p>
			{:else}
				<p class="manuscrit">Merci {c.nom.split(' ')[0]} !</p>
				<h1>Vos légumes sont réservés.</h1>
				{#if active}
					<p class="chapo">
						La confirmation est partie à {c.email}. Gardez bien votre référence : elle sert
						{attenteVirement ? 'pour le virement et ' : ''}au retrait.
					</p>
				{/if}
			{/if}
			<div class="reference">
				<span class="libelle">
					<span>Référence</span>
					<strong>{c.reference}</strong>
				</span>
				<button
					type="button"
					class="copier"
					onclick={() => copier('reference', c.reference)}
					aria-label="Copier la référence {c.reference}"
				>
					{@render iconeCopier()}
					{copie === 'reference' ? 'Copié' : 'Copier'}
				</button>
			</div>
		</div>
		<img class="illustration" src="/illustrations/potager.svg" alt="" width="320" height="260" />
	</section>

	<div class="colonnes">
		<div class="principal">
			{#if attenteVirement}
				<section class="carte virement" aria-labelledby="titre-virement">
					<div class="titre-virement">
						<h2 id="titre-virement">
							<span class="pastille" aria-hidden="true">
								<svg width="22" height="22" viewBox="0 0 24 24" class="trait">
									<path d="M3 10l9-6 9 6" />
									<path d="M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18" />
								</svg>
							</span>
							Réglez par virement
						</h2>
						<span class="echeance">À faire avant le {formatDateHeure(c.paiementAvant!)}</span>
					</div>
					{#if data.virement}
						<dl>
							<div>
								<dt>Bénéficiaire</dt>
								<dd>{data.virement.titulaire}</dd>
							</div>
							<div>
								<dt>Montant</dt>
								<dd>{formatEuros(c.totalCentimes)}</dd>
							</div>
							<div>
								<dt>IBAN</dt>
								<dd>
									<code>{data.virement.iban}</code>
									<button
										type="button"
										class="copier petit"
										onclick={() => copier('iban', data.virement!.iban)}
										aria-label="Copier l’IBAN"
									>
										{@render iconeCopier()}
										{copie === 'iban' ? 'Copié' : 'Copier'}
									</button>
								</dd>
							</div>
							{#if data.virement.bic}
								<div>
									<dt>BIC</dt>
									<dd><code>{data.virement.bic}</code></dd>
								</div>
							{/if}
							<div class="libelle-virement">
								<dt>Libellé à indiquer</dt>
								<dd>
									<code>{c.reference}</code>
									<button
										type="button"
										class="copier petit"
										onclick={() => copier('libelle', c.reference)}
										aria-label="Copier le libellé {c.reference}"
									>
										{@render iconeCopier()}
										{copie === 'libelle' ? 'Copié' : 'Copier'}
									</button>
								</dd>
							</div>
						</dl>
						<div class="qr">
							{#if data.qrVirement}
								<!-- eslint-disable-next-line svelte/no-at-html-tags -- SVG généré par le serveur (src/lib/server/qrcode.ts), sans donnée brute -->
								<div class="code">{@html data.qrVirement}</div>
							{/if}
							<p>
								Scannez ce code depuis votre application bancaire si elle le permet, sinon recopiez
								l’IBAN. Sans virement reçu à temps, la commande est annulée automatiquement et les
								légumes sont remis en vente.
							</p>
						</div>
					{:else}
						<p class="avert">
							Les coordonnées bancaires sont momentanément indisponibles : contactez-nous pour
							régler votre commande.
						</p>
					{/if}
				</section>
			{/if}

			{#if active}
				<section class="carte">
					<h2>Et ensuite ?</h2>
					<ol class="suite">
						{#if attenteVirement}
							<li>
								<span class="point soleil" aria-hidden="true"></span>
								<span>
									<strong>Avant le {formatDateHeure(c.paiementAvant!)}</strong>
									Vous faites le virement avec la référence {c.reference}.
								</span>
							</li>
						{/if}
						<li>
							<span class="point feuille" aria-hidden="true"></span>
							<span>
								<strong>La veille du retrait</strong>
								Un e-mail de rappel, avec un lien pour annuler en cas d’imprévu.
							</span>
						</li>
						<li>
							<span class="point tomate" aria-hidden="true"></span>
							<span>
								<strong>{jour}, {plage}</strong>
								Vous venez chercher votre commande, préparée et prête à emporter.
								{#if c.modePaiement === 'retrait' && !c.payee}
									Vous réglez {formatEuros(c.totalCentimes)} sur place, en espèces ou par chèque.
								{:else if c.payee}
									Virement reçu, merci.
								{/if}
							</span>
						</li>
					</ol>
				</section>

				{#if new Date() < c.limiteAnnulation}
					<p class="annulation">
						Un empêchement ?
						<a href={resolve('/annuler/[jeton]', { jeton: c.jetonAnnulation })}>
							Annuler ma commande
						</a>
						(possible jusqu’au {formatDateHeure(c.limiteAnnulation)}).
					</p>
				{/if}
			{/if}
		</div>

		<aside class="cote" aria-label="Votre retrait et votre commande">
			{#if active}
				<section class="rendez-vous motif-clair" aria-labelledby="titre-rdv">
					<p class="manuscrit">rendez-vous</p>
					<h2 id="titre-rdv">{jour}</h2>
					<p class="plage">{plage}</p>
					<p class="lieu">
						<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" class="trait">
							<path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z" />
							<circle cx="12" cy="10" r="2.5" />
						</svg>
						<span>{c.creneau.lieu}</span>
					</p>
					<p class="conseil">Pensez à apporter un sac ou une cagette.</p>
				</section>
			{/if}

			<section class="cagette" aria-labelledby="titre-cagette">
				<header class="motif-sombre">
					<p class="manuscrit">Votre cagette</p>
					<h2 id="titre-cagette">
						{c.lignes.length} produit{c.lignes.length > 1 ? 's' : ''}
					</h2>
				</header>
				<ul>
					{#each c.lignes as l (l.produit)}
						<li>
							<img src={urlIllustration(l.illustration)} alt="" />
							<span class="produit-ligne">
								<strong>{l.produit}</strong>
								<span>{formatQuantite(l.unite, l.quantite)}</span>
							</span>
							<span class="montant">
								{formatEuros(prixLigneCentimes(l.unite, l.prixUnitaireCentimes, l.quantite))}
							</span>
						</li>
					{/each}
				</ul>
				<div class="total">
					<span>Total</span>
					<strong>{formatEuros(c.totalCentimes)}</strong>
				</div>
				<p class="etat">
					<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" class="trait">
						<circle cx="12" cy="12" r="9" />
						<path d="M12 7v5l3 2" />
					</svg>
					{etat}
				</p>
			</section>
		</aside>
	</div>

	<p class="question">Une question ? Répondez simplement à l’e-mail de confirmation.</p>
</main>

<style>
	.trait {
		fill: none;
		stroke: currentColor;
		stroke-width: 2.2;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.retour {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		min-height: 44px;
		font-weight: 600;
		text-decoration: none;
	}

	/* Bandeau de remerciement */
	.bandeau {
		border-radius: 28px;
		overflow: hidden;
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		justify-content: space-between;
		gap: 0.5rem 2rem;
		padding: 2.5rem 2.5rem 0;
	}
	.accroche {
		flex: 1 1 26rem;
		min-width: 0;
		padding-bottom: 2.5rem;
	}
	.accroche .manuscrit {
		color: var(--soleil);
		font-size: 2.1rem;
		margin-bottom: 0.4rem;
	}
	.accroche h1 {
		margin: 0;
		font-size: clamp(2.2rem, 4.6vw, 3.5rem);
		line-height: 1.04;
		letter-spacing: -0.025em;
	}
	.chapo {
		margin: 1rem 0 0;
		max-width: 33rem;
		font-size: 1.125rem;
		line-height: 1.6;
		color: var(--feuille-pale);
		overflow-wrap: anywhere;
	}
	.illustration {
		flex: 0 1 20rem;
		min-width: 0;
		width: 100%;
		height: auto;
		display: block;
	}
	.reference {
		margin-top: 1.6rem;
		display: inline-flex;
		align-items: center;
		gap: 1rem;
		padding: 0.6rem 0.6rem 0.6rem 1.4rem;
		border-radius: 18px;
		background: var(--soleil);
		color: var(--foret);
	}
	.reference .libelle {
		display: flex;
		flex-direction: column;
		line-height: 1.1;
	}
	.reference .libelle span {
		font-size: 0.8rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}
	.reference strong {
		font-family: var(--police-titre);
		font-weight: 800;
		font-size: 2rem;
		letter-spacing: 0.06em;
	}
	.copier {
		min-height: 48px;
		padding: 0 1rem;
		border-radius: 12px;
		border: 2px solid var(--foret);
		background: var(--soleil-clair);
		color: var(--foret);
		font-size: 0.95rem;
	}
	.copier:hover:not(:disabled) {
		background: var(--foret);
		color: var(--creme);
	}
	.copier.petit {
		min-height: 44px;
		background: var(--carte);
	}

	/* Colonnes */
	.colonnes {
		margin-top: 1.75rem;
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		gap: 1.75rem;
	}
	.principal {
		flex: 999 1 35rem;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}
	.principal .carte {
		margin: 0;
	}
	.principal h2 {
		margin: 0 0 1.25rem;
	}
	.cote {
		flex: 1 1 20rem;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	/* Virement */
	.virement {
		border: 2px solid var(--soleil);
	}
	.titre-virement {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.6rem 1rem;
		margin-bottom: 1.25rem;
	}
	.titre-virement h2 {
		margin: 0;
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}
	.pastille {
		width: 40px;
		height: 40px;
		flex: none;
		border-radius: 12px;
		background: var(--feuille-doux);
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.echeance {
		padding: 0.35rem 0.9rem;
		border-radius: 999px;
		background: var(--tomate-pale);
		color: var(--erreur);
		font-size: 0.875rem;
		font-weight: 700;
	}
	dl {
		margin: 0;
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
		gap: 0.9rem 1.75rem;
	}
	dl > div {
		padding-bottom: 0.75rem;
		border-bottom: 1px dashed var(--bord-fort);
	}
	dt {
		font-size: 0.8rem;
		font-weight: 700;
		color: var(--discret);
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}
	dd {
		margin: 0.15rem 0 0;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem 0.75rem;
		font-size: 1.05rem;
		font-weight: 600;
	}
	code {
		font-family: inherit;
		letter-spacing: 0.03em;
		overflow-wrap: break-word;
	}
	.libelle-virement {
		grid-column: 1 / -1;
		padding: 0.9rem 1rem !important;
		border: none !important;
		border-radius: 14px;
		background: var(--soleil-pale);
	}
	.libelle-virement dd {
		justify-content: space-between;
	}
	.libelle-virement code {
		font-family: var(--police-titre);
		font-size: 1.5rem;
		font-weight: 800;
		letter-spacing: 0.06em;
	}
	.qr {
		margin-top: 1.25rem;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 1rem 1.25rem;
	}
	.qr .code {
		width: 132px;
		flex: none;
		padding: 4px;
		border: 1px solid var(--bord);
		border-radius: 14px;
		background: var(--blanc);
	}
	.qr .code :global(svg) {
		display: block;
		width: 100%;
		height: auto;
	}
	.qr p {
		flex: 1 1 16rem;
		margin: 0;
		font-size: 0.95rem;
		line-height: 1.55;
		color: var(--discret);
	}

	/* Et ensuite ? */
	.suite {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.suite li {
		position: relative;
		display: flex;
		gap: 1rem;
		padding-bottom: 1.1rem;
	}
	.suite li:not(:last-child)::before {
		content: '';
		position: absolute;
		left: 8px;
		top: 20px;
		bottom: 0;
		width: 2px;
		background: var(--bord-fort);
	}
	.suite li:last-child {
		padding-bottom: 0;
	}
	.suite strong {
		display: block;
	}
	.suite li > span:last-child {
		margin-top: -3px;
		color: var(--discret);
	}
	.suite li strong {
		color: var(--foret);
	}
	.point {
		width: 18px;
		height: 18px;
		flex: none;
		border-radius: 999px;
		border: 2.5px solid var(--foret);
	}
	.point.soleil {
		background: var(--soleil);
	}
	.point.feuille {
		background: var(--feuille-pale);
	}
	.point.tomate {
		background: var(--tomate);
	}
	.annulation {
		margin: 0;
		color: var(--discret);
	}

	/* Rendez-vous */
	.rendez-vous {
		padding: 1.5rem;
		border-radius: var(--rayon);
	}
	.rendez-vous h2 {
		margin: 0.1rem 0 0;
		font-size: 1.6rem;
		font-weight: 800;
	}
	.rendez-vous p {
		margin: 0;
	}
	.plage {
		margin-top: 0.25rem !important;
		font-family: var(--police-titre);
		font-weight: 700;
		font-size: 1.4rem;
	}
	.lieu {
		margin-top: 0.9rem !important;
		display: flex;
		gap: 0.6rem;
		align-items: flex-start;
	}
	.lieu svg {
		flex: none;
		margin-top: 2px;
	}
	.conseil {
		margin-top: 0.9rem !important;
		padding: 0.75rem 0.9rem;
		border-radius: 14px;
		background: var(--carte);
		font-size: 0.95rem;
	}
	.cagette .total {
		padding-bottom: 0.5rem;
	}
	.etat {
		margin: 0 1.5rem 1.4rem;
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.35rem 0.75rem;
		border-radius: 999px;
		background: rgb(232 180 74 / 0.16);
		color: #f2d48a;
		font-size: 0.875rem;
		font-weight: 600;
	}
	.question {
		margin: 2.5rem 0 0;
		text-align: center;
		color: var(--discret);
	}

	@media (max-width: 40rem) {
		main {
			padding: 1rem 1rem 3rem;
		}
		.bandeau {
			padding: 1.75rem 1.25rem 0;
			border-radius: 22px;
		}
		.accroche {
			padding-bottom: 1.75rem;
		}
		.illustration {
			display: none;
		}
		.reference {
			display: flex;
			justify-content: space-between;
			padding-left: 1rem;
		}
		.carte {
			padding: 1.25rem;
		}
	}
</style>
