<script lang="ts">
	import { resolve } from '$app/paths';
	import PageLegale from '#lib/composants/PageLegale.svelte';
	import { INFOS_LEGALES as I, NOM_BOUTIQUE } from '#lib/config.ts';
</script>

<PageLegale titre="Mentions légales" majLe="9 novembre 2026">
	<h2>Éditeur du site</h2>
	<dl>
		<dt>Nom commercial</dt>
		<dd>{NOM_BOUTIQUE}</dd>
		<dt>Exploitant</dt>
		<dd>{I.exploitant}</dd>
		<dt>Statut</dt>
		<dd>{I.statut}</dd>
		<dt>SIRET</dt>
		<dd>{I.siret}</dd>
		<dt>Adresse</dt>
		<dd>{I.adresse}</dd>
		<dt>E-mail</dt>
		<dd><a href="mailto:{I.email}">{I.email}</a></dd>
		<dt>Téléphone</dt>
		<dd>{I.telephone}</dd>
		<dt>Directeur de la publication</dt>
		<dd>{I.directeurPublication}</dd>
	</dl>

	<h2>Hébergeur</h2>
	<dl>
		<dt>Nom</dt>
		<dd>{I.hebergeur.nom}</dd>
		<dt>Adresse</dt>
		<dd>{I.hebergeur.adresse}</dd>
		<dt>Téléphone</dt>
		<dd>{I.hebergeur.telephone}</dd>
		<dt>Site</dt>
		<dd>
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- lien externe -->
			<a href={I.hebergeur.site} rel="noopener noreferrer">{I.hebergeur.site}</a>
		</dd>
	</dl>

	<h2>Propriété intellectuelle</h2>
	<p>
		Les textes et éléments de ce site appartiennent à {I.exploitant}. Toute reproduction sans
		autorisation est interdite.
	</p>

	<h2>Données personnelles</h2>
	<p>
		Voir la <a href={resolve('/confidentialite')}>politique de confidentialité</a>. Ce site
		n’utilise aucun cookie de mesure d’audience ni de publicité.
	</p>
</PageLegale>
