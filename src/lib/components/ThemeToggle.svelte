<script lang="ts">
	import { theme } from '$lib/theme.svelte';
</script>

<!-- The icon beside the knob names the current mode: a moon on the left when
     dark, with the knob on the right; a sun on the right when light. -->
<button type="button" role="switch" aria-checked={theme.dark} onclick={() => theme.toggle()} class="theme-switch" aria-label="Dark mode" title="Dark mode">
	<span class="theme-switch-track">
		<svg class="theme-switch-icon theme-switch-moon" width="14" height="14" viewBox="3 3 18 18" fill="currentColor" aria-hidden="true">
			<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
		</svg>
		<svg class="theme-switch-icon theme-switch-sun" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true">
			<circle cx="8" cy="8" r="3.5" fill="currentColor" stroke="none" />
			<line x1="8" y1="2.1" x2="8" y2="1.4" />
			<line x1="8" y1="13.9" x2="8" y2="14.6" />
			<line x1="2.1" y1="8" x2="1.4" y2="8" />
			<line x1="13.9" y1="8" x2="14.6" y2="8" />
			<line x1="3.83" y1="3.83" x2="3.33" y2="3.33" />
			<line x1="12.17" y1="12.17" x2="12.67" y2="12.67" />
			<line x1="3.83" y1="12.17" x2="3.33" y2="12.67" />
			<line x1="12.17" y1="3.83" x2="12.67" y2="3.33" />
		</svg>
		<span class="theme-switch-knob"></span>
	</span>
</button>
