export type ColorScheme = 'light' | 'dark';

/** Keep DOM, browser chrome and the canvas on the same effective palette. */
export function observeColorScheme(onChange: (scheme: ColorScheme) => void) {
	const root = document.documentElement;
	const previous = root.getAttribute('data-color-scheme');
	const preference = window.matchMedia('(prefers-color-scheme: dark)');
	const probe = document.createElement('span');
	// The CSS system color changes under browser auto-darkening even when the
	// media query stays light. Keep the probe independent of our resolved theme.
	// https://developer.chrome.com/blog/auto-dark-theme/#detecting-auto-dark-theme
	probe.style.cssText = 'display:none!important;color-scheme:light!important';
	probe.style.setProperty('background-color', 'white', 'important');
	probe.style.setProperty('background-color', 'canvas', 'important');
	document.body.append(probe);

	let current: ColorScheme | undefined;
	let timer = 0;
	function update() {
		const dark =
			preference.matches || getComputedStyle(probe).backgroundColor !== 'rgb(255, 255, 255)';
		const next = dark ? 'dark' : 'light';
		if (next === current) return;
		current = next;
		root.dataset.colorScheme = next;
		onChange(next);
	}
	function visibilityChanged() {
		window.clearInterval(timer);
		timer = 0;
		if (!document.hidden) {
			update();
			// Browser-only darkening can change without a media-query event. One
			// style read per second avoids doing this work on scroll or every frame.
			timer = window.setInterval(update, 1000);
		}
	}

	update();
	visibilityChanged();
	preference.addEventListener('change', update);
	window.addEventListener('pageshow', update);
	window.addEventListener('focus', update);
	document.addEventListener('visibilitychange', visibilityChanged);

	return () => {
		window.clearInterval(timer);
		preference.removeEventListener('change', update);
		window.removeEventListener('pageshow', update);
		window.removeEventListener('focus', update);
		document.removeEventListener('visibilitychange', visibilityChanged);
		probe.remove();
		if (root.getAttribute('data-color-scheme') === current) {
			if (previous === null) root.removeAttribute('data-color-scheme');
			else root.setAttribute('data-color-scheme', previous);
		}
	};
}
