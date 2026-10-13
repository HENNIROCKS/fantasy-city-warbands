/**
 * Service worker, as the Wyrdcry Warband Deck has it: the app starts without
 * a network once it has been opened online. The game data is bundled into the
 * app's own scripts, so caching the build is caching the data – pdfmake and
 * the card's fonts included, so a roster can be made offline too.
 *
 * Every file of a build is cached on install, under a name that carries the
 * build's version. Those files never change within a version, so they are
 * answered from the cache first. A page is asked of the network first, so the
 * update bar's Reload reaches the new deploy rather than the page this worker
 * cached for the old one – but only for a few seconds: on a connection that
 * hangs rather than fails, the cached page starts the app.
 */

/// <reference types="@sveltejs/kit" />
/// <reference lib="webworker" />

import { build, files, prerendered, version } from '$service-worker';

const worker = self as unknown as ServiceWorkerGlobalScope;

/* Cache Storage belongs to the whole origin, and on GitHub Pages that origin
   is shared with every other project of the account. Only caches under this
   prefix are ours to delete. */
const PREFIX = 'fantasy-city-warbands-';
const CACHE = `${PREFIX}${version}`;
/* `files` includes `.nojekyll`, an instruction to GitHub Pages rather than part
   of the app. Not every server hands out a dotfile, and one failed file fails
   the whole install. */
const served = files.filter((path) => !path.split('/').pop()?.startsWith('.'));
const ASSETS = new Set([...build, ...served, ...prerendered]);
/* How long a page waits for the network before the cached one is shown. */
const PATIENCE = 3000;

worker.addEventListener('install', (event) => {
	event.waitUntil(
		caches
			.open(CACHE)
			.then((cache) => cache.addAll([...ASSETS]))
			.then(() => worker.skipWaiting())
	);
});

worker.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) => Promise.all(keys.filter((key) => key.startsWith(PREFIX) && key !== CACHE).map((key) => caches.delete(key))))
			.then(() => worker.clients.claim())
	);
});

worker.addEventListener('fetch', (event) => {
	const url = new URL(event.request.url);
	if (event.request.method !== 'GET' || url.origin !== location.origin) return;

	event.respondWith(
		(async () => {
			const cache = await caches.open(CACHE);

			if (event.request.mode !== 'navigate' && ASSETS.has(url.pathname)) {
				const cached = await cache.match(url.pathname);
				if (cached) return cached;
			}

			/* A page, and anything the build does not list – the version file the
			   update bar asks for among them – goes to the network, and to the
			   cache only without one. A page is found by its path: `?id=` is the
			   app's to read, not part of the file. */
			const network = fetch(event.request);
			if (event.request.mode === 'navigate') {
				const page = await cache.match(url.pathname);
				if (page) {
					const late = new Promise<null>((resolve) => setTimeout(() => resolve(null), PATIENCE));
					return (await Promise.race([network.catch(() => null), late])) ?? page;
				}
			}
			try {
				return await network;
			} catch (error) {
				const cached = (await cache.match(event.request)) ?? (await cache.match(url.pathname));
				if (cached) return cached;
				throw error;
			}
		})()
	);
});

export {};
