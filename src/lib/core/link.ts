/**
 * A warband in a link, to show an opponent its cards. The site has no server
 * to keep it, so the link carries the warband itself: in the fragment, which a
 * browser never sends, packed small enough for a QR code.
 *
 * It is the export's warband with what the opponent does not need left out –
 * the campaign's record, the player's own texts, the dates, the ids – so a
 * link is not a way to move a warband between devices; the file is. Instead of
 * the export's envelope, the fragment starts with the file version and a dot,
 * which base64url never holds; a fragment without it is the whole envelope.
 */

import { readWarbandFile, toFile, VERSION, type Known, type ReadResult } from './transfer';
import type { Warband } from './types';

/** The warband a link carries: no ids, which, random, take more room than the rest packed. */
type Shown = Omit<Warband, 'id' | 'fighters'> & { fighters: Omit<Warband['fighters'][number], 'instanceId'>[] };

/** The warband as the opponent sees it: what its cards need, nothing to remember it by. */
function shown(warband: Warband): Shown {
	const { id: _id, fluff: _fluff, notes: _notes, history: _history, finds: _finds, next: _next, updatedAt: _updatedAt, ...rest } = warband;
	return { ...rest, fighters: warband.fighters.map(({ instanceId: _instanceId, fluff: _fluff, notes: _notes, ...fighter }) => fighter) };
}

/** Ids for the cards to tell apart, in the fighters' order; the page keeps nothing under them. */
function withIds(warband: Shown): Warband {
	return { ...warband, id: 'shown', fighters: warband.fighters.map((fighter, i) => ({ ...fighter, instanceId: `shown-${i}` })) };
}

async function pipe(bytes: Uint8Array<ArrayBuffer>, stream: CompressionStream | DecompressionStream): Promise<Uint8Array<ArrayBuffer>> {
	const out = new Blob([bytes]).stream().pipeThrough(stream);
	return new Uint8Array(await new Response(out).arrayBuffer());
}

function toBase64Url(bytes: Uint8Array): string {
	let binary = '';
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> {
	const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
	return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

/** The fragment that carries the warband, without its `#`. */
export async function toFragment(warband: Warband): Promise<string> {
	const json = JSON.stringify(shown(warband));
	return `${VERSION}.` + toBase64Url(await pipe(new TextEncoder().encode(json), new CompressionStream('deflate-raw')));
}

const BROKEN: ReadResult = { ok: false, message: 'This link holds no warband. Ask for a new code.' };

/** Reads a fragment back, with or without its `#`, as an import reads a file. */
export async function fromFragment(fragment: string, known: Known): Promise<ReadResult> {
	const [, version, text] = fragment.replace(/^#/, '').match(/^(?:(\d+)\.)?(.*)$/s)!;
	if (!text) return BROKEN;
	let json: string;
	try {
		json = new TextDecoder().decode(await pipe(fromBase64Url(text), new DecompressionStream('deflate-raw')));
	} catch {
		/* Cut short or mistyped: neither base64 nor the stream says which. */
		return BROKEN;
	}
	if (version === undefined) return readWarbandFile(json, known);
	let parsed: Shown;
	try {
		parsed = JSON.parse(json);
	} catch {
		return BROKEN;
	}
	if (typeof parsed !== 'object' || parsed === null || !Array.isArray(parsed.fighters)) return BROKEN;
	const file = { ...toFile(withIds(parsed)), version: Number(version) };
	return readWarbandFile(JSON.stringify(file), known);
}
