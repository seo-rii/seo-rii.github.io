<script lang="ts">
	import { onMount } from 'svelte';

	onMount(() => {
		// Local development and the offline review must not generate page views.
		if (!['seorii.page', 'seo-rii.github.io'].includes(window.location.hostname)) return;

		const measurementId = 'G-CWBZZZGQ92';
		const analyticsWindow = window as Window & { dataLayer?: unknown[] };
		const dataLayer = (analyticsWindow.dataLayer ??= []);
		function gtag(..._args: unknown[]) {
			// gtag's queue uses Arguments objects, as in Google's standard snippet.
			dataLayer.push(arguments);
		}
		gtag('js', new Date());
		gtag('config', measurementId, { page_title: 'seorii' });

		const script = document.createElement('script');
		script.async = true;
		script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
		document.head.append(script);
		return () => script.remove();
	});
</script>
