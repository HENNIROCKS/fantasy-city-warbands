# Fantasy City Warbands (Early)

Build a warband for a skirmish game set in a fantasy city, play its battles
from a deck of cards and carry it through a campaign. Two games so far:
[Black Death City](https://www.blackdeathcity.com/) and [Wyrdcry](https://wyrdcry.net).
Mordheim and Necropolis will follow eventually.

<https://hennirocks.github.io/fantasy-city-warbands/>

Unofficial fan project. No connection to Sam Pearson and Black Death City,
Games Workshop, Peter Vigors and Necropolis, or Johan Markström and the
Wyrdcry project.

**Status: early.** The app builds a warband, lets you change it later and shows
it as a deck of cards that counts damage in a battle. It exports a warband as
a file, imports it again and prints its roster as a PDF, all in a first
version. In Wyrdcry, ending a battle brings renown, favour and income, rolls
injuries and loot and adds it to the warband's history, and renown is spent on a
characteristic and a heroic talent. It imports the Warband Deck's and the
Warband Builder's files. In Black Death City it asks for each recruit's
starting experience roll and counts the warband rating, and ending a battle
adds its result to the warband's history; it does not yet know that game's
campaign.

## What it does

- Build a warband in five steps: game, faction, the choice the whole warband
  makes (Origin in Black Death City, State Pride in Wyrdcry), fighters, finish
- See how much of each game the app carries before picking it: a ring on the
  game's tile with one piece per area, such as carrying limits, battle,
  aftermath or advancement, filled where it is built
- See on the start page when the app was last updated, with a link to the
  roadmap; dismissed, the bar stays away until the next update
- See a faction before picking it: its fighters with their costs and limits,
  its choice, its rules and a link to where they are written
- Recruit fighters and give them wargear from what their faction allows them,
  with the fighter's profile in the game's own notation – `5"`, `3+`, `–`;
  duplicate one to recruit another of its kind with the same wargear and
  choice
- Keep a Wyrdcry fighter within what it may carry: two hands and one ranged
  slot, one body armour, no armour for a WIZARD, nothing at all for a BEAST.
  Wargear is a checklist: what a fighter could never take is named in a hint
  under it, what its current gear rules out stays, disabled with the reason,
  and each piece unfolds to its profile, rules or text before it is bought
- Keep a Black Death City fighter within its carrying limit: two melee
  weapons with Held Items among them, one ranged, one set of armour, two
  items, one two-handed weapon, Full-Plate and Held Items not with a
  two-handed ranged weapon, and Rare 0-x across the warband
- Make the choice a fighter brings on recruitment: an Eshin Sorcerer's spell, a
  Mercenary Champion's Fight or Shoot, the Mutation Table row rolled at the
  table, a Misbegotten's bloodline mutation at its price, a Black Death City
  fighter's skills and signature spells – a skill for one fighter of the
  warband only. A raised characteristic is counted into the profile
- Never go too far: whatever would take the warband over its budget, past a
  fighter's or a group's limit, or against its Origin is disabled, and says why
- See what is still missing – a leader, enough henchmen, an open choice – on
  every step, and as a list at the end
- An Origin sets the leader and changes limits, such as 0-2 Pox Priest's
  Apprentices for the Acolytes of Plague
- Come back to any step later, including the faction; switching faction asks
  first when fighters or a choice would be lost, and is closed once the
  warband has fought, since its fighters are paid for
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
  for each fighter with its fluff – from its rules, where they give one, until
  you write your own – its profile, its cost – in Wyrdcry beside its renown –
  its weapons and rules; a Wyrdcry fighter without a
  melee weapon fights Unarmed, as the table then says. A weapon's Attacks
  count in Black Death City's Held Item beside a two-handed melee weapon, and
  in Wyrdcry's Dual Wielding. In Wyrdcry a
  characteristic counts in the fighter's pick, its renown, its injuries and its
  armour, and tapped it says how it adds up and what a situation can still
  change, marked with a star. An injury the fighter keeps stands among its
  rules, with the characteristic, the keyword or the bar on reactions it brings
- Turn a fighter's card over to write on it, add a photo, move equipment to
  and from the stash, correct its campaign, spend renown or dismiss it – see
  [Between battles in Black Death City](docs/black-death-city/between-battles.md)
  and [in Wyrdcry](docs/wyrdcry/between-battles.md)
- Turn the warband card over to name it, pick its colour, set favour, add gold,
  sell from the stash and, in Wyrdcry, add a magic item taken from the
  opponent – see the same guides
- Keep Wyrdcry's magic items: one to a fighter, never sold, 5 reputation each,
  and stolen on a 4+ from a bearer taken out of action
- Track a battle on the cards: damage, states, rounds with one step back, in
  Black Death City the underdog, the scenario and its twist, bloodied fighters,
  the flee test and the prepared spells, and
  in Wyrdcry morale, Zeal and the single-use items ticked off; end it with its
  result in the battle history, or cancel it – see [The battle in Black Death City](docs/black-death-city/battle.md)
  and [in Wyrdcry](docs/wyrdcry/battle.md)
- Hire a Wyrdcry hired sword for one battle – the ten official ones and six
  homebrew, the Goblin Shaman's role and the Troll's kin picked as it is
  hired, each source linked, the homebrew ones and the Rat Ogre with a picture
  of their own, the Dark Warrior refused beside what her rules forbid – listed
  on the warband card, its fee
  paid in the aftermath – see
  [Hired swords](docs/wyrdcry/hired-swords.md)
- End a Wyrdcry battle in a few pages: result, injuries, a magic item stolen,
  a new leader, items used up, renown, the search party's encounters with
  their loot and what they do to a fighter, and income, written in with
  Apply – see
  [The aftermath](docs/wyrdcry/aftermath.md)
- Spend each level of renown on a characteristic, a heroic talent or a
  legendary ability, after the battle or from the Battle menu
- Export a warband as a file, import it again here or elsewhere, and import
  the Warband Deck's and the Warband Builder's files – see
  [Files and the roster](docs/files-and-roster.md) and
  [From the Warband Deck or the Builder](docs/wyrdcry/from-the-deck.md)
- Show an opponent the warband's cards, read only, through a QR code or a
  link that carries the warband itself – see
  [Files and the roster](docs/files-and-roster.md)
- Get a warband's roster as a PDF, laid out as the Wyrdcry Warband Deck's
- Delete a warband after a question that says what is lost and offers the
  export first
- Dark and light mode, under the gear
- Settings, docs and about under the gear: the scream and the tuck box on or
  off, the guides, the games, where their rules come from, and answers to the
  first questions

## Games and their rules

| Game | Rules the data follows |
| --- | --- |
| Black Death City | Playtest v1.03 |
| Wyrdcry | 1.0 – Rulebook 1.0.1, Campaign Book 1.0 and the factions at wyrdcry.net |
| Mordheim | eventually |
| Necropolis | eventually |

What the app reads from the rules so far: profiles, costs, limits, the
wargear each fighter may take and how much of it at once, the warband's
choice and its effect on the roster, the profiles and the prices, the choice a Wyrdcry fighter makes on
recruitment, the Greenskin Marauders' two GOBLINs per ORC, the fighters
who count as half in a Wyrdcry warband's morale, and Wyrdcry's optional
Underdogs. Wyrdcry's abilities and faction rules, the special rules of
Black Death City's fighters and its scenarios and twists are shown as text; a faction rule that leaves a
fighter out, or applies only to a keyword it lacks, shows a hint on its card
instead.

## Using it at the table

Short guides in plain words, one game night after the other, first by game,
then by topic. The app shows them under the gear, offline too; the files are
in [`docs/`](docs/README.md).

## Roadmap

What is built and what comes next is a checklist in [`ROADMAP.md`](ROADMAP.md),
with ideas nothing is promised for at its end.

## Data

Every warband lives in the browser's IndexedDB, on this one device and in
this one browser. No account, no server, no sync. Clearing the site's data
removes them. Export a warband to keep a copy; Import warband brings it back,
here or on another device. Add the app to the home screen: Safari can remove
the data of a site not opened for seven days, and keeps it for good mostly for
an installed app. The page under the gear says how. Once opened with a network, the app
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
How to contribute: [`CONTRIBUTING.md`](CONTRIBUTING.md).

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
  Wyrdcry Warband Deck's fixtures with their campaign, so both have fought;
  `maximum.json` breaks the limits on purpose, and Crixxit's Pack leaves its
  sorcerer's spell open

## Deployment

GitHub Actions builds the app on every push to `main`, runs the type check
first and publishes it to GitHub Pages.

## Where the rules come from

- **Wyrdcry** – kept by hand in the shape of the
  [Wyrdcry Warband Deck](https://github.com/HENNIROCKS/wyrdcry-warband-deck)'s
  ruleset, and following Wyrdcry 1.0: the Rulebook 1.0.1, the Campaign
  Book 1.0 and the factions at [wyrdcry.net](https://wyrdcry.net). Wyrdcry is by
  Johan Markström; the rules belong to the Wyrdcry project.
- **Black Death City** – transcribed by hand from the Black Death City
  Playtest v1.03 by Sam Pearson. Where the playtest contradicts itself, the
  fighter's own scroll wins over the fighter list.

Where the app reads a game differently from its page or its data, or settles a
contradiction one way, [`DEVIATIONS.md`](DEVIATIONS.md) says so.

A wrong number or rules text is worth a
[report](https://github.com/HENNIROCKS/fantasy-city-warbands/issues/new?template=rules.yml).

## Licence

The code is MIT, see [LICENSE](LICENSE). The rules data under `src/lib/rules/`
is not covered by it: it belongs to the authors of the games. The Wilhelm
scream (`src/lib/assets/sounds/`) is converted from
[Wilhelm_Scream.ogg](https://commons.wikimedia.org/wiki/File:Wilhelm_Scream.ogg)
on Wikimedia Commons, released there under CC0. The start screen's etching
(`static/start-screen-v2.webp`) is cropped from
[an etching after Urs Graf, 1524](https://wellcomecollection.org/works/nuac38hn)
in the Wellcome Collection, marked there as public domain. The game logos in
`static/` belong to their games, as the rules data does, and are used with
their permission.
