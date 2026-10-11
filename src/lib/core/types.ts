/**
 * The shapes every game system shares: what it takes to build a warband and
 * change it later. What only one game knows – a weapon's profile, slots, the
 * effects of a choice – stays out of here and belongs to that game's system.
 */

export interface Span {
	min: number;
	/** Null where the rules set no upper bound. */
	max: number | null;
}

/**
 * How a characteristic reads on the card: `5`, `5"`, or `3+` for a roll to
 * meet. Only the display differs; the profile stores the bare number.
 */
export type StatFormat = 'plain' | 'inches' | 'target';

export interface StatDef {
	key: string;
	label: string;
	/** For a narrow screen, where a long label does not fit its column: `Init` for Initiative. */
	short?: string;
	format: StatFormat;
}

/**
 * How many fighters carrying a keyword a warband may have, such as Black Death
 * City's 0-3 Champions. Counted across fighter types, unlike a fighter's own
 * `limit`.
 */
export interface GroupLimit {
	keyword: string;
	/** As the rules name the group in a message: `Henchmen`. */
	label: string;
	limit: Span;
}

export interface GameSystem {
	id: string;
	name: string;
	/** Which version of the rules the data follows, as the game names it. */
	edition: string;
	/** Who wrote the game, as its preview names them. */
	author: string;
	/** As printed after a cost: `gc`, `silver`. */
	currency: string;
	/** Spelled out where there is room, such as the game's preview: `gold coins`. Without it, `currency`. */
	currencyName?: string;
	/** What a new warband has to spend. */
	budget: number;
	/** In the order the profile prints them. */
	stats: StatDef[];
	/** The key of the stat that damage counts down: `health`, `life`. */
	health: string;
	/**
	 * The keywords that name a fighter's role, first match wins: a Wyrdcry
	 * Captain is both `leader` and `hero` and reads as a leader.
	 */
	roles: string[];
	/** The role of a fighter whose keywords name none: Wyrdcry's beasts and thralls are henchmen. */
	defaultRole?: string;
	/**
	 * Headings for a faction's fighters by role, for a game without groups:
	 * `hero` → `Heroes`. A role without a heading falls under Other.
	 */
	roleLabels?: Record<string, string>;
	groups: GroupLimit[];
	/** The fighter card's heading over the cost: `Gold Coins`, `Silver`. */
	costLabel: string;
	/** The columns of the fighter card's weapon table after the name, in order; keys of `Wargear.profile`. */
	weaponStats: { key: string; label: string }[];
	/** Abilities every fighter carrying `keyword` has, `any` for all of them. */
	universal: UniversalRule[];
	/**
	 * Where the game lets two of the same melee weapon add an attack, as
	 * Wyrdcry does: the weapon column it adds to, and the rule that says so.
	 */
	dualWielding?: { stat: string; rule: Rule };
	/**
	 * What keeps a fighter from carrying its wargear, one entry per piece it may
	 * not have, in the order it carries them. Each piece is held against those
	 * before it and the fighter's own `gear`, so the last one taken is the one
	 * refused. Without it, a fighter carries whatever it is offered.
	 */
	carry?: (fighter: Fighter, faction: Faction, wargear: string[]) => { message: string; short: string }[];
}

/** A rule a game gives every fighter with a keyword, such as Wyrdcry's Rush. */
export interface UniversalRule {
	name: string;
	text: string;
	/** As the rules name what using it costs: `double`, `reaction`. */
	type: string;
	keyword: string;
}

/** A rule as the card prints it: `[Triple] Running Death`, the type only where the game names one. */
export interface Rule {
	name: string;
	text: string;
	type?: string;
}

/** What picking an option changes about which fighters the warband may have. */
export interface ChoiceEffect {
	/**
	 * The fighter that must lead the warband. Every other fighter carrying the
	 * `leader` keyword is ruled out while the option is picked.
	 */
	leader?: string;
	/** Fighters whose own limit the option replaces. */
	limits?: { fighter: string; limit: Span }[];
	/** Fighters that do not count towards the game's groups, such as Dire Wolves towards the Beasts. */
	ungrouped?: string[];
}

export interface ChoiceOption {
	id: string;
	name: string;
	text: string;
	effect?: ChoiceEffect;
}

/** A decision taken once for the whole warband: Wyrdcry's State Pride, Black Death City's Origin. */
export interface Choice {
	id: string;
	name: string;
	text: string;
	/** How many of `options` the player picks. */
	pick: number;
	options: ChoiceOption[];
}

export type WargearKind = 'melee' | 'ranged' | 'armour' | 'item';

export interface Wargear {
	id: string;
	name: string;
	kind: WargearKind;
	cost: number;
	text?: string;
	/** A weapon's profile as printed, keyed by the game's `weaponStats`: `1"`, `2/4`. */
	profile?: Record<string, string>;
	/** A weapon's rules, shown when its name on the card is tapped. */
	rules?: Rule[];
	/** How many fighters of a warband may carry it at the same time, such as Black Death City's Rare 0-1. */
	rare?: number;
}

/** One of the options a fighter's own choice offers: a spell, a characteristic, a row of a table. */
export interface FighterChoiceOption {
	id: string;
	name: string;
	text: string;
	/** As the card prints it in brackets, where the option is an ability: `double`. */
	type?: string;
	/** Added to the profile, keyed by the game's `StatDef.key`. */
	bonus?: Record<string, number>;
	/** Keywords the option gives the fighter on top of its own. */
	keywords?: string[];
	/** Wargear ids the option is, such as a mutation that attacks like a weapon. Free, like `gear`. */
	gear?: string[];
}

/** A decision taken once for one fighter, when it is recruited: Wyrdcry's Eshin Sorcerer picks a spell. */
export interface FighterChoice {
	/** The sentence above the options. */
	prompt: string;
	/** The fighter rule the choice comes out of, by name; its card entry says the pick is already included. */
	source?: string;
	pick: number;
	options: FighterChoiceOption[];
	/**
	 * The table's name where the option is rolled at the table: `Mutation Table`.
	 * The option ids are then the results, `21-23`, and picking asks whether that was rolled.
	 */
	roll?: string;
}

export interface Fighter {
	id: string;
	name: string;
	cost: number;
	/** `min: 1` is a fighter the warband must have, not one it may have. */
	limit: Span;
	keywords: string[];
	/**
	 * Keyed by the game's `StatDef.key`. Null where the profile prints a dash,
	 * text where it prints a roll instead of a number, such as `2d6"`.
	 */
	profile: Record<string, number | string | null>;
	/** Shown as text, not applied. */
	rules: Rule[];
	/**
	 * The wargear ids offered to this fighter. Whether it may take one, and
	 * beside what, is the game's `carry`.
	 */
	wargear: string[];
	/** Why the fighter takes no wargear at all, said in place of the offer. */
	unequipped?: string;
	/**
	 * Wargear ids the fighter always carries, such as a beast's bite. Covered by
	 * the fighter's cost, and not to be removed.
	 */
	gear: string[];
	/** What the fighter picks when it is recruited. */
	choice?: FighterChoice;
}

export interface Faction {
	id: string;
	/** The `GameSystem.id` this faction belongs to. */
	game: string;
	name: string;
	/** Whether the game's own rules print this faction or it is written by fans. */
	origin: 'official' | 'homebrew';
	/** Who wrote the rules this faction comes from. */
	author: string;
	/** The faction's own rules, shown as text when it is picked. */
	rules: { name: string; text: string }[];
	/** Per faction, because Wyrdcry sets it per faction; a game with one size for all repeats it here. */
	size: Span;
	choices: Choice[];
	fighters: Fighter[];
	wargear: Wargear[];
}

/** One fighter in a warband, as stored. */
export interface FighterInstance {
	instanceId: string;
	fighterId: string;
	name: string;
	/** Wargear ids; an id may appear more than once. */
	wargear: string[];
	/** The option ids picked under the fighter's own `choice`. Missing in a warband saved before there were any. */
	picks?: string[];
}

/** A warband as stored. Everything else is looked up from its game and faction. */
export interface Warband {
	id: string;
	game: string;
	factionId: string;
	name: string;
	/** Choice id to the option ids picked under it. */
	picks: Record<string, string[]>;
	fighters: FighterInstance[];
	/** The deck's own colour in place of the card green, `#rrggbb`. Null or missing for the green. */
	colour?: string | null;
	/** The player's own background text, shown on the warband card. */
	fluff?: string;
	/** Anything to remember at the table, shown on the warband card. */
	notes?: string;
}

/** Something that keeps a warband from being valid. */
export interface Issue {
	code:
		| 'unknown-faction'
		| 'over-budget'
		| 'size'
		| 'fighter-limit'
		| 'group-limit'
		| 'choice'
		| 'fighter-choice'
		| 'unknown-fighter'
		| 'wargear-not-allowed'
		| 'wargear-carry'
		| 'wargear-rare';
	/** `missing`: not finished yet. `excess`: gone too far, which building never allows. */
	kind: 'missing' | 'excess';
	message: string;
	/** A few words for a disabled button, saying why: `Not enough silver`. */
	short: string;
	/** Set where the issue belongs to one fighter. */
	instanceId?: string;
}
