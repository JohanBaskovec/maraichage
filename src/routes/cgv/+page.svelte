<script lang="ts">
	import { resolve } from '$app/paths';
	import PageLegale from '#lib/composants/PageLegale.svelte';
	import {
		ABSENCES_AVANT_BLOCAGE,
		ANNULATION_HEURES_AVANT_RETRAIT,
		DELAI_VIREMENT_HEURES,
		INFOS_LEGALES as I,
		MAX_PAS_PAR_PRODUIT,
		NOM_BOUTIQUE
	} from '#lib/config.ts';
</script>

<PageLegale titre="Conditions générales de vente" majLe="9 novembre 2026">
	<h2>1. Vendeur</h2>
	<p>
		Les produits sont vendus par {I.exploitant}, {I.statut.toLowerCase()} ({NOM_BOUTIQUE}), SIRET
		{I.siret}, {I.adresse}, <a href="mailto:{I.email}">{I.email}</a>, {I.telephone}. Les présentes
		conditions s’appliquent à toute commande passée sur ce site par un particulier.
	</p>

	<h2>2. Produits</h2>
	<p>
		Fruits et légumes frais de l’exploitation, selon la récolte de la semaine et dans la limite des
		quantités affichées. Pour qu’un maximum de clients puisse en profiter, une commande est limitée
		à {MAX_PAS_PAR_PRODUIT} unités d’ajout par produit (par exemple {MAX_PAS_PAR_PRODUIT} pièces, ou {MAX_PAS_PAR_PRODUIT /
			2} kg pour un produit vendu par 500 g).
	</p>

	<h2>3. Prix</h2>
	<p>
		Les prix sont indiqués en euros, toutes taxes comprises, à la pièce, à la botte ou au
		kilogramme. Le prix appliqué est celui affiché au moment de la commande.
	</p>
	<p>
		<strong>Produits vendus au poids</strong> : ils sont servis au plus près du poids commandé. Le prix
		payé reste celui de la commande, que le poids servi soit légèrement supérieur ou inférieur.
	</p>

	<h2>4. Commande</h2>
	<p>
		Les commandes sont ouvertes pendant la période indiquée sur la boutique. Pour commander, vous
		choisissez vos produits, indiquez vos coordonnées, choisissez un créneau de retrait et un mode
		de paiement, puis acceptez les présentes conditions. Le bouton « Commander » vous engage à payer
		la commande. Une référence de commande vous est alors donnée ; conservez-la.
	</p>

	<h2>5. Paiement</h2>
	<ul>
		<li><strong>Au retrait</strong>, en espèces ou par chèque.</li>
		<li>
			<strong>Par virement</strong>, avec la référence de commande en libellé, dans les
			{DELAI_VIREMENT_HEURES} heures suivant la commande, et au plus tard la veille du retrait. Sans paiement
			reçu dans ce délai, la commande est annulée automatiquement et les produits remis en vente.
		</li>
	</ul>
	<p>Aucun frais n’est appliqué, quel que soit le mode de paiement.</p>

	<h2>6. Retrait</h2>
	<p>
		Les commandes sont à retirer au lieu et pendant le créneau choisis. Présentez votre référence de
		commande. Pensez à vérifier vos produits au moment du retrait.
	</p>
	<p>
		<strong>Commande non retirée</strong> : les produits frais ne pouvant pas être conservés, une
		commande non retirée pendant le créneau n’est ni remboursée ni reportée, sauf accord avec nous.
		Après {ABSENCES_AVANT_BLOCAGE} commandes non retirées, la commande en ligne peut être suspendue pour
		l’adresse e-mail ou le numéro de téléphone concerné ; contactez-nous pour la rétablir.
	</p>

	<h2>7. Annulation</h2>
	<p>
		<strong>Par vous</strong> : vous pouvez annuler votre commande, sans frais, jusqu’à
		{ANNULATION_HEURES_AVANT_RETRAIT} heures avant le début du créneau de retrait, avec le lien « Annuler
		ma commande » de la page de confirmation. Une commande déjà payée par virement est alors remboursée.
		Passé ce délai, contactez-nous.
	</p>
	<p>
		<strong>Par nous</strong> : si un produit ne peut finalement pas être fourni (mauvaise récolte, intempéries…),
		nous vous prévenons au plus vite ; le produit manquant n’est pas facturé, ou est remboursé s’il a
		été payé.
	</p>

	<h2>8. Droit de rétractation</h2>
	<p>
		Conformément à l’article L221-28, 4° du Code de la consommation, le droit de rétractation ne
		s’applique pas aux produits susceptibles de se détériorer ou de se périmer rapidement, comme les
		fruits et légumes frais. Vous pouvez en revanche annuler votre commande dans les conditions de
		l’article 7.
	</p>

	<h2>9. Réclamations et garanties</h2>
	<p>
		En cas de problème sur un produit, signalez-le au retrait ou au plus vite à
		<a href="mailto:{I.email}">{I.email}</a> : nous trouverons une solution (remplacement ou remboursement).
		Vous bénéficiez de la garantie légale de conformité (articles L217-3 et suivants du Code de la consommation).
	</p>

	<h2>10. Médiation</h2>
	<p>
		En cas de litige, contactez-nous d’abord pour trouver une solution amiable. À défaut, vous
		pouvez recourir gratuitement au médiateur de la consommation
		{#if I.mediateur}
			: {I.mediateur.nom}
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- lien externe -->
			(<a href={I.mediateur.site} rel="noopener noreferrer">{I.mediateur.site}</a>).
		{:else}
			désigné par le vendeur (coordonnées à compléter).
		{/if}
	</p>

	<h2>11. Données personnelles</h2>
	<p>
		Vos données servent uniquement à traiter votre commande : voir la
		<a href={resolve('/confidentialite')}>politique de confidentialité</a>.
	</p>

	<h2>12. Droit applicable</h2>
	<p>Les présentes conditions sont soumises au droit français.</p>
</PageLegale>
