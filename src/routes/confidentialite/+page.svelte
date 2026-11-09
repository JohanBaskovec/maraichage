<script lang="ts">
	import PageLegale from '#lib/composants/PageLegale.svelte';
	import { INFOS_LEGALES as I, NOM_BOUTIQUE } from '#lib/config.ts';
</script>

<PageLegale titre="Politique de confidentialité" majLe="9 novembre 2026">
	<h2>Responsable du traitement</h2>
	<p>
		{I.exploitant} ({NOM_BOUTIQUE}), {I.adresse}. Contact :
		<a href="mailto:{I.email}">{I.email}</a>.
	</p>

	<h2>Données collectées</h2>
	<p>Lorsque vous passez commande, nous enregistrons :</p>
	<ul>
		<li>votre nom, votre adresse e-mail et votre numéro de téléphone ;</li>
		<li>le contenu de votre commande, le créneau de retrait choisi et le mode de paiement ;</li>
		<li>le suivi de la commande (paiement reçu, commande récupérée, non récupérée ou annulée).</li>
	</ul>
	<p>
		Nous ne collectons aucune donnée bancaire : en cas de virement, c’est vous qui le faites depuis
		votre banque.
	</p>

	<h2>Pourquoi et sur quelle base</h2>
	<ul>
		<li>
			<strong>Préparer et remettre votre commande</strong>, vous joindre en cas de besoin et vous
			envoyer les messages liés à la commande (confirmation, rappel) : exécution du contrat.
		</li>
		<li>
			<strong>Tenir la comptabilité</strong> : obligation légale.
		</li>
		<li>
			<strong>Limiter les commandes non récupérées</strong> : après plusieurs commandes non récupérées,
			la commande en ligne peut être suspendue pour l’adresse e-mail ou le numéro de téléphone concerné
			; intérêt légitime (éviter le gaspillage de produits frais).
		</li>
	</ul>
	<p>Vos données ne sont jamais vendues ni utilisées pour de la publicité.</p>

	<h2>Durée de conservation</h2>
	<ul>
		<li>Données de commande : 3 ans après votre dernière commande.</li>
		<li>Pièces comptables : 10 ans, comme l’exige la loi.</li>
	</ul>

	<h2>Qui y a accès</h2>
	<p>
		Uniquement {I.exploitant}, pour gérer les commandes. Nos prestataires techniques traitent les
		données pour notre compte : Cloudflare (hébergement du site et de la base de données) et, pour
		l’envoi des e-mails, Resend. Ces prestataires peuvent stocker des données hors de l’Union
		européenne, avec les garanties prévues par le RGPD (clauses contractuelles types).
	</p>

	<h2>Cookies et stockage dans votre navigateur</h2>
	<p>
		Aucun cookie de mesure d’audience ni de publicité. Votre panier et, pour vous éviter de les
		retaper, vos coordonnées sont gardés dans votre propre navigateur (stockage local) : ils ne sont
		envoyés qu’au moment où vous validez une commande. Vous pouvez les effacer depuis les réglages
		de votre navigateur.
	</p>

	<h2>Vos droits</h2>
	<p>
		Vous pouvez demander l’accès à vos données, leur rectification, leur effacement, leur
		portabilité, ou vous opposer à leur traitement, en écrivant à
		<a href="mailto:{I.email}">{I.email}</a>. Si vous estimez que vos droits ne sont pas respectés,
		vous pouvez saisir la CNIL (<a href="https://www.cnil.fr" rel="noopener noreferrer"
			>www.cnil.fr</a
		>).
	</p>
</PageLegale>
