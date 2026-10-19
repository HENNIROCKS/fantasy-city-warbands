# Roadmap

<!-- One line per item, a short clause of detail is fine. No sub-items, no
     rationale, no dates. Ticked items stand above the open ones, never among
     them: a finished item moves up to the end of the ticked block, so the
     ticked block reads as a changelog, in the order things were finished.
     The emoji marks the kind of work: 🛠️ building and changing a warband,
     📚 a game's rules and data, 🃏 the cards, 📄 print and export, ⚔️ during
     a battle, 📈 the campaign, 🎨 design and interface, ⚙️ under the hood. -->

- [x] 🛠️ Build a warband in five steps: game, faction, choice, fighters, finish
- [x] 📚 Wyrdcry: the six official factions, copied from the Warband Deck
- [x] 📚 Black Death City: the four factions of the Playtest v1.01 – fighters, wargear lists, Origins
- [x] 🛠️ Check budget, limits and Origins, and disable whatever would break them, with the reason
- [x] 🛠️ Come back to any step later, the faction included
- [x] 🎨 Light and dark mode in the Card Creator's design
- [x] ⚙️ Deploy to GitHub Pages on every push to main
- [x] 🎨 An about page with the games, their sources and a few questions
- [x] 🎨 An icon for the browser and the home screen, the skulls on parchment
- [x] 🃏 Fighters as cards
- [x] ⚙️ Offer a new version as soon as it is deployed
- [x] 🃏 A colour per warband for its cards
- [x] 🛠️ Delete a warband after a question that says what is lost
- [x] 🃏 A warband card at the front of the deck, with fluff and notes
- [x] 📚 Wyrdcry: the choice a fighter brings on recruitment, such as Martial Discipline
- [x] 📚 Wyrdcry: what a fighter may carry – slots, body armour, who cannot wear armour
- [x] 📚 Black Death City: what a fighter may carry – carrying limit, held items, full-plate, Rare
- [x] 🛠️ Wargear as a checklist instead of a select, with the reason a piece is refused and ×2 where two may be carried
- [x] 📚 Where the app reads the rules its own way, kept in DEVIATIONS.md
- [x] ⚔️ Count damage on a fighter's card, out of action with the Wilhelm scream, and end the battle
- [x] 📄 Export a warband as JSON and its roster as a PDF – a first version
- [x] 📄 Import a warband from this app's JSON, saying whether the file is newer or older
- [x] ⚙️ Move storage to IndexedDB, carrying over what is in localStorage
- [x] 🛠️ Fluff and notes per fighter, written on the back of the card
- [x] 🃏 A photo of the painted model as the card image, kept out of the JSON export
- [x] 🃏 Unnamed warband and Unnamed fighter in the head of the card, leading to the name field
- [x] 🎨 How to add the app to the home screen, on the about page
- [x] 🛠️ A favourite warband, starred, always at the top of the list
- [x] ⚙️ Room for a campaign in the warband and its export: gold, stash, experience, advances, battles
- [x] ⚔️ Track a battle: activated and waiting, wavering, panicked, in cover, rounds with undo, zeal
- [x] ⚔️ Start a battle from the warband card, beside the first tap
- [x] 📈 Campaign: the aftermath of a Wyrdcry battle – experience, favour, income and a battle history
- [x] ⚔️ Cancel a battle without the aftermath
- [x] 📄 Import a warband from the Warband Deck's and the Warband Builder's JSON
- [x] 🃏 Derived values on the card, such as armour from equipment, explained when tapped
- [x] 📈 Campaign: spend renown on a characteristic or a henchman's promotion
- [x] 📈 Campaign: heroic traits, what a HERO picks instead of a characteristic
- [x] 🎨 How much of each game the app carries, as a ring on the game's tile
- [x] 🎨 When the app was last updated, in a bar on the start page with a link to what is new
- [x] 🛠️ Correct a fighter's experience and renown by hand, on the back of its card
- [x] 📄 The roster as the Warband Deck's: experience, renown, battles won, drawn and lost, and notes
- [x] 📈 Campaign: correct the warband's favour by hand, in the finish step
- [x] 📈 Campaign: gold added, the stash sold or thrown away, and battles added or struck, on the back of the warband card
- [x] 📈 Campaign: pieces moved between a fighter and the stash, on the back of its card
- [x] 📈 Wyrdcry: the Trading Post in the builder, a rare piece bought once a Rarity roll found it
- [x] 🃏 Wyrdcry: the Unarmed line on the card of a fighter without a melee weapon
- [x] ⚙️ Work offline once opened, the roster included
- [x] 📈 Campaign: spend renown on the back of a fighter's card, the levels spent listed with Undo
- [x] 📈 Campaign: Wyrdcry's injuries – rolled in the aftermath, kept on the card, death, surgeon, capture and the rest carried out
- [x] 🛠️ The back of the warband card as a fighter's: name, fluff, favour, notes and the colour of the deck, picked live
- [x] 🛠️ The fighter's name on the back of its card
- [x] 🃏 The aftermath and spending renown set as the back of a card
- [x] 📚 Wyrdcry: the core rules 1.0 – cover at −1 Shoot, Take cover, Rampage for heroes, the weapon rules, wavering past half and the morale test at the round's end
- [x] 🃏 Wyrdcry: no modifier takes a characteristic below 1
- [x] 🛠️ The check names what a fighter still has to choose on recruitment – the spells, characteristics or table it picks from
- [x] 🛠️ The list of warbands shows each one's campaign figures – Wyrdcry's favour with its standing, and the reputation
- [x] 📚 Wyrdcry: the Campaign Book 0.9 – favour tiers and income, the renown roll in place of experience, a characteristic on every level and a talent on every odd one, promotion at the third, legendary abilities, the new heroic talents, lasting injuries and Trading Post, and the 0.9 weapon and Ghoul updates
- [x] 📈 Wyrdcry: talents that change the aftermath counted there – Bootlicker's favour, Drillmaster's second mark for greatness
- [x] 📈 Wyrdcry: single-use items used up in a battle, and Crimson Shade's roll for Sticky Fingers in the aftermath
- [x] 📈 Wyrdcry: a dead or dismissed leader hands the LEADER keyword to a HERO
- [x] 🃏 Faction rules that leave out or only apply to a keyword, shown as a hint on the card
- [ ] 📚 Black Death City: the Playtest v1.03 – wargear, fighters, Origins and weapon rules
- [ ] ⚙️ Black Death City: saved and imported warbands keep the wargear v1.03 renamed, Arablast and Cursed Sword
- [ ] 📚 Black Death City: the fighters' special rules as text
- [ ] 📚 Black Death City: skills and spells picked on recruitment
- [ ] 📚 Black Death City: the Misbegotten's bloodline mutations and their cost
- [ ] 🛠️ Black Death City: starting experience and the warband rating
- [ ] 🛠️ Dismiss a fighter on the back of its card, as the Warband Deck does, its equipment to the stash or with it
- [ ] 🛠️ Recruit between battles
- [ ] 🛠️ Wyrdcry: the rarity roll as the Campaign Book has it – +1 for each HERO helping, one search per HERO, D3 single-use items
- [ ] 📈 Wyrdcry: Underdogs as an optional rule – the bonuses and +1 on renown rolls
- [ ] 🛠️ Hire a Hired Sword for a single battle
- [ ] 📈 Wyrdcry: Explore District after a battle – the search party, its exploration rolls, the encounters and Scout
- [ ] 📈 Wyrdcry: the loot tables and the magic items, unique in the campaign and counted into the reputation
- [ ] 📚 Wyrdcry: State Pride's effects on the profiles, Desperate's ban and discount included
- [ ] 📚 Wyrdcry: the two homebrew factions from the Warband Deck, Clan Pestilens and the Greenskin Marauders
- [ ] 📄 The roster per game, as each game's own sheet has it
- [ ] 📚 Mordheim
- [ ] 📚 Necropolis

## Ideas

Nothing promised, nothing planned.

- 📱 NFC tags under the model bases, so holding the phone to a model opens its card
- 🔗 Showing an opponent the warband over a read-only link, as a QR code
- 🃏 Faction rules on the warband card as well, not only on every fighter card
- ⚙️ A desktop mode that really saves, over the File System Access API
- 🎨 Keep the screen awake, or make it easy to jump back to where you were – both just soften the screen going dark
- 🎨 Virtual tuck box for each deck
- ⚔️ Wyrdcry: Wounded at half Health as a band on the card
- ⚔️ Wyrdcry: a reminder in round 4 that a dice decides on a fifth
- ⚔️ Wyrdcry: a single-use item used from the fighter's bar during the battle, its effect on the card and the aftermath asking from there
- 📚 Wyrdcry: Channel Magic and the wizards' own abilities, once the 1.0 rulebook fills them in
