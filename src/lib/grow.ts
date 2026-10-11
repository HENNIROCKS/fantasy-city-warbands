/** A text field as tall as what it holds, so the page scrolls and the field never does. */
export function grow(node: HTMLTextAreaElement) {
	const fit = () => {
		node.style.height = 'auto';
		/* The field is sized with its border, the scroll height counts without it. */
		node.style.height = `${node.scrollHeight + node.offsetHeight - node.clientHeight}px`;
	};
	fit();
	node.addEventListener('input', fit);
	return { destroy: () => node.removeEventListener('input', fit) };
}
