<script lang="ts">
	import { onMount } from 'svelte';
	import Ko from '../routes/Ko.svelte';
	import En from '../routes/En.svelte';
	import SnowBackground from './SnowBackground.svelte';
	import symbol from '../assets/seorii.png';

	type Language = 'ko' | 'en';
	let language = $state<Language>('ko');
	let snowPaused = $state(false);
	let reducedMotion = $state(false);
	const copy = {
		ko: {
			name: '이서현',
			role: 'KAIST 전산학부 · 22학번',
			line1: '이 세상의',
			line2: '어떤 것을 만듭니다.',
			intro:
				'알고리즘 문제 해결부터 웹사이트까지.\n생각을 코드로 옮기고, 쓸 수 있는 무언가로 만듭니다.',
			viewWork: '만든 것 둘러보기',
			scroll: '아래로',
			pause: '눈 잠시 멈추기',
			resume: '눈 다시 내리기',
			reducedMotion: '동작 줄이기 설정 사용 중',
			back: '맨 위로',
			skip: '본문으로 건너뛰기',
			description:
				'이서현, seorii. KAIST 전산학부. 알고리즘부터 웹까지, 만들어 온 것들과 경험을 소개합니다.'
		},
		en: {
			name: 'Seohyun Lee',
			role: 'Computer Science at KAIST · Entered in 2022',
			line1: 'I make things',
			line2: 'in this world.',
			intro:
				'From algorithms to websites.\nTurning ideas into code, and code into things you can use.',
			viewWork: 'Explore my work',
			scroll: 'Scroll down',
			pause: 'Pause snow',
			resume: 'Resume snow',
			reducedMotion: 'Reduced motion is on',
			back: 'Back to top',
			skip: 'Skip to content',
			description:
				'Seohyun Lee, seorii. Computer Science at KAIST. Software, open source, and the things I have built along the way.'
		}
	};
	const links = [
		{ name: 'GitHub', detail: '@seo-rii', href: 'https://github.com/seo-rii' },
		{ name: 'Blog', detail: 'log.seorii.page', href: 'https://log.seorii.page' },
		{ name: 'LinkedIn', detail: '/in/seorii', href: 'https://linkedin.com/in/seorii' },
		{ name: 'Mail', detail: 'me@seorii.page', href: 'mailto:me@seorii.page' }
	];
	let text = $derived(copy[language]);

	function selectLanguage(next: Language) {
		language = next;
		document.documentElement.lang = next;
		try {
			localStorage.setItem('seorii-language', next);
		} catch {
			/* Storage can be unavailable in file previews. */
		}
	}

	onMount(() => {
		let preferred: string | null = null;
		try {
			preferred = localStorage.getItem('seorii-language');
		} catch {
			/* Browser preference is the fallback. */
		}
		const browserLanguage = navigator.languages?.[0] ?? navigator.language;
		language =
			preferred === 'ko' || preferred === 'en'
				? preferred
				: browserLanguage.toLowerCase().startsWith('ko')
					? 'ko'
					: 'en';
		document.documentElement.lang = language;
		const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
		const updateMotion = () => {
			reducedMotion = preference.matches;
		};
		updateMotion();
		preference.addEventListener('change', updateMotion);
		return () => preference.removeEventListener('change', updateMotion);
	});
</script>

<svelte:head>
	<title>{language === 'ko' ? '이서현' : 'Seohyun Lee'} · seorii</title>
	<meta name="description" content={text.description} />
	<meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)" />
	<meta name="theme-color" content="#101923" media="(prefers-color-scheme: dark)" />
	<meta property="og:title" content="Seohyun Lee · seorii" />
	<meta property="og:description" content={text.description} />
	<meta property="og:type" content="website" />
	<meta property="og:url" content="https://seorii.page/" />
	<link rel="canonical" href="https://seorii.page/" />
</svelte:head>

<div id="top" class="site-shell" lang={language}>
	<SnowBackground paused={snowPaused} />
	<a class="skip-link" href="#about">{text.skip}</a>
	<header class="site-header">
		<a class="wordmark" href="#top" aria-label="seorii">seorii<span aria-hidden="true">.</span></a>
		<div class="language-switch" role="group" aria-label="Language / 언어">
			<button
				type="button"
				lang="ko"
				aria-label="한국어"
				aria-pressed={language === 'ko'}
				onclick={() => selectLanguage('ko')}>KO</button
			>
			<span aria-hidden="true">/</span>
			<button
				type="button"
				lang="en"
				aria-label="English"
				aria-pressed={language === 'en'}
				onclick={() => selectLanguage('en')}>EN</button
			>
		</div>
	</header>

	<main>
		<section class="hero" aria-labelledby="intro-title">
			<div class="hero-main">
				<div class="hero-copy">
					<h1 id="intro-title"><span>{text.line1}</span><span>{text.line2}</span></h1>
					<p class="identity"><strong>{text.name}</strong><span class="alias">/ seorii</span></p>
					<p class="role">{text.role}</p>
					<p class="intro">{text.intro}</p>
					<a class="work-link" href="#projects">{text.viewWork}<span aria-hidden="true">↗</span></a>
				</div>
				<div class="hero-symbol">
					<div class="symbol-halo" aria-hidden="true"></div>
					<img
						src={symbol}
						alt={language === 'ko' ? 'seorii 눈송이 심볼' : 'seorii snowflake symbol'}
						width="2294"
						height="2295"
						fetchpriority="high"
					/>
				</div>
			</div>
			<div class="hero-bottom">
				<div class="social-links">
					{#each links as link (link.name)}
						<a
							href={link.href}
							target={link.name === 'Mail' ? undefined : '_blank'}
							rel={link.name === 'Mail' ? undefined : 'noreferrer'}
						>
							<span class="social-name">{link.name}<span aria-hidden="true">↗</span></span>
							<span class="social-detail">{link.detail}</span>
						</a>
					{/each}
				</div>
				<div class="hero-edge">
					<a class="scroll-cue" href="#about"><span aria-hidden="true">↓</span>{text.scroll}</a>
					<button
						class="snow-toggle"
						type="button"
						aria-pressed={snowPaused || reducedMotion}
						disabled={reducedMotion}
						onclick={() => (snowPaused = !snowPaused)}
					>
						<span aria-hidden="true">{reducedMotion ? '—' : snowPaused ? '▷' : 'Ⅱ'}</span
						>{reducedMotion ? text.reducedMotion : snowPaused ? text.resume : text.pause}
					</button>
				</div>
			</div>
		</section>

		<div class="reading-surface">
			{#if language === 'ko'}<Ko />{:else}<En />{/if}
		</div>
	</main>

	<footer>
		<a class="wordmark" href="#top">seorii<span aria-hidden="true">.</span></a><span
			>{text.name}</span
		><a class="back-top" href="#top">{text.back}<span aria-hidden="true">↑</span></a>
	</footer>
</div>

<style>
	.site-shell {
		position: relative;
		z-index: 1;
	}
	.site-header,
	.hero,
	footer {
		width: min(1120px, calc(100% - 96px));
		margin-inline: auto;
	}
	.site-header {
		height: 108px;
		display: flex;
		align-items: center;
		gap: 52px;
	}
	.wordmark {
		font-size: 27px;
		letter-spacing: -1.5px;
		font-weight: 750;
		text-decoration: none;
	}
	.wordmark span {
		color: var(--brand-accent);
	}
	.language-switch {
		display: flex;
		gap: 8px;
		margin-left: auto;
		align-items: center;
		font-size: 11px;
	}
	.language-switch span {
		color: var(--divider);
	}
	.language-switch button {
		cursor: pointer;
		background: none;
		border: none;
		padding: 14px 4px;
		color: var(--muted);
		font-size: 11px;
		letter-spacing: 0.04em;
	}
	.language-switch button[aria-pressed='true'] {
		font-weight: 750;
		color: var(--ink);
	}
	.hero {
		min-height: calc(100svh - 108px);
		display: flex;
		flex-direction: column;
		justify-content: center;
	}
	.hero-main {
		display: grid;
		grid-template-columns: 1.65fr 1fr;
		align-items: center;
		gap: 40px;
		flex: 1;
		padding-block: 64px 72px;
	}
	h1 {
		margin: 0 0 36px;
		font-size: clamp(36px, 4.3vw, 62px);
		letter-spacing: -0.055em;
		line-height: 1.25;
		font-weight: 680;
		word-break: keep-all;
	}
	h1 span {
		display: block;
	}
	.identity {
		display: flex;
		align-items: center;
		gap: 13px;
		margin: 0 0 8px;
		font-size: 19px;
	}
	.identity strong {
		font-weight: 650;
	}
	.alias {
		color: var(--muted);
		font-size: 14px;
	}
	.role {
		margin: 0;
		font-size: 12px;
		color: var(--muted);
	}
	.intro {
		margin: 24px 0 30px;
		white-space: pre-line;
		line-height: 1.9;
		font-size: 14px;
		color: var(--intro);
		word-break: keep-all;
	}
	.work-link {
		display: inline-flex;
		align-items: center;
		gap: 36px;
		font-size: 13px;
		font-weight: 600;
		text-decoration: none;
		border-bottom: 1px solid var(--work-line);
		padding-bottom: 10px;
	}
	.work-link span {
		font-size: 20px;
	}
	.work-link:hover {
		color: var(--work-hover);
	}
	.hero-symbol {
		position: relative;
		display: grid;
		place-items: center;
		padding: 40px 0;
	}
	.symbol-halo {
		position: absolute;
		width: 100%;
		aspect-ratio: 1;
		border-radius: 50%;
		background: var(--symbol-halo);
	}
	.hero-symbol img {
		position: relative;
		width: min(100%, 300px);
		height: auto;
		filter: var(--symbol-filter);
		opacity: 0.82;
	}
	.hero-bottom {
		padding-bottom: 24px;
	}
	.social-links {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		border-top: 1px solid var(--line);
		border-bottom: 1px solid var(--line);
	}
	.social-links a {
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding: 24px;
		text-decoration: none;
		transition: background 0.2s;
	}
	.social-links a:first-child {
		padding-left: 0;
	}
	.social-links a:last-child {
		padding-right: 0;
	}
	.social-links a + a {
		border-left: 1px solid var(--line);
	}
	.social-links a:hover {
		background: var(--link-hover);
	}
	.social-name {
		display: flex;
		justify-content: space-between;
		gap: 8px;
		font-size: 14px;
		font-weight: 600;
	}
	.social-name > span {
		color: var(--muted);
		font-weight: 400;
	}
	.social-detail {
		color: var(--muted);
		font-size: 11px;
	}
	.hero-edge {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding-top: 22px;
		gap: 24px;
	}
	.scroll-cue,
	.snow-toggle {
		display: inline-flex;
		align-items: center;
		gap: 10px;
		font-size: 11px;
		color: var(--muted);
		text-decoration: none;
	}
	.scroll-cue > span {
		font-size: 17px;
	}
	.snow-toggle {
		border: 0;
		background: none;
		padding: 8px 0 8px 8px;
		cursor: pointer;
	}
	.snow-toggle > span {
		font-size: 14px;
	}
	.snow-toggle:disabled {
		cursor: default;
	}
	.reading-surface {
		padding: 72px 48px 0;
		background: linear-gradient(transparent, var(--reading-overlay) 140px);
	}
	footer {
		display: flex;
		align-items: center;
		gap: 20px;
		padding: 36px 0 48px;
		border-top: 1px solid var(--line);
	}
	footer > span {
		font-size: 12px;
		color: var(--muted);
	}
	.back-top {
		display: inline-flex;
		gap: 16px;
		margin-left: auto;
		font-size: 12px;
		text-decoration: none;
	}
	.skip-link {
		position: fixed;
		z-index: 10;
		top: -100px;
		left: 16px;
		padding: 16px;
		background: var(--background);
	}
	.skip-link:focus {
		top: 16px;
	}
	@media (min-width: 1600px) {
		.hero-main {
			padding-block: 90px;
		}
	}
	@media (max-width: 900px) {
		.site-header,
		.hero,
		footer {
			width: calc(100% - 64px);
		}
		.hero-main {
			grid-template-columns: 1.7fr 1fr;
			gap: 16px;
		}
		.hero-symbol img {
			width: 220px;
		}
		.reading-surface {
			padding-inline: 32px;
		}
	}
	@media (max-width: 620px) {
		.site-header,
		.hero,
		footer {
			width: calc(100% - 48px);
		}
		.site-header {
			height: 80px;
			gap: 24px;
		}
		.wordmark {
			font-size: 25px;
		}
		.language-switch {
			gap: 5px;
		}
		.hero {
			min-height: 0;
		}
		.hero-main {
			position: relative;
			display: block;
			flex: none;
			padding-block: 46px 44px;
		}
		.hero-copy {
			position: relative;
			z-index: 1;
		}
		h1 {
			font-size: clamp(30px, 8.1vw, 48px);
			margin-bottom: 28px;
		}
		.identity {
			font-size: 17px;
		}
		.role {
			font-size: 11px;
		}
		.intro {
			font-size: 12px;
			margin-block: 20px 24px;
		}
		.hero-symbol {
			position: absolute;
			right: 0;
			top: 13px;
			padding: 0;
			width: 68px;
			height: 68px;
		}
		.hero-symbol img {
			width: 58px;
			opacity: 0.7;
		}
		.social-links {
			grid-template-columns: repeat(2, 1fr);
		}
		.social-links a {
			padding: 18px 16px;
			gap: 8px;
		}
		.social-links a:nth-child(2n + 1) {
			padding-left: 0;
			border-left: 0;
		}
		.social-links a:nth-child(2n) {
			padding-right: 0;
		}
		.social-links a:nth-child(n + 3) {
			border-top: 1px solid var(--line);
		}
		.social-name {
			font-size: 12px;
		}
		.social-detail {
			font-size: 10px;
		}
		.hero-edge {
			padding-top: 16px;
		}
		.scroll-cue,
		.snow-toggle {
			font-size: 10px;
		}
		.reading-surface {
			padding: 52px 24px 0;
		}
		footer {
			gap: 16px;
		}
	}
</style>
