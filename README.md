# Fantasy City Warbands (Early)

Build a warband for a skirmish game set in a fantasy city, step by step, with
the budget and the roster limits checked as you go. Two games so far:
[Wyrdcry](https://wyrdcry.net) and Black Death City. Mordheim is planned.

<https://hennirocks.github.io/fantasy-city-warbands/>

Unofficial fan project. No connection to Games Workshop, the Wyrdcry project or
the author of Black Death City.

**Status: early.** The app builds a warband and lets you change it later. It
does not yet export or print one, show fighter cards, or know anything about a
campaign: no experience, no injuries, no income.

## What it does

- Build a warband in five steps: game, warband, the choice the whole warband
  makes (State Pride in Wyrdcry, Origin in Black Death City), fighters, finish
- See a faction before picking it: its fighters with their costs and limits,
  its choice and its rules
- Recruit fighters and give them wargear from what their faction allows them,
  with the fighter's profile in the game's own notation – `5"`, `3+`, `–`
- Never go too far: whatever would take the warband over its budget, past a
  fighter's or a group's limit, or against its Origin is disabled, and says why
- See what is still missing – a leader, enough henchmen, an open choice – on
  every step, and as a list at the end
- An Origin sets the leader and changes limits, such as 0-2 Pox Priest's
  Apprentices for the Acolytes of Plague
- Come back to any step later, including the faction; switching faction asks
  first when fighters or a choice would be lost
- Dark and light mode

## Games and warbands

| Game | Rules the data follows | Warbands |
| --- | --- | --- |
| Black Death City | Playtest v1.01 | Death Covens, Guild Mercenaries, The Blighted Cloister, Verminkin |
| Wyrdcry | 0.9 | Clan Eshin, Mercenaries, Possessed, Sisters of Sigmar, Undead, Witch Hunters |
| Mordheim | – | planned |

What the app reads from the rules so far: profiles, costs, limits, the
wargear each fighter may take, the warband's choice and its effect on the
roster. Wyrdcry's abilities and faction rules are shown as text. Not there
yet: State Pride's effects on the profiles, the special rules of Black Death
City's fighters, the skills and spells picked on recruitment, and the cost of
a Misbegotten's bloodline mutation.

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
| `make dev` | development server |
| `make build` | static site into `build/` |
| `make check` | type check |

The code is split into what every game shares and what each game brings:

- `src/lib/core/` – the warband, the checks on it, and what a choice changes
- `src/lib/systems/` – one module per game: its characteristics, budget and
  groups, and the translation of its data into the shared shape
- `src/lib/rules/<game>/factions/<faction>/` – the data, one folder per
  faction; a new folder is picked up without further code

## Deployment

GitHub Actions builds the app on every push to `main`, runs the type check
first and publishes it to GitHub Pages.

## Where the rules come from

- **Wyrdcry** – copied unchanged from the hand-kept ruleset of the
  [Wyrdcry Warband Deck](https://github.com/HENNIROCKS/wyrdcry-warband-deck),
  which follows the rules at [wyrdcry.net](https://wyrdcry.net). The rules
  belong to the Wyrdcry project.
- **Black Death City** – transcribed by hand from the Black Death City
  Playtest v1.01 by Sam Pearson. Where the playtest contradicts itself, the
  fighter's own scroll wins over the fighter list.

A wrong number or rules text is worth a [bug report](https://github.com/HENNIROCKS/fantasy-city-warbands/issues/new/choose);
quote the rulebook and name the page if you can.

## Licence

The code is MIT, see [LICENSE](LICENSE). The rules data under `src/lib/rules/`
is not covered by it: it belongs to the authors of the games.
