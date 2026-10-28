/* The start screen is markup in app.html, there before the app loads; this
   fades it out and tells when it is gone. */

/** How long the screen stands at least, from the page's start, so its logos have faded in. */
const HOLD = 4100;

/** Fades the screen out once it has stood its time, at once on a tap. */
export function dismissStartScreen() {
	const screen = document.getElementById('start-screen');
	if (!screen) return;
	if (!document.documentElement.classList.contains('start')) return screen.remove();
	const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
	let done = false;
	const fade = () => {
		if (done) return;
		done = true;
		if (still) return screen.remove();
		screen.addEventListener('transitionend', (event) => {
			if (event.target === screen) screen.remove();
		});
		screen.classList.add('gone');
	};
	screen.addEventListener('pointerdown', fade);
	setTimeout(fade, Math.max(0, (still ? 1000 : HOLD) - performance.now()));
}

/** Settles once the start screen is gone, at once where there is none. */
export function startScreenGone(): Promise<void> {
	const screen = document.getElementById('start-screen');
	const parent = screen?.parentNode;
	if (!screen || !parent) return Promise.resolve();
	return new Promise((done) => {
		const watch = new MutationObserver(() => {
			if (screen.isConnected) return;
			watch.disconnect();
			done();
		});
		watch.observe(parent, { childList: true });
	});
}
