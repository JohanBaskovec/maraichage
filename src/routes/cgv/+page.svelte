<script lang="ts">
	import { resolve } from '$app/paths';
	import { NOM_BOUTIQUE } from '#lib/config.ts';
</script>

<svelte:head><title>Conditions générales de vente – {NOM_BOUTIQUE}</title></svelte:head>

<main>
	<p><a href={resolve('/')}>← Boutique</a></p>
	<h1>Conditions générales de vente</h1>
	<p class="avert">
		En cours de rédaction. Cette page sera complétée avant l’ouverture de la boutique.
	</p>
</main>
