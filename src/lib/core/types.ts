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
	rules: { name: string; text: string }[];
	/** The wargear ids this fighter may be given, already resolved from the game's own allowance rules. */
	wargear: string[];
	/**
	 * Wargear ids the fighter always carries, such as a beast's bite. Covered by
	 * the fighter's cost, and not to be removed.
	 */
	gear: string[];
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
}

/** Something that keeps a warband from being legal. */
export interface Issue {
	code:
		| 'unknown-faction'
		| 'over-budget'
		| 'size'
		| 'fighter-limit'
		| 'group-limit'
		| 'choice'
		| 'unknown-fighter'
		| 'wargear-not-allowed';
	/** `missing`: not finished yet. `excess`: gone too far, which building never allows. */
	kind: 'missing' | 'excess';
	message: string;
	/** A few words for a disabled button, saying why: `Not enough silver`. */
	short: string;
	/** Set where the issue belongs to one fighter. */
	instanceId?: string;
}
