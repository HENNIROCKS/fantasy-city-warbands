<script lang="ts">
	import { asset, resolve } from '$app/paths';
	import type { Snippet } from 'svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import { APP_NAME, APP_TITLE, BUILD_DATE, REPO, STAGE } from '$lib/app';
	import { planned, systems } from '$lib/systems';
	import { loadSound, loadTuckBox, saveSound, saveTuckBox } from '$lib/core/storage.svelte';
	import { theme } from '$lib/theme.svelte';

	/* Kept on this device, as the theme is; the cards read them as they open.
	   Both are null until read, their switches hidden meanwhile and made anew
	   once known, so they do not slide from a guess to what is stored. */
	let sound = $state<boolean | null>(null);
	loadSound().then((on) => (sound = on));

	function toggleSound() {
		sound = !sound;
		saveSound(sound);
	}

	let tuckBox = $state<boolean | null>(null);
	loadTuckBox().then((on) => (tuckBox = on));

	function toggleTuckBox() {
		tuckBox = !tuckBox;
		saveTuckBox(tuckBox);
	}

	/** Each game's own site and where its rules come from, by game id. */
	const SITES: Record<string, string> = {
		wyrdcry: 'https://wyrdcry.net',
		'black-death-city': 'https://www.blackdeathcity.com/',
		mordheim: 'https://mordheimer.net/',
		necropolis: 'https://drive.google.com/file/d/1o60MheZKHSKCFAGHkzloo93Uj7TRvGff/'
	};

	/** Playable games and those still to come in one list, by name. */
	const games = [
		...Object.values(systems).map((s) => ({
			id: s.game.id,
			name: s.game.name,
			author: s.game.author,
			edition: s.game.edition
		})),
		...planned.map((g) => ({ ...g, edition: 'eventually' }))
	].sort((a, b) => a.name.localeCompare(b.name));

	/** The domain alone, as the label of a game's link. */
	const domain = (url: string) => new URL(url).hostname.replace(/^www\./, '');


	/* Answered here rather than only in the README: whoever builds a warband on
	   a phone is not the one browsing the repository. */
	const faq = [
		{
			question: 'Does the app apply every rule?',
			answer:
				'Not yet. It checks budgets, limits and what a fighter may carry, counts in what a warband’s choice changes, and runs Wyrdcry’s campaign as the Campaign Book 1.0 has it. Tap a characteristic on a card to see how it adds up. Still to come in Black Death City are the rest of the scenarios and the campaign.'
		},
		{
			question: 'Which rules does the app follow?',
			answer: `Black Death City ${systems['black-death-city'].game.edition}; where the playtest contradicts itself, the fighter’s own scroll wins over the fighter list. Wyrdcry ${systems.wyrdcry.game.edition}: the Rulebook 1.0.1, the Campaign Book 1.0 and the factions as wyrdcry.net has them.`
		}
	];

	/* Where the colours and form elements come from. */
	const CARD_CREATOR = 'https://hennirocks.github.io/warcry-card-creator-2026/';

	const linkClass =
		'flex min-h-11 items-center justify-center gap-2 rounded border border-zinc-700 bg-zinc-800 px-4 font-semibold text-zinc-200 transition hover:bg-zinc-700 focus-visible:bg-zinc-700';
</script>

<!-- The same size as the GitHub mark, for a link that leads off GitHub. -->
{#snippet external()}
	<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
		<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
	</svg>
{/snippet}

{#snippet github()}
	<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
		<path
			d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.385-1.335-1.755-1.335-1.755-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.295 24 12c0-6.63-5.37-12-12-12"
		/>
	</svg>
{/snippet}

<!-- One question of the accordion: its answer as text, or as markup where it needs a list or a warning. -->
{#snippet question(title: string, answer: string | Snippet)}
	<details class="border-b border-zinc-700">
		<summary class="flex min-h-11 cursor-pointer items-center justify-between gap-3 px-px py-2 font-semibold text-zinc-200">
			{title}
		</summary>
		<div class="space-y-3 px-px pb-3 text-zinc-400">
			{#if typeof answer === 'string'}
				<p>{answer}</p>
			{:else}
				{@render answer()}
			{/if}
		</div>
	</details>
{/snippet}

{#snippet data()}
	<p>
		Your warbands live in this browser, on this device alone. No account, no server, no sync:
		another phone or another browser does not see them.
	</p>
	<p
		class="rounded-md border p-3"
		style="background: var(--ui-warn-bg); border-color: var(--ui-warn-border); color: var(--ui-warn-text)"
	>
		<strong>Export what you want to keep.</strong> The arrow beside a warband on the start page saves
		it as a file, and Import warband brings it back, here or on another device. Clearing this browser's data removes your warbands, and so does a private window
		once it closes. Safari can also remove them by itself after seven days
		in which the site was not opened; other browsers may do so when the device runs low on storage.
		The app asks the browser to keep them; Safari grants that mostly to the app on the home screen.
	</p>
{/snippet}

{#snippet homeScreen()}
	<p>
		Safari can remove the data of a site that has not been opened for seven days, and grants the
		request to keep it mostly to the app on the home screen. Installed, the app also opens full
		screen, without the browser bars. Once it has been opened with a network, it also starts
		without one, the roster included; a new version is offered as soon as it is online.
	</p>
	<ul class="list-disc space-y-1 pl-5">
		<li><strong>iPhone, iPad:</strong> Share, then “Add to Home Screen”.</li>
		<li><strong>Android:</strong> browser menu, then “Install app”.</li>
	</ul>
{/snippet}

{#snippet photos()}
	<p>
		Photos of your models stay on this device as well and are not part of an export. Deleting the
		warband deletes them too. The photo you picked stays in your library; only one taken from inside
		the app exists nowhere else.
	</p>
{/snippet}

<svelte:head>
	<title>Settings · {APP_TITLE}</title>
</svelte:head>

<PageHeader title="Settings" />

<!-- Three parts, each under its own heading and well apart: what is set here,
     the guides, and what the app is. -->
<main class="mx-auto max-w-2xl space-y-16 p-5 pb-16 text-sm text-zinc-300">
	<section class="space-y-3" aria-labelledby="settings-heading">
		<div>
			<h2 id="settings-heading" class="text-lg font-semibold text-zinc-200">Settings</h2>
			<p class="text-zinc-400">Kept on this device.</p>
		</div>
		<div class="flex items-center justify-between gap-4">
			<p id="theme-label" class="font-semibold text-zinc-200">Dark mode</p>
			<button type="button" class="switch" role="switch" aria-checked={theme.dark} aria-labelledby="theme-label" onclick={() => theme.toggle()}>
				<span class="switch-track"><span class="switch-knob"></span></span>
			</button>
		</div>
		<!-- Only the switch is tapped: the text beside it carries a link, which a
		     switch cannot hold, and names it. -->
		<div class="flex items-center justify-between gap-4">
			<div>
				<p id="sound-label" class="font-semibold text-zinc-200">Scream when a fighter goes out of action</p>
				<p class="text-zinc-400">
					The <a class="underline" href="https://en.wikipedia.org/wiki/Wilhelm_scream" target="_blank" rel="noopener"
						>Wilhelm scream <span aria-hidden="true">↗</span></a
					>, from Wikimedia Commons under CC0
				</p>
			</div>
			{#key sound === null}
				<button type="button" class="switch" class:invisible={sound === null} role="switch" aria-checked={sound === true} aria-labelledby="sound-label" onclick={toggleSound}>
					<span class="switch-track"><span class="switch-knob"></span></span>
				</button>
			{/key}
		</div>
		<div class="flex items-center justify-between gap-4">
			<p id="tuck-box-label" class="font-semibold text-zinc-200">Open the cards from a tuck box</p>
			{#key tuckBox === null}
				<button type="button" class="switch" class:invisible={tuckBox === null} role="switch" aria-checked={tuckBox === true} aria-labelledby="tuck-box-label" onclick={toggleTuckBox}>
					<span class="switch-track"><span class="switch-knob"></span></span>
				</button>
			{/key}
		</div>
	</section>

	<section class="space-y-3 border-t border-zinc-700 pt-10" aria-labelledby="docs-heading">
		<h2 id="docs-heading" class="text-lg font-semibold text-zinc-200">Docs</h2>
		<p>Short guides to playing with the app, game by game.</p>
		<a class={linkClass} href={resolve('/docs')}>Read the guides</a>
	</section>

	<section class="space-y-10 border-t border-zinc-700 pt-10" aria-labelledby="about-heading">
		<h2 id="about-heading" class="text-lg font-semibold text-zinc-200">About</h2>

		<section class="space-y-3">
			<!-- The home-screen icon beside the name; its file name changes with the icon. -->
			<div class="flex items-center gap-3">
				<img class="size-13 flex-none rounded-xl" src={asset('/web-app-manifest-192x192-v3.png')} alt="" width="52" height="52" />
				<div class="space-y-0.5">
					<h3 class="text-base font-semibold text-zinc-200">
						{APP_NAME}
						{#if STAGE}
							<span
								class="ml-1 rounded border border-zinc-600 bg-zinc-800 px-2 py-0.5 align-middle text-xs font-semibold tracking-wider text-zinc-400 uppercase"
								>{STAGE}</span
							>
						{/if}
					</h3>
					<p class="text-zinc-400">
						{['by Hendrik Berends', `Version ${__APP_VERSION__}`, BUILD_DATE ? `Build ${BUILD_DATE}` : null].filter(Boolean).join(' · ')}
					</p>
				</div>
			</div>
			<p>
				Build a warband for a skirmish game set in a fantasy city, play its battles from a deck of
				cards and carry it through a campaign.
			</p>
			<p class="text-zinc-400">
				An unofficial fan project, not commercial, with no affiliation with or endorsement from Games
				Workshop.
			</p>
			<p class="text-zinc-400">
				The start screen shows an etching after Urs Graf, 1524, from the Wellcome Collection, in the
				public domain. The game logos belong to their games and are used with their permission.
			</p>
		</section>

		<section class="space-y-3">
			<h3 class="field-label">Questions</h3>
			<!-- Rules, not boxes: the links below are the buttons on this page, and two
			     stacks of the same shape read as one list of the same kind of thing. -->
			<div class="border-t border-zinc-700">
				{@render question('How do I install the app?', homeScreen)}
				{@render question('Where are my warbands kept?', data)}
				{@render question('What happens to the photos of my models?', photos)}
				{#each faq as entry (entry.question)}
					{@render question(entry.question, entry.answer)}
				{/each}
			</div>
		</section>

		<section class="space-y-3">
			<h3 class="field-label">Games and their rules</h3>
			<ul class="space-y-3">
				{#each games as game (game.id)}
					<li class="rounded-md border border-zinc-700 bg-zinc-800 p-3">
						<p class="font-semibold text-zinc-200">{game.name}</p>
						<p class="text-zinc-400">by {game.author} · {game.edition}</p>
						{#if SITES[game.id]}
							<a
								class="mt-2 inline-flex items-center gap-1 rounded border border-zinc-600 px-2 py-1 text-xs font-semibold text-zinc-200 transition hover:bg-zinc-700 focus-visible:bg-zinc-700"
								href={SITES[game.id]}
								target="_blank"
								rel="noopener">{domain(SITES[game.id])} <span aria-hidden="true">↗</span></a
							>
						{/if}
					</li>
				{/each}
			</ul>
		</section>

		<section class="space-y-3">
			<h3 class="field-label">Links</h3>
			<ul class="space-y-2">
				<li><a class={linkClass} href="{REPO}/issues/new/choose" target="_blank" rel="noopener">{@render github()}Feedback and bug reports</a></li>
				<li><a class={linkClass} href="{REPO}/blob/main/ROADMAP.md" target="_blank" rel="noopener">{@render github()}What is planned</a></li>
				<li><a class={linkClass} href="{REPO}/blob/main/DEVIATIONS.md" target="_blank" rel="noopener">{@render github()}Where the app reads the rules its own way</a></li>
				<li><a class={linkClass} href={REPO} target="_blank" rel="noopener">{@render github()}Source code</a></li>
				<li><a class={linkClass} href={CARD_CREATOR} target="_blank" rel="noopener">{@render external()}Warcry Card Creator 2026</a></li>
			</ul>
		</section>
	</section>

	<a
		class="block rounded bg-[#125E3C] px-8 py-4 text-center text-base font-semibold text-white transition hover:bg-[#16754A] focus-visible:bg-[#16754A]"
		href={resolve('/')}>Back to your warbands</a
	>
</main>

<style>
	/* The chevron below stands in for the marker. */
	summary {
		list-style: none;
	}

	summary::-webkit-details-marker {
		display: none;
	}

	/* Closed points down, open points up. Nothing animates, so there is nothing
	   a reduced-motion setting would have to switch off. */
	summary::after {
		content: '';
		flex: none;
		width: 7px;
		height: 7px;
		margin-bottom: 3px;
		border-right: 1.5px solid var(--ui-text-subtle);
		border-bottom: 1.5px solid var(--ui-text-subtle);
		transform: rotate(45deg);
	}

	details[open] summary::after {
		margin: 3px 0 0;
		transform: rotate(-135deg);
	}

	summary:focus-visible {
		outline: 2px solid #16754a;
		outline-offset: 1px;
	}
</style>
