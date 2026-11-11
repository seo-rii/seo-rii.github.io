<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		id,
		index,
		title,
		children
	}: {
		id: string;
		index: string;
		title: string;
		children: Snippet;
	} = $props();
</script>

<section {id} aria-labelledby={`${id}-heading`}>
	<header>
		<span class="section-index" aria-hidden="true">{index}</span>
		<h2 id={`${id}-heading`}>{title}</h2>
	</header>
	<div class="prose">
		{@render children()}
	</div>
</section>

<style>
	section {
		display: grid;
		grid-template-columns: 230px minmax(0, 740px);
		justify-content: space-between;
		column-gap: 64px;
		max-width: 1120px;
		margin: 0 auto;
		padding: 96px 0;
		border-top: 1px solid rgb(35 52 68 / 14%);
		scroll-margin-top: 104px;
	}

	.section-index {
		color: #6a7d8c;
		font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
		font-size: 0.75rem;
		letter-spacing: 0.12em;
	}

	h2 {
		margin: 16px 0 0;
		color: #243a4b;
		font-size: 1.65rem;
		font-weight: 600;
		letter-spacing: -0.035em;
		line-height: 1.4;
	}

	.prose {
		min-width: 0;
		color: #394654;
		font-size: 1rem;
		line-height: 1.85;
		overflow-wrap: anywhere;
	}

	.prose :global(p) {
		margin: 0 0 20px;
	}

	.prose :global(article) {
		margin-top: 40px;
	}

	.prose :global(article + article) {
		padding-top: 32px;
		border-top: 1px solid rgb(35 52 68 / 10%);
	}

	.prose :global(h3) {
		margin: 0 0 16px;
		color: #243a4b;
		font-size: 1.35rem;
		font-weight: 600;
		letter-spacing: -0.025em;
		line-height: 1.45;
	}

	.prose :global(a) {
		text-decoration-color: #8b9ba7;
		text-underline-offset: 0.2em;
	}

	.prose :global(ul) {
		margin: 16px 0 24px;
		padding-left: 1.25em;
	}

	.prose :global(li + li) {
		margin-top: 0.55em;
	}

	.prose :global(li::marker) {
		color: #8b9ba7;
	}

	.prose > :global(:last-child),
	.prose :global(article > :last-child) {
		margin-bottom: 0;
	}

	@media (max-width: 820px) {
		section {
			grid-template-columns: minmax(0, 1fr);
			gap: 32px;
			padding: 64px 0;
		}

		h2 {
			margin-top: 10px;
		}
	}
</style>
