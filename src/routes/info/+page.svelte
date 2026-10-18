<script lang="ts">
	import { resolve } from '$app/paths';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import { APP_NAME, APP_TITLE, BUILD_DATE, REPO, STAGE } from '$lib/app';
	// import { areas } from '$lib/core/coverage';
	import { planned, systems } from '$lib/systems';

	/** Each game's own site and where its rules come from, by game id. */
	const SITES: Record<string, string> = {
		wyrdcry: 'https://wyrdcry.net',
		'black-death-city': 'https://www.blackdeathcity.com/',
		mordheim: 'https://mordheimer.net/',
		necropolis: 'https://drive.google.com/file/d/1o60MheZKHSKCFAGHkzloo93Uj7TRvGff/'
	};

	const SOURCES: Record<string, string> = {
		// wyrdcry:
		// 	'The rules here are copied from the hand-kept ruleset of the Wyrdcry Warband Deck, which follows the rules at wyrdcry.net.',
		// 'black-death-city': 'Transcribed by hand from the Black Death City Playtest v1.01.'
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
				'Yes, every step stays open: tap the warband on the start page and go to the step you want. Changing the faction removes its fighters and its choice, and asks first. A fighter’s name, fluff, notes and photo are written on the back of its card: the pencil under the card turns it over. There it also hands what it bought to the stash and takes pieces from it, as long as it may carry them; not during a battle. Buying is in the Fighters step, which the back links to. In Wyrdcry that step offers the Trading Post to every fighter that takes equipment, one of each piece, and asks before a rare one whether a Rarity roll of 6+ found it. In Wyrdcry its renown is corrected there too, for a battle the app did not count; it does not go below a level already spent. Spend renown there turns to a page of its own for the next open level, and the levels spent are listed under it, the last with Undo; the injuries the fighter keeps are listed below, each to remove for a result tapped by mistake, with why it sits out – Got back ends a capture – all of it kept until Done. The warband’s favour is set the same way in the Finish step and on the back of the warband card, with the standing and reputation it comes to beside it; the list on the start page shows them too. The pencil under the warband card turns it over to write its name, fluff and notes, pick the colour of its cards – the deck shows it at once, and Cancel brings back the one before –, add gold, sell or throw away what lies in the stash, and add or strike battles; nothing changes until Done. Wyrdcry sells a piece for half its price, rounded down to 5 gc and never below 5 gc; Black Death City’s playtest has no rule for selling yet, so a piece there can only be thrown away.'
		},
		{
			question: 'Can I bring a warband over from the Warband Deck?',
			answer:
				'Yes: export it there, then Import warband on the start page here takes the file – one from the Warband Builder too. Renown, favour, gold, stash, fluff, notes, colour and battle history come along; experience does not, since the Campaign Book counts renown only. The sheet before importing says what is carried over differently: purchases still pending in the builder are taken as bought, custom abilities and weapons go into the warband’s notes, and renown levels without a record of what they were spent on count as spent. Clan Pestilens and the Greenskin Marauders are not here yet, and a hired sword shows as unknown.'
		},
		{
			question: 'Can I keep one warband at the top?',
			answer:
				'Yes: tap the star beside it on the start page. One warband at a time; the others stay A to Z. The star stays on this device and is not part of an export.'
		},
		{
			question: 'Does the app apply every rule?',
			answer:
				'Not yet. It knows the profiles, costs, limits and what each faction sells to each fighter, how much a fighter may carry at once, what an Origin changes about the roster, the spell, characteristic or mutation a Wyrdcry fighter brings on recruitment, and in Wyrdcry the renown, favour and income a battle brings, as the Campaign Book 0.9 has them. A Wyrdcry fighter’s characteristics count in its pick, its renown, its injuries and its armour; tap one to see how it adds up, and a star marks one a situation can still change, such as Parry or a shield. State Pride’s effects on the profiles, the special rules of Black Death City’s fighters, the skills and spells they pick on recruitment, the cost of a Misbegotten’s bloodline mutation and Black Death City’s campaign are still to come.'
		},
		{
			question: 'Can I track a battle?',
			answer:
				'Yes. On the warband card, Battle starts it, moves on to the next round – one step back is possible until the next tap – and ends it; the bar there says the round, how many fighters still have to act and whether the warband is wavering. On a fighter’s card, the bar at the foot takes Health down a point at a time, and a fighter at none is out of action – with the Wilhelm scream, which the Battle menu turns off. State beside it marks a fighter activated or waiting, and in Wyrdcry in cover, panicked, or a HERO’s heroic reaction as used; the card carries each as a band, and panicked takes a point off Fight and Shoot. The next round clears activated, waiting and panicked and keeps the rest. In Wyrdcry, a warband with more than half its fighters out of action, rounding up, wavers: as the round ends, every fighter carries Bravery test into the next one, and one that fails it is marked panicked until that round ends. The Witch Hunters count Zeal where the round would stand, and its stages go into every fighter’s figures. The first tap on a fighter starts a battle too. In Wyrdcry, ending it opens pages over the deck, each set like the back of a card with its answers at the foot: the result, the shards delivered with what they bring in favour and gold, and the line in the history; who was taken out of action, as the battle left it; for each of them the injury table, to tap what the dice rolled – an injury the fighter already has counts as a Flesh Wound, a fourth kills a HERO, and a fighter with Unbending Will rolls none; then each fighter’s renown roll – whether it took part, +1 for not taken out of action and +1 for taking an enemy out of action, the score it needs and whether the die reached it; the one marked for greatness rolls twice. Under a result that needs it, the page asks the rest: whether the roll recovered a dead fighter’s equipment on a 3+, and whether a surgeon was paid and what the roll said. Keep playing on the first page goes back to the battle. Apply writes it into the warband, keeps each injury on the fighter’s card with what it changes, takes a dead fighter off the roster and its recovered equipment into the stash – a dead leader stays, marked Dead, until the app can pick another –, takes the surgeon’s 15 gc and a robbed fighter’s equipment, marks a fighter Captured or missing the next battle until it is back, raises renown by the levels the rolls brought, and adds the battle to the history on the warband card, with favour, standing and reputation beside it. Then a sheet asks what each new level of renown is spent on – a characteristic within the fighter’s racial limit on every level, and for a hero a heroic talent on every odd one, for a wizard another spell in its place; a legendary ability from renown 5, one fighter per warband – and Decide later leaves it under Spend renown in the Battle menu. A recruited leader starts with a level to spend, and a level spent under older rules opens again for what it lacks. A henchman’s third level makes it a HERO. Cancel battle drops it without any of that. In Black Death City, ending it only drops it. What a battle holds stays on this device until then. The scream comes from Wikimedia Commons, where it is released under CC0.'
		},
		{
			question: 'Can I show my painted models?',
			answer:
				'Yes, on the back of a fighter’s card: choose a photo, drag it into place and zoom it, and Done puts it in the card’s image field. It stays on this device and is not part of an export.'
		},
		{
			question: 'Can I print a warband?',
			answer:
				'Yes, as a roster in PDF, from the page icon beside the warband on the start page: the warband, in Wyrdcry with its battles won, drawn and lost, a row for each fighter with its profile, in Wyrdcry its renown, its abilities, weapons and notes, then every rule of the warband, its fighters and their gear once, with the fighters that carry it. It is a first version and will change; each game is to get the sheet it prints itself, and Black Death City’s playtest has none yet.'
		},
		{
			question: 'Which rules does the app follow?',
			answer: `Wyrdcry ${systems.wyrdcry.game.edition}, as kept in the Wyrdcry Warband Deck; what the core rules decide – cover, morale, the universal abilities and reactions, the weapon rules, and that no modifier takes a characteristic below 1 – already follows the 1.0 rulebook, a work in progress. Black Death City ${systems['black-death-city'].game.edition}; where the playtest contradicts itself, the fighter’s own scroll wins over the fighter list.`
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
			{['by Hendrik Berends', `Version ${__APP_VERSION__}`, BUILD_DATE ? `Build ${BUILD_DATE}` : null].filter(Boolean).join(' · ')}
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
			screen, without the browser bars. Once it has been opened with a network, it also starts
			without one, the roster included; a new version comes with the next start online.
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
		<!-- <p>
			The ring beside a game when you pick it is a rough count of how much of the game the app carries:
			one piece for each of these, filled where it is built.
		</p>
		<ul class="list-disc space-y-1 pl-5">
			{#each areas as area (area.label)}
				<li>{area.label}</li>
			{/each}
		</ul> -->
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
