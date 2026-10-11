# Fantasy City Warbands (Early)

Build a warband for a skirmish game set in a fantasy city, step by step, with
the budget and the roster limits checked as you go. Two games so far:
[Wyrdcry](https://wyrdcry.net) and [Black Death City](https://www.blackdeathcity.com/).
Mordheim is planned.

<https://hennirocks.github.io/fantasy-city-warbands/>

Unofficial fan project. No connection to Games Workshop, Johan Markström and
the Wyrdcry project, or Sam Pearson and Black Death City.

**Status: early.** The app builds a warband, lets you change it later and shows
it as a deck of cards that counts damage in a battle. It exports a warband as
a file, imports it again and prints its roster as a PDF, all in a first
version. It does not yet import the Warband Deck's or the Warband Builder's
files, or know anything about a campaign: no experience, no injuries, no income.

## What it does

- Build a warband in five steps: game, faction, the choice the whole warband
  makes (State Pride in Wyrdcry, Origin in Black Death City), fighters, finish
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
- Name the warband, pick the colour of its cards and write its fluff and notes
- See the warband as a deck of cards laid out as the Wyrdcry Warband Deck's: a
  card for the warband with its fighters, figures, fluff and notes, then one
  for each fighter with its profile, weapons and rules
- Count damage at the table: the bar under a fighter's card takes Health down
  a point at a time, the card fills with blood, and a fighter at none is out
  of action – with the Wilhelm scream, which can be switched off. End battle
  on the warband card drops every wound
- Export a warband as a JSON file, to keep a copy outside the browser – through
  the share sheet on a phone, as a download on a desktop
- Import such a file again, on this device or another: the app says whether it
  is new, the same, newer or older than what is stored, and asks before an
  older state overwrites a newer one
- Get a warband's roster as a PDF, laid out as the Wyrdcry Warband Deck's: the
  warband, a row per fighter with profile, abilities and weapons in the game's
  own columns, then every rule once with the fighters that carry it
- Delete a warband after a question that says what is lost and offers the
  export first
- Dark and light mode
- An about page with the games, where their rules come from, and answers to
  the first questions

## Games and factions

| Game | Rules the data follows | Factions |
| --- | --- | --- |
| Black Death City | Playtest v1.01 | Death Covens, Guild Mercenaries, The Blighted Cloister, Verminkin |
| Wyrdcry | 0.9 | Clan Eshin, Mercenaries, Possessed, Sisters of Sigmar, Undead, Witch Hunters |
| Mordheim | – | planned |

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

Every warband lives in the browser's local storage, on this one device and in
this one browser. No account, no server, no sync. Clearing the site's data
removes them.

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
- `src/lib/fixtures/` – warbands to test with, as the app stores them: put one
  into localStorage under `fantasy-city-warbands:warbands`. Taken from the
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
