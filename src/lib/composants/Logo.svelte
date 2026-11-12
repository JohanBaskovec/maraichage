<script lang="ts">
	// Logo de la maquette : un arbre devant un soleil.
	let { taille = 46 }: { taille?: number } = $props();
</script>

<svg width={taille} height={taille} viewBox="0 0 44 44" aria-hidden="true">
	<circle cx="22" cy="22" r="21" fill="#E8B44A" />
	<path d="M12 36 L32 36" stroke="#1F3D2B" stroke-width="2.5" stroke-linecap="round" />
	<path d="M22 36 L22 24" stroke="#1F3D2B" stroke-width="2.5" stroke-linecap="round" />
	<circle cx="22" cy="18" r="10" fill="#3F6B45" stroke="#1F3D2B" stroke-width="2.5" />
	<path
		d="M22 25 L22 12 M22 18 L17.5 14.5 M22 21 L26.5 17.5"
		stroke="#DCE5D0"
		stroke-width="1.6"
		stroke-linecap="round"
		fill="none"
	/>
</svg>
