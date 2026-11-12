<script lang="ts">
	import type { Snippet } from 'svelte';
	import '../app.css';
	import GA from './GA.svelte';

	let { children }: { children: Snippet } = $props();
</script>

<GA />
{@render children()}
