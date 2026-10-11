declare module 'virtual:dev-network' {
	/** This dev server's address on the local network, or null without a network connection. */
	export const url: string | null;
	/** The same address as a QR code SVG. */
	export const qr: string | null;
}
