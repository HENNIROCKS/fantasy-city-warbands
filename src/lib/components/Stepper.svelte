<script lang="ts">
	export interface Step {
		label: string;
		/** What was picked in this step, shown under the label once there is something. */
		value?: string;
		/** Null where the step cannot be reached from here. */
		href: string | null;
		/** Something in this step still keeps the warband from being valid. */
		incomplete?: boolean;
	}

	let { steps, current }: { steps: Step[]; current: number } = $props();
</script>

<nav aria-label="Steps">
	<ol class="flex">
		{#each steps as step, i (i)}
			{@const active = i === current}
			{@const done = i < current}
			{@const link = step.href && !active}
			{@const warn = done && step.incomplete}
			<li class="relative min-w-0 flex-1">
				{#if i > 0}
					<!-- The line from the previous circle to this one, green as far as the current step.
					     It runs between the circles' edges, not their centres: a circle's fill can be
					     translucent and would let the line show through. 1.125rem is half a circle
					     (0.875rem) plus a gap of 0.25rem. -->
					<span
						aria-hidden="true"
						class="absolute top-3.5 h-0.5 -translate-y-1/2"
						style="left: calc(-50% + 1.125rem); right: calc(50% + 1.125rem); background: {i <= current
							? '#16754A'
							: 'var(--ui-border)'}"
					></span>
				{/if}
				<svelte:element
					this={link ? 'a' : 'div'}
					href={link ? step.href : undefined}
					aria-current={active ? 'step' : undefined}
					class="group relative flex flex-col items-center gap-1 rounded text-center outline-offset-2 focus-visible:outline-2 focus-visible:outline-[#16754A] {!step.href &&
					!active &&
					!done
						? 'opacity-50'
						: ''}"
				>
					<span
						class="step-circle flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-bold transition"
						class:active
						class:done
						class:link
						class:warn
					>
						{i + 1}
					</span>
					<span
						class="block w-full truncate px-0.5 text-[0.65rem] font-semibold tracking-wider uppercase {active
							? 'text-zinc-200'
							: 'text-zinc-400'}"
					>
						{step.label}
					</span>
					{#if warn}
						<span class="sr-only">(incomplete)</span>
					{/if}
					{#if step.value}
						<span class="hidden w-full truncate px-0.5 text-xs text-zinc-400 sm:block">{step.value}</span>
					{/if}
				</svelte:element>
			</li>
		{/each}
	</ol>
</nav>

<style>
	.step-circle {
		background: var(--ui-surface);
		border-color: var(--ui-border);
		color: var(--ui-text-muted);
	}

	.step-circle.done {
		background: var(--ui-sel-bg);
		border-color: #16754a;
		color: var(--ui-sel-text);
	}

	.step-circle.done.warn {
		background: var(--ui-warn-bg);
		border-color: var(--ui-warn-text);
		color: var(--ui-warn-text);
	}

	.step-circle.active {
		background: #16754a;
		border-color: #16754a;
		color: #ffffff;
	}

	.step-circle.link:not(.active) {
		cursor: pointer;
	}

	:global(.group:hover) > .step-circle.link,
	:global(.group:focus-visible) > .step-circle.link {
		border-color: #1c965f;
	}
</style>
