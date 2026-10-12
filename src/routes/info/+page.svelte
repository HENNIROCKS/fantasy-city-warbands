<script lang="ts">
	import { version as build } from '$app/environment';
	import { resolve } from '$app/paths';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import { APP_NAME, APP_TITLE, STAGE } from '$lib/app';
	import { planned, systems } from '$lib/systems';

	const REPO = 'https://github.com/HENNIROCKS/fantasy-city-warbands';

	/*
	 * `version` from SvelteKit is the timestamp of the build. It answers whether
	 * the page is today's state, which a version number that stands still for
	 * months cannot. Spelled out rather than left to toLocaleDateString, whose
	 * month abbreviations differ between engines.
	 */
	const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	const built = new Date(Number(build));
	const buildDate = Number.isNaN(built.getTime())
		? null
		: `${built.getDate()} ${MONTHS[built.getMonth()]} ${built.getFullYear()}`;

	/** Each game's own site and where its rules come from, by game id. */
	const SITES: Record<string, string> = {
		wyrdcry: 'https://wyrdcry.net',
		'black-death-city': 'https://www.blackdeathcity.com/',
		mordheim: 'https://mordheimer.net/'
	};

	const SOURCES: Record<string, string> = {
		wyrdcry:
			'The rules here are copied from the hand-kept ruleset of the Wyrdcry Warband Deck, which follows the rules at wyrdcry.net.',
		'black-death-city': 'Transcribed by hand from the Black Death City Playtest v1.01.'
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

	const playable = Object.values(systems).sort((a, b) => a.game.name.localeCompare(b.game.name));

	/* Answered here rather than only in the README: whoever builds a warband on
	   a phone is not the one browsing the repository. */
	const faq = [
		{
			question: 'Why is a button disabled?',
			answer:
				'Because pressing it would take the warband too far: over its budget, past the limit of a fighter or a group, beyond what a fighter may carry, or against its Origin. The button says which. What the warband still lacks – a leader, enough henchmen, an open choice – is never blocked; it is listed as still to do.'
		},
		{
			question: 'Can I change a warband later?',
			answer:
				'Yes, every step stays open: tap the warband on the start page and go to the step you want. Changing the faction removes its fighters and its choice, and asks first. A fighter’s fluff, notes and photo are written on the back of its card: the pencil under the card turns it over.'
		},
		{
			question: 'Can I keep one warband at the top?',
			answer:
				'Yes: tap the star beside it on the start page. One warband at a time; the others stay A to Z. The star stays on this device and is not part of an export.'
		},
		{
			question: 'Does the app apply every rule?',
			answer:
				'Not yet. It knows the profiles, costs, limits and what each faction sells to each fighter, how much a fighter may carry at once, what an Origin changes about the roster, and the spell, characteristic or mutation a Wyrdcry fighter brings on recruitment. State Pride’s effects on the profiles, the special rules of Black Death City’s fighters, the skills and spells they pick on recruitment, the cost of a Misbegotten’s bloodline mutation, and anything that happens in a campaign are still to come.'
		},
		{
			question: 'Can I track a battle?',
			answer:
				'Yes, without the aftermath so far. On the warband card, Battle starts it, moves on to the next round – one step back is possible until the next tap – and ends it; the bar there says the round, how many fighters still have to act and whether the warband is wavering. On a fighter’s card, the bar at the foot takes Health down a point at a time, and a fighter at none is out of action – with the Wilhelm scream, which the Battle menu turns off. State beside it marks a fighter activated or waiting, and in Wyrdcry in cover, panicked, or a HERO’s heroic reaction as used; the card carries each as a band, and panicked takes a point off Fight and Shoot. The next round clears activated, waiting and panicked and keeps the rest. Once half the warband is out of action, every fighter yet to act carries Bravery test. The Witch Hunters count Zeal where the round would stand, and its stages go into every fighter’s figures. The first tap on a fighter starts a battle too. Ending it drops everything the battle holds and never changes the warband; it stays on this device. The scream comes from Wikimedia Commons, where it is released under CC0.'
		},
		{
			question: 'Can I show my painted models?',
			answer:
				'Yes, on the back of a fighter’s card: choose a photo, drag it into place and zoom it, and Done puts it in the card’s image field. It stays on this device and is not part of an export.'
		},
		{
			question: 'Can I print a warband?',
			answer:
				'Yes, as a roster in PDF, from the page icon beside the warband on the start page: the warband, a row for each fighter with its profile, abilities and weapons, then every rule of the warband, its fighters and their gear once, with the fighters that carry it. It is a first version and will change; each game is to get the sheet it prints itself, and Black Death City’s playtest has none yet.'
		},
		{
			question: 'Which rules does the app follow?',
			answer: `Wyrdcry ${systems.wyrdcry.game.edition}, as kept in the Wyrdcry Warband Deck. Black Death City ${systems['black-death-city'].game.edition}; where the playtest contradicts itself, the fighter’s own scroll wins over the fighter list.`
		},
		{
			question: 'Which factions can I build?',
			answer: playable
				.map((s) => `${s.game.name}: ${s.factions.map((f) => f.name).sort((a, b) => a.localeCompare(b)).join(', ')}.`)
				.join(' ')
		},
		{
			question: 'Where is Mordheim?',
			answer: 'Eventually. It is listed when you pick a game, but cannot be chosen yet.'
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

<svelte:head>
	<title>About · {APP_TITLE}</title>
</svelte:head>

<PageHeader title="About" />

<main class="mx-auto max-w-2xl space-y-10 p-5 pb-16 text-sm text-zinc-300">
	<section class="space-y-3">
		<h2 class="text-base font-semibold text-zinc-200">
			{APP_NAME}
			{#if STAGE}
				<span
					class="ml-1 rounded border border-zinc-600 bg-zinc-800 px-2 py-0.5 align-middle text-xs font-semibold tracking-wider text-zinc-400 uppercase"
					>{STAGE}</span
				>
			{/if}
		</h2>
		<p class="text-zinc-400">
			{['by Hendrik Berends', `Version ${__APP_VERSION__}`, buildDate ? `Build ${buildDate}` : null].filter(Boolean).join(' · ')}
		</p>
		<p>
			Build a warband for a skirmish game set in a fantasy city, step by step, with the budget and
			the roster limits checked as you go.
		</p>
		<p class="text-zinc-400">
			An unofficial fan project, not commercial, with no affiliation with or endorsement from Games
			Workshop.
		</p>
	</section>

	<section class="space-y-3">
		<p class="field-label">Add it to the home screen</p>
		<p>
			Safari can remove the data of a site that has not been opened for seven days, and grants the
			request to keep it mostly to the app on the home screen. Installed, the app also opens full
			screen, without the browser bars.
		</p>
		<ul class="list-disc space-y-1 pl-5">
			<li><strong>iPhone, iPad:</strong> Share, then “Add to Home Screen”.</li>
			<li><strong>Android:</strong> browser menu, then “Install app”.</li>
		</ul>
	</section>

	<section class="space-y-3">
		<p class="field-label">Your data</p>
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
		<p>
			<strong>Photos</strong> of your models stay on this device as well and are not part of an
			export. Deleting the warband deletes them too. The photo you picked stays in your library; only
			one taken from inside the app exists nowhere else.
		</p>
	</section>

	<section class="space-y-3">
		<p class="field-label">Games and their rules</p>
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
					{#if SOURCES[game.id]}
						<p class="mt-2">{SOURCES[game.id]}</p>
					{/if}
				</li>
			{/each}
		</ul>
	</section>

	<section class="space-y-3">
		<p class="field-label">Questions</p>
		<!-- Rules, not boxes: the links below are the buttons on this page, and two
		     stacks of the same shape read as one list of the same kind of thing. -->
		<div class="border-t border-zinc-700">
			{#each faq as entry (entry.question)}
				<details class="border-b border-zinc-700">
					<summary
						class="flex min-h-11 cursor-pointer items-center justify-between gap-3 px-px py-2 font-semibold text-zinc-200"
					>
						{entry.question}
					</summary>
					<p class="px-px pb-3 text-zinc-400">{entry.answer}</p>
				</details>
			{/each}
		</div>
	</section>

	<section class="space-y-3">
		<p class="field-label">Links</p>
		<ul class="space-y-2">
			<li><a class={linkClass} href="{REPO}/issues" target="_blank" rel="noopener">{@render github()}Feedback and bug reports</a></li>
			<li><a class={linkClass} href="{REPO}/blob/main/ROADMAP.md" target="_blank" rel="noopener">{@render github()}What is planned</a></li>
			<li><a class={linkClass} href="{REPO}/blob/main/DEVIATIONS.md" target="_blank" rel="noopener">{@render github()}Where the app reads the rules its own way</a></li>
			<li><a class={linkClass} href={REPO} target="_blank" rel="noopener">{@render github()}Source code</a></li>
			<li><a class={linkClass} href={CARD_CREATOR} target="_blank" rel="noopener">{@render external()}Warcry Card Creator 2026</a></li>
		</ul>
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
