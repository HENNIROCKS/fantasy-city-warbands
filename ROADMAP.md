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
- [ ] 📚 Wyrdcry: the two homebrew factions from the Warband Deck, Clan Pestilens and the Greenskin Marauders
- [ ] 📚 Wyrdcry: State Pride's effects on the profiles, Desperate's ban and discount included
- [ ] 🃏 Faction rules that leave out or only apply to a keyword, shown as a hint on the card
- [ ] 🃏 Derived values on the card, such as armour from equipment, explained when tapped
- [ ] 🛠️ Edit a fighter after the build: dismissal, recruiting between battles
- [ ] 📈 Campaign: spend renown on a characteristic or a henchman's promotion
- [ ] 📈 Campaign: heroic traits, what a HERO picks instead of a characteristic
- [ ] 🛠️ Correct a fighter's experience and renown by hand, on the back of its card
- [ ] 📈 Campaign: the stash, gold to add and the trading post
- [ ] 📈 Campaign: injuries
- [ ] 📄 The roster per game, as each game's own sheet has it
- [ ] ⚙️ Work offline once installed
- [ ] 🛠️ Hire a Hired Sword for a single battle
- [ ] 📚 Black Death City: the fighters' special rules as text
- [ ] 📚 Black Death City: skills and spells picked on recruitment
- [ ] 📚 Black Death City: the Misbegotten's bloodline mutations and their cost
- [ ] 🛠️ Black Death City: starting experience and the warband rating
- [ ] 📚 Mordheim

## Ideas

Nothing promised, nothing planned.

- 📱 NFC tags under the model bases, so holding the phone to a model opens its card
- 🔗 Showing an opponent the warband over a read-only link, as a QR code
- 🃏 Faction rules on the warband card as well, not only on every fighter card
- ⚙️ A desktop mode that really saves, over the File System Access API
- 🎨 Keep the screen awake, or make it easy to jump back to where you were – both just soften the screen going dark
- 🎨 Virtual tuck box for each deck
