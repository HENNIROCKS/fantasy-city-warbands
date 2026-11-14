# Roadmap

<!-- One line per item, a short clause of detail is fine. No sub-items, no
     rationale, no dates. Ticked items stand above the open ones, never among
     them. The ticked block opens with an overview, one line per area; below
     it a finished item gets a line of its own at the end of the block, so the
     newest stand last. Once there are more than about ten of them, they are
     folded into the overview lines.
     The emoji marks the kind of work: 🛠️ building and changing a warband,
     📚 a game's rules and data, 🃏 the cards, 📄 print and export, ⚔️ during
     a battle, 📈 the campaign, 🎨 design and interface, ⚙️ under the hood. -->

- [x] 🛠️ Build a warband in five steps – game, faction, the warband's choice, fighters, finish – with budget, limits and what a fighter may carry checked, and whatever would break them disabled with the reason
- [x] 🛠️ Keep a warband up to date: come back to any step, duplicate or remove a fighter, star a favourite, delete after a question, recruit and dismiss between battles
- [x] 📚 Wyrdcry 1.0: the Rulebook 1.0.1, the Campaign Book and the six official factions, with the author's answers; where the app reads the rules its own way, in DEVIATIONS.md
- [x] 📚 Wyrdcry homebrew: Clan Pestilens, the Greenskin Marauders, the Shadow Warriors and six hired swords
- [x] 📚 Black Death City Playtest v1.10: the four factions with their wargear, Origins and carrying limits, starting experience and the warband rating, special rules, skills and signature spells, the Misbegotten's mutations, the six scenarios with their twists; older saved warbands carried over
- [x] 🃏 Fighters as cards in the Warband Deck's design: a warband card, a colour per warband, photos or else initials, fluff and notes on the back, derived values explained when tapped; Black Death City's armour, shields and Heavy Plating counted into the figures, a Polearm beside a Held Item Unwieldy
- [x] ⚔️ Track a battle on the cards: damage, states, rounds with undo, the result into the battle history or Cancel battle; Wyrdcry's morale, poison, wounds, the fifth round and single-use items; Black Death City's bloodied fighters, flee test, prepared spells, underdog, scenario, twist and both warbands' points
- [x] 📈 Wyrdcry's campaign: the aftermath with renown, favour, income and the battle history, injuries, renown spent on characteristics and heroic talents, a new leader, Underdogs, the loot tables, magic items and Explore District
- [x] 📈 Wyrdcry between battles: the stash, the Trading Post with its rarity roll, hired swords for one battle, corrections by hand
- [x] 📄 Files: export and import as JSON, from the Warband Deck and the Warband Builder too, the roster as a PDF with Black Death City's sheet's fields, a read-only link as a QR code for the opponent
- [x] 🎨 The interface: light and dark mode in the Card Creator's design, the app icon, an about page, guides under the gear, the update bar, a ring per game for how much of it the app carries, a start screen after Urs Graf and the tuck box
- [x] ⚙️ Under the hood: deploy to GitHub Pages, storage in IndexedDB, offline once opened, a new version offered as soon as it is deployed
- [x] ⚔️ Black Death City's treasure: who holds it, who escaped with it, the battle ending on a third escape
- [x] ⚔️ Black Death City's battle groups: split, reserve and reinforcements
- [x] 📈 Wyrdcry's Undead: a VAMPIRE picks the Blood of Von Carstein talents with renown
- [x] 📚 Wyrdcry's site data of November: the Possessed's mutated weapons, the Great Weapon, the Dire Wolf a BEAST
- [x] 📚 Wyrdcry's playtest factions from wyrdcry.net under their own heading, characteristics locked where no racial limits are printed
- [x] ⚔️ Black Death City's Street of Death: no flee test for the Defender, who cannot flee
- [x] 📄 Import the Warband Builder's talents: magical abilities, mutations, heroic talents and injuries onto the fighters, what does not fit into the notes
- [x] 📈 Black Death City's aftermath: injuries permanent or temporary, Black Rot, a champion assuming command, experience and ranks, recuperating
- [x] 📈 Black Death City's campaign: advancement rolls, the underdog's bonuses, holdings and the stronghold, Explore the City, curiosities and relics, income, leeching, retiring a fighter
- [x] 📚 Necropolis Rulebook v0.9: the five Covenants and the Wretched Undead with their leaders, minions, armaments, elements, mana, spells and traits, and the Deployment Limit on the card
- [x] ⚔️ Necropolis' battle: who is fielded within the Deployment Limit, the ten Victory Conditions with the Environments and the Dread Omens
- [ ] 📄 The roster per game, as each game's own sheet has it
- [ ] 📈 Necropolis' campaign

## Ideas

Nothing promised, nothing planned.

- 📱 NFC tags under the model bases, so holding the phone to a model opens its card
- 🃏 Faction rules on the warband card as well, not only on every fighter card
- ⚙️ A desktop mode that really saves, over the File System Access API
- 🎨 Keep the screen awake, or make it easy to jump back to where you were – both just soften the screen going dark
- 📄 Photos in the JSON export beside the warband, their crop kept, the file's version unchanged
- 📦 Ready-to-go warbands for each game, to start playing at once and tweak later
- 🎨 Dual-wielding the same weapon shows its Attacks number in red, as altered stats do, and tapping it explains why, as armour and items do
