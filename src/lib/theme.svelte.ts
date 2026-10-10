/** Light or dark, mirrored from `data-theme` on the root, which app.html sets before the first render. */
class Theme {
	dark = $state(true);

	init() {
		this.dark = document.documentElement.dataset.theme !== 'light';
	}

	toggle() {
		this.dark = !this.dark;
		const value = this.dark ? 'dark' : 'light';
		document.documentElement.dataset.theme = value;
		try {
			localStorage.setItem('theme', value);
		} catch {
			/* The choice then holds for this visit only. */
		}
	}
}

export const theme = new Theme();
