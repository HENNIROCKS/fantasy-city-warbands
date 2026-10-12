/**
 * The roster as a PDF file, laid out as the Wyrdcry Warband Deck's. Built here
 * rather than printed from a page: the app installed on an iPhone has no print
 * dialog, and Safari neither repeats a table's header on the next page nor
 * prints a footer of the page's own.
 *
 * pdfmake is loaded on the first roster, not with the app. Sizes are in points.
 */

import type { Content, ContentText, CustomTableLayout, TableCell, TDocumentDefinitions } from 'pdfmake/interfaces';
import bold from '$lib/assets/card/Alegreya-Bold.ttf?url';
import italic from '$lib/assets/card/Alegreya-Italic.ttf?url';
import regular from '$lib/assets/card/Alegreya-Regular.ttf?url';
import { tokenize } from '$lib/core/markup';
import type { Roster, RosterFighter, RosterRule } from '$lib/core/roster';
import { safeName } from '$lib/share';

/* A4 landscape, 10 mm margins, 14 mm at the foot for the footer. */
const MARGIN = 28.35;
const MARGIN_FOOT = 39.7;

const THIN = 0.75;
const THICK = 1.5;

/* Lining figures of one width, so a column of digits stands straight.
   Alegreya sets old-style figures otherwise. */
function figure(text: string): ContentText {
	return { text, alignment: 'center', fontFeatures: ['lnum', 'tnum'] };
}

/** A header cell. */
function th(cell: string | ContentText): ContentText {
	return { ...(typeof cell === 'string' ? { text: cell } : cell), style: 'th' };
}

/**
 * The ruled tables: a frame, a heavier rule under the header, a rule between
 * the rows and none between the columns. `tight` names columns that get by on
 * less padding, the figures; `bare` one that holds a table of its own.
 */
function ruled(tight: number[] = [], bare: number[] = []): CustomTableLayout {
	const side = (i: number) => (bare.includes(i) ? 0 : tight.includes(i) ? 3.5 : 6);
	return {
		hLineWidth: (i, node) => (i !== 0 && i === node.table.headerRows ? THICK : THIN),
		vLineWidth: (i, node) => (i === 0 || i === node.table.body[0].length ? THIN : 0),
		paddingLeft: side,
		paddingRight: side,
		paddingTop: () => 4.5,
		paddingBottom: () => 4.5
	};
}

/* The weapon profiles inside a fighter's row, and their header above: the name,
   then one narrow column per value the game prints. */
const weaponWidths = (roster: Roster) => ['*', ...roster.weaponLabels.map(() => 26)];

const profileLayout: CustomTableLayout = {
	hLineWidth: () => 0,
	vLineWidth: () => 0,
	paddingLeft: (i) => (i === 0 ? 6 : 2),
	paddingRight: (i) => (i === 0 ? 6 : 2),
	paddingTop: (i) => (i === 0 ? 0 : 2.5),
	paddingBottom: () => 0
};

/** Rules text: bold and italic as marked, keywords in capitals, line breaks kept. */
function rich(text: string): Content[] {
	return tokenize(text.trim()).map((token) => {
		if (token.kind === 'bold') return { text: token.value, bold: true };
		if (token.kind === 'italic') return { text: token.value, italics: true };
		if (token.kind === 'keyword') return { text: token.value.toUpperCase() };
		return { text: token.value };
	});
}

function prefix(rule: RosterRule): Content[] {
	return rule.tag ? [{ text: `${rule.tag} `, bold: true }] : [];
}

function nameCell(name: string, type: string): TableCell {
	return {
		stack: [
			{ text: name, bold: true },
			{ text: type, fontSize: 8.5 }
		]
	};
}

function warbandTable(roster: Roster): Content {
	return {
		table: {
			headerRows: 1,
			widths: ['*', ...roster.figures.map(() => 'auto')],
			body: [
				[th('Warband / Game & Faction'), ...roster.figures.map((f) => th(figure(f.label)))],
				[nameCell(roster.name, roster.subtitle), ...roster.figures.map((f) => figure(f.value))]
			]
		},
		layout: ruled(),
		margin: [0, 0, 0, 15]
	};
}

function profiles(fighter: RosterFighter, roster: Roster): TableCell {
	const span = 1 + roster.weaponLabels.length;
	const rows: TableCell[][] = fighter.weapons.map((weapon) => [weapon.name, ...weapon.values.map(figure)]);
	if (fighter.items) rows.push([{ text: fighter.items, colSpan: span }, ...Array.from({ length: span - 1 }, () => '')]);
	if (!rows.length) return '–';
	return { table: { widths: weaponWidths(roster), body: rows }, layout: profileLayout };
}

function fighterTable(roster: Roster): Content {
	/* The figure columns, counted from 0: the stats, then the cost. */
	const figures = Array.from({ length: roster.statLabels.length + 1 }, (_, i) => i + 1);
	const weaponColumn = figures.length + 3;

	const head: TableCell[] = [
		th({ text: 'Name / Type', noWrap: true }),
		...[...roster.statLabels, roster.currency].map((text) => th(figure(text))),
		th('Keywords'),
		th('Abilities'),
		{
			table: {
				widths: weaponWidths(roster),
				body: [[th('Weapons & Equipment'), ...roster.weaponLabels.map((text) => th(figure(text)))]]
			},
			layout: profileLayout
		}
	];

	const rows = roster.fighters.map((fighter): TableCell[] => [
		nameCell(fighter.name, fighter.type),
		...[...fighter.stats, fighter.cost].map(figure),
		{ text: fighter.keywords.toUpperCase(), fontSize: 8 },
		fighter.abilities.length ? { stack: fighter.abilities } : '–',
		profiles(fighter, roster)
	]);

	return {
		table: {
			headerRows: 1,
			dontBreakRows: true,
			widths: ['*', ...figures.map(() => 'auto'), 85, 110, 240],
			body: [head, ...rows]
		},
		layout: ruled(figures, [weaponColumn])
	};
}

function rulesTable(roster: Roster): Content {
	return {
		pageBreak: 'before',
		table: {
			headerRows: 1,
			dontBreakRows: true,
			widths: [120, 150, '*'],
			body: [
				['Special Rule', 'Fighter', 'Description'].map((text) => th(text)),
				...roster.rules.map((rule): TableCell[] => [
					rule.name,
					rule.fighters,
					{
						text: [
							...prefix(rule),
							...rich(rule.text),
							...(rule.note ? [{ text: ` ${rule.note}`, italics: true }] : [])
						]
					}
				])
			]
		},
		layout: ruled()
	};
}

/* pdfmake fetches the fonts itself, and needs an address it can resolve on its own. */
const absolute = (url: string) => new URL(url, location.href).href;

/** The document itself, apart from loading pdfmake and its fonts. */
export function rosterDoc(roster: Roster): TDocumentDefinitions {
	return {
		info: { title: `${roster.name} – ${roster.title}` },
		pageSize: 'A4',
		pageOrientation: 'landscape',
		pageMargins: [MARGIN, MARGIN, MARGIN, MARGIN_FOOT],
		defaultStyle: { font: 'Alegreya', fontSize: 9.5 },
		styles: { th: { bold: true, fontSize: 10 } },
		footer: { text: roster.title, alignment: 'right', fontSize: 8, margin: [MARGIN, 14, MARGIN, 0] },
		content: [warbandTable(roster), fighterTable(roster), ...(roster.rules.length ? [rulesTable(roster)] : [])]
	};
}

export async function rosterPdf(roster: Roster): Promise<File> {
	const { default: pdfMake } = await import('pdfmake/build/pdfmake');

	pdfMake.addFonts({
		Alegreya: {
			normal: absolute(regular),
			bold: absolute(bold),
			italics: absolute(italic),
			bolditalics: absolute(bold)
		}
	});

	const blob = await pdfMake.createPdf(rosterDoc(roster)).getBlob();
	return new File([blob], `${safeName(roster.name)} – ${roster.title}.pdf`, { type: 'application/pdf' });
}
