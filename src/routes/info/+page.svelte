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
		'black-death-city': 'https://www.blackdeathcity.com/'
	};

	const SOURCES: Record<string, string> = {
		wyrdcry:
			`Wyrdcry is by ${systems.wyrdcry.game.author}. The rules here are copied from the hand-kept ruleset of the Wyrdcry Warband Deck, which follows the rules at wyrdcry.net. The official factions only.`,
		'black-death-city':
			`Transcribed by hand from the Black Death City Playtest v1.01 by ${systems['black-death-city'].game.author}. Where the playtest contradicts itself, the fighter’s own scroll wins over the fighter list.`
	};

	const games = Object.values(systems)
		.map((s) => ({
			id: s.game.id,
			name: s.game.name,
			edition: s.game.edition,
			factions: s.factions.map((f) => f.name).sort((a, b) => a.localeCompare(b))
		}))
		.sort((a, b) => a.name.localeCompare(b.name));

	/* Answered here rather than only in the README: whoever builds a warband on
	   a phone is not the one browsing the repository. */
	const faq = [
		{
			question: 'Why is a button disabled?',
			answer:
				'Because pressing it would take the warband too far: over its budget, past the limit of a fighter or a group, or against its Origin. The button says which. What the warband still lacks – a leader, enough henchmen, an open choice – is never blocked; it is listed as still to do.'
		},
		{
			question: 'Can I change a warband later?',
			answer:
				'Yes, every step stays open: tap the warband on the start page and go to the step you want. Changing the faction removes its fighters and its choice, and asks first.'
		},
		{
			question: 'Does the app apply every rule?',
			answer:
				'Not yet. It knows the profiles, costs, limits and what each fighter may carry, and what an Origin changes about the roster. State Pride’s effects on the profiles, the skills and spells picked on recruitment, and anything that happens in a campaign are still to come.'
		},
		{
			question: 'Where is Mordheim?',
			answer: 'Planned. It is listed when you pick a game, but cannot be chosen yet.'
		}
	];

	const linkClass =
		'flex min-h-11 items-center justify-center gap-2 rounded border border-zinc-700 bg-zinc-800 px-4 font-semibold text-zinc-200 transition hover:bg-zinc-700 focus-visible:bg-zinc-700';
</script>

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
			{[`Version ${__APP_VERSION__}`, buildDate ? `Build ${buildDate}` : null].filter(Boolean).join(' · ')}
		</p>
		<p>
			Build a warband for a skirmish game set in a fantasy city, step by step, with the budget and
			the roster limits checked as you go.
		</p>
		<p class="text-zinc-400">
			An unofficial fan project, not commercial, with no affiliation with or endorsement from Games
			Workshop, Johan Markström and the Wyrdcry project, or Sam Pearson and Black Death City.
		</p>
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
			<strong>There is no export yet.</strong> Clearing the site's data removes your warbands, and Safari
			can remove them by itself after seven days in which the site was not opened.
		</p>
	</section>

	<section class="space-y-3">
		<p class="field-label">Games and their rules</p>
		<ul class="space-y-3">
			{#each games as game (game.id)}
				<li class="rounded-md border border-zinc-700 bg-zinc-800 p-3">
					<p class="font-semibold text-zinc-200">
						{#if SITES[game.id]}
							<a class="underline decoration-zinc-500 underline-offset-2 hover:decoration-current" href={SITES[game.id]}
								>{game.name}</a
							>
						{:else}
							{game.name}
						{/if}
						<span class="font-normal text-zinc-400">· {game.edition}</span>
					</p>
					<p class="text-zinc-400">{game.factions.join(', ')}</p>
					{#if SOURCES[game.id]}
						<p class="mt-2">{SOURCES[game.id]}</p>
					{/if}
				</li>
			{/each}
			{#each planned as game (game.id)}
				<li class="rounded-md border border-zinc-700 p-3">
					<p class="font-semibold text-zinc-200">{game.name} <span class="font-normal text-zinc-400">· planned</span></p>
				</li>
			{/each}
		</ul>
	</section>

	<section class="space-y-3">
		<p class="field-label">Questions</p>
		<div class="space-y-1">
			{#each faq as entry (entry.question)}
				<details class="rounded-md border border-zinc-700 bg-zinc-800">
					<summary class="flex min-h-11 cursor-pointer items-center px-3 font-semibold text-zinc-200">
						{entry.question}
					</summary>
					<p class="px-3 pb-3">{entry.answer}</p>
				</details>
			{/each}
		</div>
	</section>

	<section class="space-y-3">
		<p class="field-label">Links</p>
		<ul class="space-y-2">
			<li><a class={linkClass} href="https://wyrdcry.net/docs/rules/introduction/">Wyrdcry rules</a></li>
			<li><a class={linkClass} href="https://www.blackdeathcity.com/">Black Death City</a></li>
			<li><a class={linkClass} href="{REPO}/issues">{@render github()}Feedback and bug reports</a></li>
			<li><a class={linkClass} href="{REPO}/blob/main/ROADMAP.md">{@render github()}What is planned</a></li>
			<li><a class={linkClass} href={REPO}>{@render github()}Source code</a></li>
		</ul>
	</section>

	<a
		class="block rounded bg-[#125E3C] px-8 py-4 text-center text-base font-semibold text-white transition hover:bg-[#16754A] focus-visible:bg-[#16754A]"
		href={resolve('/')}>Back to your warbands</a
	>
</main>
