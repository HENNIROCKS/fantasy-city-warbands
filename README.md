# Fantasy City Warbands (Early)

Build a warband for a skirmish game set in a fantasy city, step by step, with
the budget and the roster limits checked as you go. Two games so far:
[Wyrdcry](https://wyrdcry.net) and [Black Death City](https://www.blackdeathcity.com/).
Mordheim will follow eventually.

<https://hennirocks.github.io/fantasy-city-warbands/>

Unofficial fan project. No connection to Games Workshop, Johan Markström and
the Wyrdcry project, or Sam Pearson and Black Death City.

**Status: early.** The app builds a warband, lets you change it later and shows
it as a deck of cards that counts damage in a battle. It exports a warband as
a file, imports it again and prints its roster as a PDF, all in a first
version. In Wyrdcry, ending a battle brings renown, favour and income, rolls
injuries and adds it to the warband's history, and renown is spent on a
characteristic and a heroic talent. It imports the Warband Deck's and the
Warband Builder's files. It does not yet know Black Death City's campaign.

## What it does

- Build a warband in five steps: game, faction, the choice the whole warband
  makes (State Pride in Wyrdcry, Origin in Black Death City), fighters, finish
- See how much of each game the app carries before picking it: a ring on the
  game's tile with one piece per area, such as carrying limits, battle,
  aftermath or advancement, filled where it is built
- See on the start page when the app was last updated, with a link to the
  roadmap; dismissed, the bar stays away until the next update
- See a faction before picking it: its fighters with their costs and limits,
  its choice and its rules
- Recruit fighters and give them wargear from what their faction allows them,
  with the fighter's profile in the game's own notation – `5"`, `3+`, `–`
- Keep a Wyrdcry fighter within what it may carry: two hands and one ranged
  slot, one body armour, no armour for a WIZARD, nothing at all for a BEAST.
  Wargear is a checklist: what a fighter could never take is named in a hint
  under it, what its current gear rules out stays, disabled with the reason
- Keep a Black Death City fighter within its carrying limit: two melee
  weapons with Held Items among them, one ranged, one set of armour, two
  items, one two-handed weapon, Full-Plate and Held Items not with a
  two-handed ranged weapon, and Rare 0-x across the warband
- Make the choice a fighter brings on recruitment: an Eshin Sorcerer's spell, a
  Mercenary Champion's Fight or Shoot, the Mutation Table row rolled at the
  table. A raised characteristic is counted into the profile
- Never go too far: whatever would take the warband over its budget, past a
  fighter's or a group's limit, or against its Origin is disabled, and says why
- See what is still missing – a leader, enough henchmen, an open choice – on
  every step, and as a list at the end
- An Origin sets the leader and changes limits, such as 0-2 Pox Priest's
  Apprentices for the Acolytes of Plague
- Come back to any step later, including the faction; switching faction asks
  first when fighters or a choice would be lost
- Star one warband to keep it at the top of the list, which otherwise runs A
  to Z; the star stays on the device and out of the export
- See each warband's campaign figures in the list, such as Wyrdcry's favour
  with its standing and the reputation
- Name the warband, pick the colour of its cards and write its fluff and notes,
  in the finish step or on the back of the warband card;
  a card without a name says Unnamed warband or Unnamed fighter and leads to
  where it is named
- See the warband as a deck of cards laid out as the Wyrdcry Warband Deck's: a
  card for the warband with its fighters, figures, fluff and notes, then one
  for each fighter with its profile, its cost – in Wyrdcry beside its renown –
  its weapons and rules; a Wyrdcry fighter without a
  melee weapon fights Unarmed, as the table then says. In Wyrdcry a
  characteristic counts in the fighter's pick, its renown, its injuries and its
  armour, and tapped it says how it adds up and what a situation can still
  change, marked with a star. An injury the fighter keeps stands among its
  rules, with the characteristic, the keyword or the bar on reactions it brings
- Turn a fighter's card over with the pencil under it to write the fighter's
  name, fluff and notes, which the card then shows, and to put a photo of the painted
  model in its image field, moved and zoomed there; the photo stays on the device.
  The back also hands what the fighter bought to the stash and takes pieces
  from it, each checked as the builder checks it, and not during a battle;
  buying is in the builder, which the back links to. In Wyrdcry the builder
  offers the Trading Post to every fighter that takes equipment, one of each
  piece, and asks before a rare one whether a Rarity roll of 6+ found it
  In Wyrdcry the back also corrects renown by hand – it does not go below a
  level already spent; a BEAST or THRALL has none. Spend renown turns the
  back to a page for the next open level, as the Warband Deck does, and lists
  the levels spent, the last with Undo, and the injuries the fighter keeps,
  each to remove, and why it sits out – Captured with Got back – kept until
  Done like the rest. The
  warband's favour is set by hand in the finish step and on the back of the
  warband card, with the standing and reputation it comes to
- Turn the warband card over with the pencil under it to write its name,
  fluff and notes as a fighter's back has them, set its favour, pick the
  colour of its cards – the deck takes it on at once, Cancel brings back the
  old one –, add gold, sell or throw away what lies in the stash, and add or
  strike battles – all kept apart until Done. Wyrdcry sells a piece for half its price, rounded down to
  5 gc and never below 5 gc; Black Death City's playtest has no rule for it yet
- Track a battle at the table: Battle on the warband card starts it, counts
  the rounds with one step back, and ends it after asking; the bar under a
  fighter's card takes Health down a point at a time, the card fills with
  blood, and a fighter at none is out of action – with the Wilhelm scream,
  which can be switched off. State marks a fighter activated or waiting, and
  in Wyrdcry in cover, panicked or with its heroic reaction used, on the card
  and in the strokes over the deck. A Wyrdcry warband with more than half its
  fighters out of action asks each fighter for its Bravery test in the round
  after, and the Witch Hunters count Zeal into every fighter's figures
- End a Wyrdcry battle in pages over the deck, each set as the back of a card
  with its answers at the foot: the result, the
  shards delivered with what they bring in favour and gold, and the battle
  history; who was taken out of action, and for each of them the injury table
  to tap what the dice rolled – an injury it already has counts as a Flesh
  Wound, a fourth kills a HERO, Unbending Will rolls none; the single-use
  items used up, with Crimson Shade's roll for Sticky Fingers; then each fighter's
  renown roll – what adds to it, the score it needs, and whether it reached it,
  twice for the one marked for greatness, and for a HENCHMAN more for each
  Drillmaster that came through; a Bootlicker that came through adds a favour. Apply carries out what an injury does once:
  a dead fighter leaves the roster, its equipment going to the stash on a 3+
  (a dead leader stays, marked Dead, until the app can pick another), a surgeon
  costs 15 gc, robbery takes what the fighter bought, and a captured fighter or
  one that misses the next battle carries a band, and a single-use item used up
  leaves the fighter's equipment; Sticky Fingers is a reminder
  under the shards. Apply writes it all into the warband and the
  battle history, which the warband card shows with its favour, standing and
  reputation
- Spend each level of renown in a sheet set as the back of the fighter's card, after the battle or from the Battle
  menu: a characteristic within the fighter's racial limit on every level, and
  for a hero a heroic talent on every odd one – a henchman's third level makes
  it a HERO, on its card and among the warband's heroes; a legendary ability
  from renown 5, one fighter per warband. A recruited leader starts with a level
  to spend. A level spent under older rules opens again for what it lacks
- Export a warband as a JSON file, to keep a copy outside the browser – through
  the share sheet on a phone, as a download on a desktop
- Import such a file again, on this device or another: the app says whether it
  is new, the same, newer or older than what is stored, asks before an older
  state overwrites a newer one, and says so where the warband goes past its
  limits – it is imported as it is
- Import a warband from the Wyrdcry Warband Deck or the Warband Builder, its
  campaign included; the sheet says what is carried over differently, such as
  pending purchases taken as bought and custom abilities moved into the notes;
  experience is not carried over
- Get a warband's roster as a PDF, laid out as the Wyrdcry Warband Deck's: the
  warband, a row per fighter with profile, abilities, weapons and notes in the
  game's own columns – in Wyrdcry with the battles won, drawn and lost and each
  fighter's renown – then every rule of the warband, its
  fighters and their gear once, with the fighters that carry it
- Delete a warband after a question that says what is lost and offers the
  export first
- Dark and light mode
- An about page with the games, where their rules come from, and answers to
  the first questions

## Games and factions

| Game | Rules the data follows | Factions |
| --- | --- | --- |
| Black Death City | Playtest v1.01 | Death Covens, Guild Mercenaries, The Blighted Cloister, Verminkin |
| Wyrdcry | 0.9, core rules 1.0 WIP, Campaign Book 0.9 | Clan Eshin, Mercenaries, Possessed, Sisters of Sigmar, Undead, Witch Hunters |
| Mordheim | – | eventually |

What the app reads from the rules so far: profiles, costs, limits, the
wargear each fighter may take and how much of it at once, the warband's
choice and its effect on the roster, and the choice a Wyrdcry fighter makes
on recruitment. Wyrdcry's abilities and faction rules are shown as text. Not
there yet: State Pride's effects on the profiles, the special rules of Black
Death City's fighters, the skills and spells they pick on recruitment, and
the cost of a Misbegotten's bloodline mutation.

## Roadmap

What is built and what comes next is a checklist in [`ROADMAP.md`](ROADMAP.md),
with ideas nothing is promised for at its end.

## Data

Every warband lives in the browser's IndexedDB, on this one device and in
this one browser. No account, no server, no sync. Clearing the site's data
removes them. Export a warband to keep a copy; Import warband brings it back,
here or on another device. Add the app to the home screen: Safari can remove
the data of a site not opened for seven days, and keeps it for good mostly for
an installed app. The about page says how. Once opened with a network, the app
starts without one: a service worker keeps every file of the build, the game
data and the roster's PDF library included. A battle in progress stays on the device and is not
part of the export.

Photos of the painted models are kept in the same database, reduced to a copy of
their own, and never go into an export: deleting the warband deletes them too,
importing it elsewhere brings no photos along, and a photo whose fighter is no
longer in the warband is dropped. The photo you picked stays where it was –
unless it was taken with the camera from inside the app.

## Development

Node 20 or newer. Go through the `Makefile` rather than calling npm directly –
it puts Homebrew's Node first in the `PATH`, where an older one would otherwise
win and fail with a message that reads like a problem with the project.

```sh
make install
make dev
```

| Command | Purpose |
| --- | --- |
| `make install` | install the dependencies |
| `make dev` | development server on the local network; opens `/dev`, a QR code to open it on a phone |
| `make build` | static site into `build/` |
| `make check` | type check |

The code is split into what every game shares and what each game brings:

- `src/lib/core/` – the warband, the checks on it, and what a choice changes
- `src/lib/systems/` – one module per game: its characteristics, budget and
  groups, and the translation of its data into the shared shape
- `src/lib/rules/<game>/factions/<faction>/` – the data, one folder per
  faction; a new folder is picked up without further code
- `src/lib/pdf/` – the roster as a PDF; its title and columns come from each
  game's module, as `roster`
- `src/routes/dev/` – the page `make dev` opens: the dev server's address on
  the network as a QR code. Empty in a build
- `src/lib/fixtures/` – warbands to test with, as the app stores them: put one
  into localStorage under `fantasy-city-warbands:warbands` as an array, and
  the next visit carries it over into IndexedDB. Taken from the
  Wyrdcry Warband Deck's fixtures; `maximum.json` breaks the budget and the
  limits on purpose, and Crixxit's Pack leaves its sorcerer's spell open

## Deployment

GitHub Actions builds the app on every push to `main`, runs the type check
first and publishes it to GitHub Pages.

## Where the rules come from

- **Wyrdcry** – copied unchanged from the hand-kept ruleset of the
  [Wyrdcry Warband Deck](https://github.com/HENNIROCKS/wyrdcry-warband-deck),
  which follows the rules at [wyrdcry.net](https://wyrdcry.net). Wyrdcry is
  by Johan Markström; the rules belong to the Wyrdcry project.
- **Black Death City** – transcribed by hand from the Black Death City
  Playtest v1.01 by Sam Pearson. Where the playtest contradicts itself, the
  fighter's own scroll wins over the fighter list.

Where the app reads a game differently from its page or its data, or settles a
contradiction one way, [`DEVIATIONS.md`](DEVIATIONS.md) says so.

A wrong number or rules text is worth a [bug report](https://github.com/HENNIROCKS/fantasy-city-warbands/issues/new/choose);
quote the rulebook and name the page if you can.

## Licence

The code is MIT, see [LICENSE](LICENSE). The rules data under `src/lib/rules/`
is not covered by it: it belongs to the authors of the games. The Wilhelm
scream (`src/lib/assets/sounds/`) is converted from
[Wilhelm_Scream.ogg](https://commons.wikimedia.org/wiki/File:Wilhelm_Scream.ogg)
on Wikimedia Commons, released there under CC0.
