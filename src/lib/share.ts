/**
 * Hands a file to the person: the system share sheet – where "Save to Files",
 * Drive, AirDrop and Mail live – or, where there is none (desktop), a download.
 */

export type ShareResult = 'shared' | 'downloaded' | 'cancelled';

/**
 * The file goes alone: iOS shares a title as a text of its own, and AirDrop
 * delivers it as a second file beside the first.
 */
export async function shareFile(file: File): Promise<ShareResult> {
	if (navigator.canShare?.({ files: [file] })) {
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

/** A name with what a file system refuses replaced. */
export function safeName(name: string): string {
	return name.replace(/[/\\:*?"<>|]/g, '-').trim();
}
