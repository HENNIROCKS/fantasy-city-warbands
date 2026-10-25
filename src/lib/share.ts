/**
 * Hands a file or a link to the person: the system share sheet – where "Save
 * to Files", Drive, AirDrop and Mail live – or, where there is none (desktop),
 * a download or the clipboard.
 */

export type ShareResult = 'shared' | 'downloaded' | 'cancelled';

/**
 * The file goes alone: iOS shares a title as a text of its own, and AirDrop
 * delivers it as a second file beside the first.
 *
 * The share sheet is used only under a finger. On a Mac, Safari and Arc open
 * one too, but it offers AirDrop, Mail and Messages and nowhere to save.
 */
export async function shareFile(file: File): Promise<ShareResult> {
	if (matchMedia('(pointer: coarse)').matches && navigator.canShare?.({ files: [file] })) {
		try {
			await navigator.share({ files: [file] });
			return 'shared';
		} catch (error) {
			if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
			/* Share declined or unavailable – a download still beats nothing. */
		}
	}

	const url = URL.createObjectURL(file);
	const anchor = document.createElement('a');
	anchor.href = url;
	anchor.download = file.name;
	/* The anchor has to be in the DOM and the URL may only go after the click,
	   otherwise the download breaks in Safari. */
	document.body.appendChild(anchor);
	anchor.click();
	anchor.remove();
	setTimeout(() => URL.revokeObjectURL(url), 10_000);
	return 'downloaded';
}

export type LinkResult = 'shared' | 'copied' | 'cancelled' | 'failed';

/**
 * Hands a link on: the share sheet under a finger, the clipboard elsewhere.
 * 'failed' leaves it to the page to show the link to be copied by hand.
 */
export async function shareLink(url: string): Promise<LinkResult> {
	if (matchMedia('(pointer: coarse)').matches && navigator.share) {
		try {
			await navigator.share({ url });
			return 'shared';
		} catch (error) {
			if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
		}
	}
	try {
		await navigator.clipboard.writeText(url);
		return 'copied';
	} catch {
		return 'failed';
	}
}

/** A name with what a file system refuses replaced. */
export function safeName(name: string): string {
	return name.replace(/[/\\:*?"<>|]/g, '-').trim();
}
