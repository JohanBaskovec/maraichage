<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<svelte:head><title>Clients bloqués – back-office</title></svelte:head>

<h1>Clients bloqués</h1>
<p class="discret">
	Après {data.seuil} commandes non récupérées, un client ne peut plus commander en ligne (repéré par son
	e-mail ou son téléphone). « Débloquer » pardonne ces absences : elles restent dans l’historique mais
	ne comptent plus.
</p>

{#if form?.debloque}
	<p class="ok" role="status">{form.debloque} est débloqué.</p>
{/if}

{#if data.clients.length === 0}
	<p class="vide">Aucun client bloqué.</p>
{/if}

{#each data.clients as client (client.identifiant)}
	<article class="carte ligne client">
		<div>
			<strong>{client.noms.join(', ')}</strong>
			<div class="discret">
				{client.type === 'email' ? 'E-mail' : 'Téléphone'} : {client.identifiant}
				<br />{client.absences} commandes non récupérées : {client.references.join(', ')}
			</div>
		</div>
		<form method="POST" action="?/debloquer" use:enhance>
			<input type="hidden" name="identifiant" value={client.identifiant} />
			<button class="secondaire">Débloquer</button>
		</form>
	</article>
{/each}

<style>
	.client {
		justify-content: space-between;
		align-items: center;
	}
</style>
