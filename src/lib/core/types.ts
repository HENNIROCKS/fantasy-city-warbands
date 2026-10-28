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
	/** How far modifiers take it at most, before the game's `statFloor`: Black Death City's Armour 2+. */
	floor?: number;
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

/** A change one of the game's rules makes to a weapon's column, and the rule, shown with the weapon. */
export interface WeaponAdjustment {
	stat: string;
	amount: number;
	rule: Rule;
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
	/** What one of its `unique` pieces is called, where it has them: `magic item`. Taken by the warband and added to its stash. */
	uniqueName?: string;
	/** The game's logo, a file in `static/`, drawn in the card's paper colour where the app shows it. */
	logo?: string;
	/** In the order the profile prints them. */
	stats: StatDef[];
	/** The key of the stat that damage counts down: `health`, `life`. */
	health: string;
	/**
	 * Where the game says modifiers never take a characteristic below a figure,
	 * that figure. A profile that starts below it, such as Armour 0, keeps its
	 * own; damage is no modifier.
	 */
	statFloor?: number;
	/**
	 * How the roster PDF heads its columns, in the order of `stats`,
	 * `weaponStats` and a fighter's campaign counters, `campaign.fighter` – and
	 * what it is called. What the game's own sheet asks for beyond that is
	 * declared here as well.
	 */
	roster: {
		title: string;
		stats: string[];
		weapons: string[];
		campaign?: string[];
		/** The weapon stat, by key, whose `a/b` fills two columns, as Black Death City's Dmg and Crit; `weapons` heads both. */
		split?: string;
		/**
		 * Each weapon's traits in a column of their own, as Black Death City's sheet
		 * has them. The keywords and the notes column give way; a fighter's notes
		 * stand under its abilities, which are named without their type.
		 */
		traits?: boolean;
		/** A column of empty circles to tick by hand on each fighter, such as Black Death City's three of Black Rot. */
		marks?: { label: string; count: number };
		/** The warband's counts in place of won, drawn and lost, each a heading and its figure; empty where the app keeps none. */
		figures?: { label: string; value: (warband: Warband) => string }[];
		/** Lines to fill in by hand: beside the stash, or on a line of their own with a blank for each of `slots`. */
		blanks?: { label: string; slots?: string[]; withStash?: boolean }[];
		/** Whether the warband's picks under its faction's choices, `Origin: Swords for Hire`, and its notes stand under its name. */
		choices?: boolean;
	};
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
	/** What a piece of the stash sells for, from its price. Without it, a piece only leaves the stash thrown away. */
	salePrice?: (cost: number) => number;
	/** The columns of the fighter card's weapon table after the name, in order; keys of `Wargear.profile`. */
	weaponStats: { key: string; label: string }[];
	/** Abilities every fighter carrying `keyword` has, `any` for all of them. */
	universal: UniversalRule[];
	/**
	 * What the game's rules do to a weapon's figures for what the fighter
	 * carries: Wyrdcry's Dual Wielding adds an attack to two of the same melee
	 * weapon, Black Death City's Held Items take one off a two-handed melee
	 * weapon. `count` is how many of the weapon it carries, `carried` every
	 * piece it carries, the weapon included, once each.
	 */
	weaponAdjustments?: (weapon: Wargear, count: number, carried: Wargear[], faction: Faction) => WeaponAdjustment[];
	/**
	 * The profile a fighter fights with that carries no melee weapon, as
	 * Wyrdcry's Unarmed, and the keywords of fighters that never do – a BEAST
	 * fights with what is on its profile.
	 */
	unarmed?: { weapon: Wargear; except: string[] };
	/**
	 * What keeps a fighter from carrying its wargear, one entry per piece it may
	 * not have, in the order it carries them. Each piece is held against those
	 * before it and the fighter's own `gear`, so the last one taken is the one
	 * refused. Without it, a fighter carries whatever it is offered.
	 */
	carry?: (fighter: Fighter, faction: Faction, wargear: string[]) => { message: string; short: string }[];
	/**
	 * The counters the game's campaign keeps beyond what every game shares, such
	 * as Wyrdcry's favour for the warband and renown for a fighter. Stored under
	 * `tally` by their key. Without it, the game keeps none.
	 */
	campaign?: {
		warband: Counter[];
		fighter: Counter[];
		/** Figures the warband card shows beside its size, such as Wyrdcry's favour. */
		values?: (warband: Warband) => { key: string; label: string; value: string }[];
		/**
		 * The figures the list of warbands shows, shorter than the card's, each
		 * with a short label for the phone. Without it, the list shows `values`.
		 */
		brief?: (warband: Warband) => Figure[];
		/** The counters a fighter starts with when recruited, such as Wyrdcry's leader's first level of renown. */
		recruited?: (fighter: Fighter) => Record<string, number>;
		/**
		 * A counter a fighter starts at a figure plus a die rolled at the table
		 * when it is recruited, such as Black Death City's `40+d6` experience. The
		 * builder asks for the roll; until it is entered the counter is unset and
		 * `validate` reports it. Null for a fighter that starts with none.
		 */
		start?: (fighter: Fighter, faction: Faction) => StartRoll | null;
	};
	/**
	 * What ending a battle asks and writes into the warband. Without it, ending a
	 * battle only drops it.
	 */
	aftermath?: Aftermath;
	/** What a fighter's levels are spent on and what that does to its card. Without it, levels are not spent here. */
	advancement?: Advancement;
	/** What a fighter taken out of action rolls on afterwards, and what the result does. Without it, no injuries. */
	injuries?: Injuries;
	/**
	 * Who takes the LEADER keyword once the warband's leader is dead or gone,
	 * as Wyrdcry's HERO: the keyword a fighter must carry, and what the game
	 * has happen when no fighter carries it. Without it, the warband recruits
	 * a new leader instead.
	 */
	succession?: { keyword: string; none: string };
	/**
	 * How a piece marked `found` is looked for between battles, as Wyrdcry's
	 * Rarity roll: a fighter with `keyword` searches on a `target`+, each one
	 * more helping takes `helper` off, a 1 always fails, and each searches or
	 * helps once until the next battle. A single-use piece found comes in as
	 * many copies as a die of `singleUse` sides says. Without it, a piece
	 * marked `found` is only asked about.
	 */
	rarity?: { keyword: string; target: number; helper: number; singleUse: number };
	/**
	 * Fighters a warband hires for one battle, as Wyrdcry's Hired Swords: set
	 * up with the battle, never on the roster, gone when it ends. Without it,
	 * nobody is hired.
	 */
	hiring?: Hiring;
	/** Help for a warband that has fallen behind its opponent, set up with the battle. Without it, none. */
	underdog?: Underdog;
	/** What the game tracks in a battle beyond rounds, activations and damage. Without it, nothing more. */
	battle?: {
		/** Whether a fighter can wait, ending its activation without being done for the round. */
		waiting: boolean;
		/** States a fighter can be marked with, in the order the menu lists them. */
		marks: BattleMark[];
		/**
		 * A state the damage alone brings about, as Wyrdcry's Wounded at half Health:
		 * named first on the card's band from `at` damage points on, never set by hand.
		 */
		wounded?: { label: string; at: (health: number) => number };
		/** When the battle ends by the rules. Without it, rounds go on until it is ended by hand. */
		rounds?: BattleRounds;
		/**
		 * When the warband's morale breaks, and what it asks of each fighter then.
		 * Whether it wavers now is worked out rather than latched, so taking back
		 * a mistaken wound takes the warband back out of it as well; the test is
		 * asked in the round after a morale phase in which it wavered.
		 */
		wavering?: {
			/** Whether so many fighters out of action make the warband waver, for its size; `out` may be a fraction. */
			wavers: (out: number, size: number) => boolean;
			/** What each fighter has to do in that round, on its card: `Bravery test`. */
			test: string;
			/** The mark failing it sets, which also ends the question. */
			failed: string;
		};
		/** What the fighters' `beforeBattle` rolls are called in the Battle menu: `Prepared spells`. */
		rolls?: string;
		/**
		 * When the warband tests whether it flees at the end of a round, as Black
		 * Death City's Flee test: asked in place of the next round, its answers lead
		 * on or end the battle. Whether it is due is worked out rather than latched,
		 * as the wavering is.
		 */
		flee?: {
			/** `Flee test`. */
			label: string;
			/** Whether so many fighters out of action or `wounded` make the warband test, for its size. */
			breaks: (down: number, size: number) => boolean;
			/** What is rolled, as the question names it: `roll a dice`. */
			roll: string;
			/** The results that pass: `2+`. */
			goOn: string;
			/** The results on which the warband flees: `1`. */
			end: string;
		};
	};
}

/**
 * Wyrdcry's optional Underdogs: a warband `gap` or more reputation behind its
 * opponent picks a bonus for each `gap` it is behind, and each of its fighters
 * adds `roll` to the aftermath's roll.
 */
export interface Underdog {
	gap: number;
	roll: number;
	bonuses: UnderdogBonus[];
	/** The figure compared with the opponent's: Wyrdcry's reputation. */
	reputation: (warband: Warband) => number;
	/** Why the warband gains nothing by a bonus, such as Bounty at the highest standing; null where it does. */
	refuse?: (warband: Warband, bonus: UnderdogBonus) => string | null;
}

export interface UnderdogBonus {
	id: string;
	name: string;
	text: string;
	/**
	 * What the app counts: `free-hire` takes the whole fee off one hire, `standing`
	 * collects the income one standing higher. Without it, the bonus is a
	 * reminder on the warband card.
	 */
	effect?: 'free-hire' | 'standing';
}

/** One fighter on offer for hire, with the wargear only it carries and the factions it fights for. */
export interface Hireling {
	/** Its `cost` is the fee for one battle. */
	fighter: Fighter;
	wargear: Wargear[];
	factions: string[];
	/** Whether the game's own rules print this fighter or it is written by fans. */
	origin: 'official' | 'homebrew';
	source?: Source;
	/**
	 * What keeps a warband of these factions from hiring it, and it from being
	 * hired beside: the hirelings by fighter id, the wargear by id, carried or
	 * in the stash.
	 */
	notWith?: { factions: string[]; hired: string[]; carried: string[] };
}

/** One fighter hired into the battle running, as stored with it. */
export interface Hire {
	instanceId: string;
	fighterId: string;
	/** Hired at half the fee on a roll such as Wyrdcry's Well-Connected. */
	halved?: true;
	/** Hired without a fee, as the underdog's Calling in a debt. */
	free?: true;
	/** The option ids picked under the hired fighter's own `choice`, such as the Goblin Shaman's role. */
	picks?: string[];
}

export interface Hiring {
	/** What they are called, many of them: `Hired swords`. */
	label: string;
	hirelings: Hireling[];
	/** The fee of each hire, in the order given, with what the warband's picks and the halved hires take off. */
	fees: (warband: Warband, hires: Hire[]) => number[];
	/** What the warband's picks take off the fees, as a sentence; null where they take nothing. */
	discount: (warband: Warband) => string | null;
	/**
	 * A roll that halves the next fee, once per battle, and who in the warband
	 * may make it – `Well-Connected`. Null where nobody may.
	 */
	halving: (warband: Warband) => { name: string; holders: string[] } | null;
	/** Why the warband may not hire this one, in a few words for its button; null where it may. */
	refuse?: (warband: Warband, faction: Faction, hireling: Hireling, hires: Hire[]) => string | null;
}

/**
 * How long a battle runs: from round `decide` on, the end of each round asks
 * for a roll – `goOn` plays another, `end` ends it – and `last` is the last
 * round there is.
 */
export interface BattleRounds {
	decide: number;
	last: number;
	/** What is rolled, as the question names it: `roll a dice`. */
	roll: string;
	/** The results that play another round: `3+`. */
	goOn: string;
	/** The results that end the battle: `1–2`. */
	end: string;
}

/** A state a fighter can be marked with in a battle, such as Wyrdcry's In cover. */
export interface BattleMark {
	key: string;
	/** In the menu and on the card's band. */
	label: string;
	/** Only a fighter with this keyword can be marked, such as a `hero` for its heroic reaction. */
	keyword?: string;
	/** Whether the next round clears it, or only the end of the battle. */
	lasts: 'round' | 'battle';
	/** What it does to the characteristics while it stands, by stat key. */
	bonus?: Record<string, number>;
	/** What it does in one situation only, such as cover against a ranged attack. */
	conditions?: StatCondition[];
}

/**
 * A count a faction keeps through a battle, such as the Witch Hunters' Zeal,
 * with what each stage of it does to every fighter.
 */
export interface FactionCounter {
	label: string;
	/** Lowest first. A stage holds from its `at` on, and the stages add up. */
	stages: CounterStage[];
}

export interface CounterStage {
	at: number;
	label: string;
	/** What it adds to every fighter's characteristics, by stat key. */
	bonus: Record<string, number>;
	/** What it adds in one situation only, such as against a condemned fighter. */
	conditions?: StatCondition[];
	/** A keyword whose carriers the stage leaves out, such as `hired-sword`. */
	except?: string;
}

/**
 * A game's aftermath: the roll each fighter that took part makes for a level,
 * what adds to it, and what the battle's result and shards bring the warband.
 * The dice are rolled at the table; the app is handed how many levels came of it.
 */
export interface Aftermath {
	/** The roll, as the rules name it, and the score that earns a level: `Renown roll`, 6. */
	roll: { label: string; target: number };
	/**
	 * What adds 1 to a fighter's roll: `Not taken out of action`. `start` is the
	 * answer it begins with: yes, no, or yes unless the battle left the fighter
	 * out of action.
	 */
	modifiers: { key: string; label: string; start: 'yes' | 'no' | 'not-out' }[];
	/** What the one fighter of the warband's choosing who rolls twice is called: `Marked for greatness`. Null where none does. */
	marked: string | null;
	/**
	 * Marks beyond the first, given by fighters that came through the battle –
	 * `survivors`, by instance id – such as Wyrdcry's Drillmaster: the keyword a
	 * further marked fighter must carry, and a line for each mark saying who gives it.
	 */
	extraMarks?: (warband: Warband, survivors: string[]) => { keyword: string; notes: string[] };
	/** Fighters carrying one of these keywords never roll. */
	excluded: string[];
	/** The fighter with `levels` more. */
	gainLevels: (fighter: FighterInstance, levels: number) => FighterInstance;
	/** What to keep in mind while counting the shards, such as a fighter whose injury may take one, a line each. */
	shardNotes?: (warband: Warband) => string[];
	/**
	 * A roll a single-use piece asks for once used, such as Wyrdcry's Crimson
	 * Shade: the piece by its wargear id, the roll's name, its two answers, and
	 * the injury result id the fighter gains on `hit`.
	 */
	afterUse?: { wargear: string; label: string; hit: string; miss: string; injury: string }[];
	/** The score that has the opponent steal a `unique` piece from a bearer taken out of action, such as Wyrdcry's magic items on a 4+. */
	theft?: { target: number };
	/** What a search party may run into after the battle, such as Wyrdcry's Explore District; none where the game sends none out. */
	explore?: Explore;
	/**
	 * What the result and the shards bring: the warband's counters and gold as
	 * they become, and two lines saying how, as the back of the card shows them.
	 * `survivors` are the fighters that took part and were not taken out of
	 * action, by instance id, for what only they bring in; `raised`, the
	 * standings above its own the income is collected at, as the underdog's Bounty.
	 */
	income: (
		warband: Warband,
		game: GameSystem,
		result: BattleRecord['result'] | null,
		shards: number,
		survivors: string[],
		raised: number
	) => {
		tally: Record<string, number>;
		gold: number;
		lines: { gain: string; why: string }[];
	};
}

/** A count a find brings: fixed, or a roll made at the table and tapped, such as `D3 × 10` for 10, 20 or 30. */
export type FindAmount = number | { roll: string; values: number[] };

/**
 * What an encounter or a row of a loot table brings: gold, shards delivered
 * with the battle's, a campaign counter such as favour, pieces into the stash,
 * a roll on a loot table, or one of a game's unique pieces picked by a roll.
 * The rest falls on the fighter the encounter picks (`Encounter.who`): a roll
 * on the injury table – a result read as another where `treat` says so, such
 * as Captured as Dead –, levels, a result of the injury table it keeps, one of
 * its [injury] results taken away, its leaving the warband, a characteristic
 * changed for good; `each` counts the dice of a roll that show each result,
 * such as the 1s and the 4+ of Wyrdcry's Wyrdstone Cluster. `recruit` adds a
 * fighter of a type picked – carrying `keyword`, costing less than `below`,
 * for nothing where `free`, its characteristics set as `set` says –, `next`
 * what the warband's next battle brings.
 */
export type FindGain =
	| { gold: FindAmount }
	| { shards: FindAmount }
	| { tally: string; amount: number }
	| { wargear: string; copies?: FindAmount }
	| { table: string }
	| { unique: { roll: string; wargear: string[] } }
	| { injuryRoll: { treat?: Record<string, string> } }
	| { levels: number }
	| { injury: string }
	| { heal: true }
	| { remove: true }
	| { stat: { key: string; bonus: number } }
	| { each: { dice: number; results: { on: string; label: string; gains: FindGain[] }[] } }
	| { recruit: { keyword: string; below: number; free?: boolean; set?: Record<string, number> } }
	| { next: Omit<NextBattle, 'source'> };

/**
 * What an encounter leaves for the warband's next battle, such as Wyrdcry's
 * Mad Prophet: a line for the warband card, and what the app counts of it – a
 * characteristic of every fighter, one hired sword for nothing – or, where
 * `explore`, a help for the next exploration roll instead.
 */
export interface NextBattle {
	/** The encounter's name. */
	source: string;
	text: string;
	stat?: { key: string; bonus: number };
	freeHire?: true;
	explore?: true;
}

/** One answer to an encounter that asks: a choice made, or a roll's result. */
export interface FindOption {
	label: string;
	gains: FindGain[];
	/** Whether part of what it does is not kept by the app and is noted by hand. */
	byHand?: boolean;
}

/** What a search party may run into, by the exploration roll that finds it: `444`, Lone Survivor. */
export interface Encounter {
	roll: string;
	name: string;
	text: string;
	/** The heading it is listed under: `Doubles`. */
	group: string;
	/** Whether it must be resolved even when another was rolled. */
	mishap?: boolean;
	/**
	 * The fighter what it does falls on, picked from the search party or the
	 * warband, carrying `keyword` and, where `injured`, an [injury] result;
	 * `note` says who picks, such as the opponent.
	 */
	who?: { from: 'party' | 'warband'; keyword?: string; injured?: boolean; note?: string };
	/** What it brings whatever is answered. */
	gains: FindGain[];
	/** Where it asks, what is asked – `Roll a D6` – and its answers, one tapped. */
	ask?: { label: string; options: FindOption[] };
	/** Whether part of what it does is not kept by the app and is noted by hand. */
	byHand?: boolean;
}

/** A table the finds are rolled on, such as Wyrdcry's Lesser Loot Table. */
export interface FindTable {
	id: string;
	name: string;
	dice: string;
	rows: { roll: string; name: string; text: string; gains: FindGain[] }[];
}

/** A game's step after the battle in which a search party explores and finds. */
export interface Explore {
	/** The step as the rules name it: `Explore District`. */
	label: string;
	encounters: Encounter[];
	tables: FindTable[];
	/** Who may go: at most `size` fighters, none carrying one of the `excluded` keywords. */
	party: { size: number; excluded: string[] };
	/** How many encounters the party, by instance id, may resolve, and what lets it resolve more than one, such as Wyrdcry's Scout. */
	most: (warband: Warband, party: string[]) => { count: number; why: string | null };
	/** What helps the party's exploration roll, a line each; `spend`, a piece of the stash given up once used, such as an Ornate Key. */
	aids: (warband: Warband, party: string[]) => { text: string; spend?: string }[];
}

/**
 * A game's way of spending a fighter's levels, such as Wyrdcry's renown: which
 * levels are open, what each offers, and what the spent ones do to the card.
 */
export interface Advancement {
	/** What a level is called: `Renown`. */
	label: string;
	/** The fighter's campaign counter the levels are counted in: `renown`. */
	counter: string;
	/** The fighter's levels earned and not yet spent, lowest first. */
	open(instance: FighterInstance, fighter: Fighter): OpenLevel[];
	/** What one of those levels can be spent on, each with the reason where it cannot – the warband for what only one of its fighters may take. */
	offer(instance: FighterInstance, fighter: Fighter, faction: Faction, level: OpenLevel, warband: Warband): LevelOffer;
	/** The fighter's keywords as its levels make them, such as a henchman's promotion to HERO. */
	keywords(instance: FighterInstance, keywords: string[]): string[];
	/** What the spent levels add to the card besides characteristics: rules, keywords, a weapon's figures. */
	effects(instance: FighterInstance, fighter: Fighter, faction: Faction): AdvanceEffects;
	/** What the fighter's advance at `index` was spent on, in a line: `Fight 4 → 5`, `Fearsome`, `used up` – from the figure the warband's picks start it at. */
	describe(instance: FighterInstance, fighter: Fighter, faction: Faction, index: number, warband: Warband): string;
	/** What the warband's spent levels break among its fighters, such as an ability only one of them may have; `validate` reports it. */
	check?(warband: Warband, faction: Faction): Issue[];
}

export interface OpenLevel {
	level: number;
	/** What the rules let this level do, in a sentence for the sheet. */
	note: string;
}

export interface LevelOffer {
	stats: {
		stat: string;
		label: string;
		/** The figure as it stands and as it would become, written as the card writes them. */
		from: string;
		to: string;
		bonus: number;
		blocked: string | null;
	}[];
	/** What a level can be spent on besides a characteristic, by heading: `Heroic Talents`, `Agility`. Empty where nothing. */
	rules: { heading: string; options: LevelRule[] }[];
	/** The tab the rules sit under: `Heroic Talents`. */
	rulesLabel: string;
	/** What limits the rules, in a sentence above them; null where nothing. */
	rulesNote: string | null;
}

export interface LevelRule {
	id: string;
	name: string;
	text: string;
	type?: string;
	blocked: string | null;
	/** The weapons it can be taken for, where it is taken for one; null for the rest. */
	weapons: { id: string; name: string }[] | null;
}

export interface AdvanceEffects {
	rules: Rule[];
	keywords: string[];
	/** What they add to a characteristic, each by the rule's name. */
	stats: { stat: string; bonus: number; source: string }[];
	/** A weapon column the levels change, by wargear id: its new figure and why. */
	weapons: { wargear: string; stat: string; value: string; source: string }[];
}

/**
 * A game's injuries, such as Wyrdcry's Lasting Injury Table: which table a
 * fighter rolls on, what a result comes to under the game's limits, and what the
 * results a fighter keeps do to its card. The dice are rolled at the table; the
 * app is handed the result.
 */
export interface Injuries {
	/** The table the fighter rolls on, or null where it never rolls. */
	table(instance: FighterInstance, fighter: Fighter, faction: Faction): InjuryTable | null;
	/** Why the fighter never rolls, by the rule that says so: `Unbending Will`. Null where it does. */
	exempt(instance: FighterInstance, fighter: Fighter, faction: Faction): string | null;
	/** What a result rolled on the fighter's table comes to, such as an injury it already has turning into a Flesh Wound. */
	resolve(instance: FighterInstance, fighter: Fighter, faction: Faction, id: string): InjuryResolution;
	/** The fighter with a rolled result written in: one it keeps, or a level of renown. Other outcomes leave it as it is. */
	apply(instance: FighterInstance, fighter: Fighter, faction: Faction, id: string): FighterInstance;
	/** What the results the fighter keeps add to the card. */
	effects(instance: FighterInstance, fighter: Fighter, faction: Faction): InjuryEffects;
	/** A result a fighter can keep, by its id; null where the game has none of that id. */
	result(id: string): InjuryResult | null;
}

export interface InjuryTable {
	/** As the rules name the table: `Lasting Injury Table`. */
	table: string;
	/** `D66`, `D6`. */
	dice: string;
	results: InjuryResult[];
}

/**
 * What the result does once rather than to the card: the fighter dies, needs a
 * surgeon, misses the next battle, loses its equipment, is captured or earns a
 * level of renown.
 */
export type InjuryOutcome = 'dead' | 'surgeon' | 'miss-next-battle' | 'robbed' | 'captured' | 'renown';

export interface InjuryResult {
	id: string;
	name: string;
	/** The rolls it covers, as the table prints them: `12–13`, `5`. */
	roll: string;
	text: string;
	/** As the rules name it in brackets: `injury`, `trait`. */
	type?: string;
	outcome?: InjuryOutcome;
	/** What the outcome costs the warband's gold where it is taken up, such as a surgeon's fee. */
	cost?: number;
	/** Whether the fighter keeps it and the card shows it. */
	lasting: boolean;
}

/**
 * Why a fighter sits out, as an injury left it: it misses the next battle, is
 * held by the enemy, or – a leader – lies dead until another takes its place.
 */
export type AwayReason = 'miss-next-battle' | 'captured' | 'dead';

export interface InjuryResolution {
	result: InjuryResult;
	/** Why the result differs from the one rolled, null where it does not. */
	note: string | null;
}

export interface InjuryEffects extends AdvanceEffects {
	/** Types of ability the fighter cannot use, such as `reaction`, each by the result's name. */
	forbid: { type: string; source: string }[];
}

/** A figure in the list of warbands, with the label a phone shows instead. */
export interface Figure {
	label: string;
	short: string;
	value: string;
}

/** A counter's start on recruitment: `base` plus a die of `die` sides, `40+d6`. */
export interface StartRoll {
	key: string;
	base: number;
	die: number;
}

/** A number a game's campaign counts up and down, such as favour. */
export interface Counter {
	key: string;
	label: string;
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
	/** What the rule adds to its bearer's characteristics in one situation only, such as Parry's Fight in melee. */
	conditions?: StatCondition[];
}

/** What a piece of wargear adds to a characteristic whenever it is carried, such as body armour's Armour. */
export interface StatEffect {
	stat: string;
	bonus: number;
}

/**
 * What a rule or a piece of wargear does to a characteristic in one situation
 * only – a melee attack, a ranged one – which the card cannot know. Shown beside
 * the figure rather than counted into it.
 */
export interface StatCondition {
	stat: string;
	/** What it adds, where the rule says a number for this characteristic. */
	bonus?: number;
	name: string;
	text: string;
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
	/** What the option adds to the profiles of the fighters it names, such as Huntsmen's Shoot +1 for every Marksman. */
	stats?: ChoiceStat[];
	/** Fighters the option recruits at a share of their cost, rounded, such as Desperate's Youngbloods at half. */
	costs?: { fighter: string; factor: number }[];
}

/** A characteristic a picked option raises, keyed by the game's `StatDef.key`. */
export interface ChoiceStat {
	stat: string;
	bonus: number;
	/** Fighter ids, or every fighter of the warband. */
	fighters: string[] | 'all';
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
	/**
	 * Ids, as the app stores them, that a stored warband or another tool's file
	 * may carry for this piece: Black Death City's Arablast of the Playtest
	 * v1.01 for the Arbalest. Swapped on load and import, see `upgrade`.
	 */
	replaces?: string[];
	/** What has to be found at the table before it is bought, such as Wyrdcry's `a Rarity roll of 6+`; the builder asks for it. */
	found?: string;
	/** A heading of its own in the builder's list, such as Wyrdcry's Trading Post; without it the piece stands under its kind. */
	group?: string;
	/** What it adds whenever it is carried, such as Heavy Armour's +3 Armour and −1 Move. */
	effects?: StatEffect[];
	/**
	 * What it replaces a characteristic with whenever it is carried, such as
	 * Black Death City's Cuirass, Armour 5+. Counted before everything else adds.
	 */
	sets?: { stat: string; value: number }[];
	/** What it adds in one situation only, such as the Shield's Fight against a melee attack. */
	conditions?: StatCondition[];
	/**
	 * Whether it is used up once used, such as Wyrdcry's drugs and poisons: ticked
	 * off on the card in a battle, it is struck there, and the aftermath strikes
	 * it from the fighter's equipment.
	 */
	singleUse?: true;
	/** What a single-use piece does from the moment it is used until the battle ends. */
	used?: WargearUse;
	/**
	 * Whether only one exists in the whole campaign, such as Wyrdcry's magic
	 * items: it is never sold, and a fighter carries one such piece at most.
	 */
	unique?: true;
	/** Whether it is never bought, only found and taken from the stash, such as loot. */
	foundOnly?: true;
	/** What it sells for in place of the game's `salePrice`, such as a ring sold for 20 gc. */
	sale?: number;
}

/** What using a single-use piece does to its bearer for the rest of the battle, such as Crimson Shade's Move and Fight. */
export interface WargearUse {
	/** Added to the characteristics, by stat key. */
	bonus?: Record<string, number>;
	/** A rule one of the bearer's weapons gains, picked when the piece is used, of these kinds: Dark Venom's Poisoned. */
	weapon?: { kinds: WargearKind[]; rule: Rule };
	/** A weapon rule, by name, none of the bearer's weapons has: Superior Blackpowder's `UNRELIABLE`. */
	strips?: string;
	/** Rules the bearer gains, such as Mad Cap Mushrooms' Stupidity. */
	rules?: Rule[];
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
	/** What it adds to the fighter's cost, such as a Misbegotten's bloodline mutation. */
	cost?: number;
	/** The table it stands in where a choice offers several, a heading in the builder: Black Death City's `Old Dogs`. */
	group?: string;
	/** What the fighter is called once it has picked this, in place of its type: a hired sword's role, `River Troll`. */
	title?: string;
	/** A picture of its own, in place of the fighter's `image`: a hired sword's role. */
	image?: string;
}

/** A decision taken once for one fighter, when it is recruited: Wyrdcry's Eshin Sorcerer picks a spell. */
export interface FighterChoice {
	/** The sentence above the options. */
	prompt: string;
	/** The fighter rule the choice comes out of, by name; its card entry says the pick is already included. */
	source?: string;
	pick: number;
	/** Whether it may be left open, picking fewer than `pick` or none, as a Misbegotten may go without a bloodline mutation. */
	optional?: true;
	/**
	 * Whether an option one fighter has is barred to every other fighter of the
	 * warband, as Black Death City's No Duplicates for skills; `validate` reports a second.
	 */
	unique?: true;
	/** Options the fighter has from recruitment without picking them, as a Noble's Duellist: held like a pick, not counted against `pick`. */
	given?: string[];
	options: FighterChoiceOption[];
	/** What one option is called, in the singular and plural: `magical ability`. */
	noun?: { one: string; many: string };
	/** How many more of the options it may learn later in place of a level's other reward, such as a wizard's spell for a heroic talent. */
	later?: number;
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
	/** The background its rules give it, on its card and the back's field until the player writes their own. */
	fluff?: string;
	/** The URL of a picture its data brings, black on white, in the image field where there is no photo. */
	image?: string;
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
	/**
	 * What the fighter picks when it is recruited, one choice each: Black Death
	 * City's Bloodcursed Noble picks a skill and a spell. The picks are one list,
	 * so an option's id is unique across the choices.
	 */
	choices?: FighterChoice[];
	/** The tables it rolls on before each battle, such as the spell lores a Black Death City caster prepares from. */
	beforeBattle?: BattleRoll[];
}

/**
 * A table a fighter rolls a dice on before each battle. The result belongs to
 * the battle; one the fighter already has among its picks, as a signature
 * spell, brings nothing.
 */
export interface BattleRoll {
	id: string;
	/** `Lore of Sanctioned Magic`. */
	name: string;
	/** Each a rule the fighter has for the battle, by the result that brings it. */
	options: (Rule & { id: string; roll: number })[];
}

/** Where the rules for a faction or a hired sword can be read, linked where it is picked. */
export interface Source {
	name: string;
	url: string;
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
	source?: Source;
	/**
	 * The faction's own rules, shown as text when it is picked. `except` are
	 * keyword ids whose carriers a rule leaves out, `only` one only whose carriers
	 * it applies to; the card of any other fighter prints a hint in its place.
	 */
	rules: { name: string; text: string; except?: string[]; only?: string }[];
	/** Per faction, because Wyrdcry sets it per faction; a game with one size for all repeats it here. */
	size: Span;
	choices: Choice[];
	fighters: Fighter[];
	wargear: Wargear[];
	/** Where the faction counts something through a battle. */
	counter?: FactionCounter;
	/**
	 * What a fighter counts for when the warband's morale is judged, by fighter
	 * id, where a faction rule makes it other than a whole one – half for a
	 * Plague Novice. Only the count out of action is weighted, not the size.
	 */
	weights?: Record<string, number>;
	/** At most `max` fighters with `keyword` for each with `per`, such as the Greenskins' two GOBLINs per ORC; `rule` names it. */
	ratios?: { rule: string; keyword: string; per: string; max: number }[];
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
	/** The player's own background text, shown at the head of the fighter's card. */
	fluff?: string;
	/** Anything to remember at the table, shown at the foot of the fighter's card. */
	notes?: string;
	/** Experience a saved warband or file carries; no game here counts it, and it is kept as it is. */
	xp?: number;
	/** What the fighter's levels were spent on, in the order they were spent. */
	advances?: Advance[];
	/** The ids of the injury results the fighter keeps, in the order they came. */
	injuries?: string[];
	/** Why the fighter sits out; missing where it does not. */
	away?: AwayReason;
	/** Whether it leads the warband in place of the leader it was recruited with, carrying the LEADER keyword. */
	leader?: true;
	/** The game's own counters, keyed as its `campaign` declares them. A missing key reads as 0. */
	tally?: Record<string, number>;
}

/**
 * One level a fighter spent: a characteristic raised, a rule taken, or – with
 * neither – a level used up. The characteristic's figure is worked out from
 * the profile and every advance, so the card can say where each point came from.
 */
export interface Advance {
	/** The fighter's level this advance spent. */
	level: number;
	/** The key of the characteristic raised. */
	stat?: string;
	/** Signed, as the figure moves: −1 for a roll to meet, such as Bravery. */
	bonus?: number;
	/** The id of a rule taken, such as a heroic talent or a skill. */
	rule?: string;
	/** What the rule was taken for, such as a weapon's id. */
	option?: string;
	/** For a level of 0, what changed the characteristic, such as an encounter; missing where a warband file holds it without saying why. */
	source?: string;
}

/** One battle the warband fought, as the player wrote it down afterwards. */
export interface BattleRecord {
	id: string;
	/** A calendar day, `YYYY-MM-DD`. */
	date: string;
	result: 'win' | 'draw' | 'loss';
	/** Either name may be empty. */
	opponentWarband: string;
	opponentPlayer: string;
}

/**
 * The searches since a battle: who searched or helped, and what was found.
 * Ended by the next battle – its aftermath, or a battle written down by hand.
 */
export interface Finds {
	/** The id of the battle the searches followed. */
	after: string;
	/** The instance ids of the fighters that searched or helped. */
	searched: string[];
	/** Each piece found: how many copies came in, and how many of them were bought – missing reads as none. */
	found: { id: string; copies: number; bought?: number }[];
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
	/**
	 * The whole purse: what the warband is worth together with what it has left
	 * to spend, as the Warband Builder counts it. Missing reads as the game's
	 * `budget`, which a warband not yet in a campaign has.
	 */
	gold?: number;
	/** Wargear ids held by the warband rather than a fighter; an id may appear more than once. */
	stash?: string[];
	/** The battles fought, in the order they were written down. */
	history?: BattleRecord[];
	/** What was looked for at the table since the last battle, where the game has a `rarity` roll. */
	finds?: Finds;
	/** What the last aftermath's exploring left for the next battle; the next aftermath clears it. */
	next?: NextBattle[];
	/** Whether it lost its leader with no fighter left to take the lead, so the game has it disbanded. */
	disbanded?: true;
	/** The game's own counters, keyed as its `campaign` declares them. A missing key reads as 0. */
	tally?: Record<string, number>;
	/**
	 * When its content last changed, ISO 8601. Travels with an export, so an
	 * import can tell which of two states is newer. Missing on a warband not
	 * changed since the field came in.
	 */
	updatedAt?: string;
}

/** Something that keeps a warband from being valid. */
export interface Issue {
	code:
		| 'unknown-faction'
		| 'over-budget'
		| 'size'
		| 'fighter-limit'
		| 'group-limit'
		| 'ratio'
		| 'choice'
		| 'fighter-choice'
		| 'duplicate-pick'
		| 'start-roll'
		| 'unknown-fighter'
		| 'wargear-not-allowed'
		| 'wargear-carry'
		| 'wargear-rare'
		| 'wargear-unfound'
		| 'wargear-unique'
		| 'legendary'
		| 'leaders';
	/** `missing`: not finished yet. `excess`: gone too far, which building never allows. */
	kind: 'missing' | 'excess';
	message: string;
	/** A few words for a disabled button, saying why: `Not enough silver`. */
	short: string;
	/** Set where the issue belongs to one fighter. */
	instanceId?: string;
}
