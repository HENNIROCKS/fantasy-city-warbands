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
import { today } from '$lib/core/history';
import { tokenize } from '$lib/core/markup';
import type { Roster, RosterFighter, RosterRule } from '$lib/core/roster';
import { safeName } from '$lib/share';

/* A4 landscape, 10 mm margins, 14 mm at the foot for the footer. */
const MARGIN = 28.35;
const MARGIN_FOOT = 39.7;

const HAIR = 0.4;
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
 * the rows and a finer one between the columns. `tight` names columns
 * that get by on less padding, the figures.
 */
function ruled(tight: number[] = []): CustomTableLayout {
	const side = (i: number) => (tight.includes(i) ? 3.5 : 6);
	return {
		hLineWidth: (i, node) => (i !== 0 && i === node.table.headerRows ? THICK : THIN),
		vLineWidth: (i, node) => (i === 0 || i === node.table.body[0].length ? THIN : HAIR),
		paddingLeft: side,
		paddingRight: side,
		paddingTop: () => 4.5,
		paddingBottom: () => 4.5
	};
}

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
				[nameCell(roster.name, roster.subtitle), ...roster.figures.map((f) => figure(f.value))],
				/* As on the Warband Deck's sheet: the stash on a line of its own, across the table. */
				...(roster.stash
					? [[{ text: [{ text: 'Stash: ', bold: true }, roster.stash], colSpan: roster.figures.length + 1 }, ...roster.figures.map(() => '')]]
					: [])
			]
		},
		layout: ruled(),
		margin: [0, 0, 0, 15]
	};
}

/* A weapon's line and the line of each of its values, a little apart from the
   one above. Each column is a stack of its own, so a weapon's values stay level
   with its name only while the name keeps to one line. */
const line = (cell: ContentText, i: number): ContentText => ({ ...cell, margin: [0, i === 0 ? 0 : 2.5, 0, 0] });

/* The weapons with their profiles in the game's columns, the name first, then
   armour and items under the names in one line, since they have no profile. */
function profiles(fighter: RosterFighter, roster: Roster): TableCell[] {
	const names: ContentText[] = fighter.weapons.map((weapon) => ({ text: weapon.name }));
	if (fighter.items) names.push({ text: fighter.items });
	return [
		names.length ? { stack: names.map(line) } : '–',
		...roster.weaponLabels.map((_, column) => ({ stack: fighter.weapons.map((weapon, i) => line(figure(weapon.values[column] ?? ''), i)) }))
	];
}

function fighterTable(roster: Roster): Content {
	/* The figure columns, counted from 0: the stats, the campaign's counters,
	   the cost – then, after keywords, abilities and the weapon's name, its profile. */
	const figures = Array.from({ length: roster.statLabels.length + roster.campaignLabels.length + 1 }, (_, i) => i + 1);
	const profile = roster.weaponLabels.map((_, i) => figures.length + 4 + i);

	const head: TableCell[] = [
		th({ text: 'Name / Type', noWrap: true }),
		...[...roster.statLabels, ...roster.campaignLabels, roster.currency].map((text) => th(figure(text))),
		th('Keywords'),
		th('Abilities'),
		th({ text: 'Weapons & Equipment', noWrap: true }),
		...roster.weaponLabels.map((text) => th(figure(text))),
		th('Notes')
	];

	const rows = roster.fighters.map((fighter): TableCell[] => [
		nameCell(fighter.name, fighter.type),
		...[...fighter.stats, ...fighter.campaign, fighter.cost].map(figure),
		{ text: fighter.keywords.toUpperCase(), fontSize: 8 },
		fighter.abilities.length ? { stack: fighter.abilities } : '–',
		...profiles(fighter, roster),
		fighter.notes.length ? { stack: fighter.notes.map((note) => ({ text: rich(note) })) } : '–'
	]);

	return {
		table: {
			headerRows: 1,
			dontBreakRows: true,
			widths: ['*', ...figures.map(() => 'auto'), 85, 100, 110, ...profile.map(() => 'auto'), 70],
			body: [head, ...rows]
		},
		layout: ruled([...figures, ...profile])
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

/** The document itself, apart from loading pdfmake and its fonts. The footer carries the day it was made, as the file's name does. */
export function rosterDoc(roster: Roster, now = new Date()): TDocumentDefinitions {
	return {
		info: { title: `${roster.name} – ${roster.title}` },
		pageSize: 'A4',
		pageOrientation: 'landscape',
		pageMargins: [MARGIN, MARGIN, MARGIN, MARGIN_FOOT],
		defaultStyle: { font: 'Alegreya', fontSize: 9.5 },
		styles: { th: { bold: true, fontSize: 10 } },
		footer: { text: `${roster.title} · ${today(now)}`, alignment: 'right', fontSize: 8, margin: [MARGIN, 14, MARGIN, 0] },
		content: [warbandTable(roster), fighterTable(roster), ...(roster.rules.length ? [rulesTable(roster)] : [])]
	};
}

export async function rosterPdf(roster: Roster, now = new Date()): Promise<File> {
	const { default: pdfMake } = await import('pdfmake/build/pdfmake');

	pdfMake.addFonts({
		Alegreya: {
			normal: absolute(regular),
			bold: absolute(bold),
			italics: absolute(italic),
			bolditalics: absolute(bold)
		}
	});

	const blob = await pdfMake.createPdf(rosterDoc(roster, now)).getBlob();
	return new File([blob], `${safeName(roster.name)} – ${roster.title} – ${today(now)}.pdf`, { type: 'application/pdf' });
}
