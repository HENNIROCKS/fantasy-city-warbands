# Contributing

Thanks for your interest in contributing to Fantasy City Warbands.

Start with an issue: a [bug](https://github.com/HENNIROCKS/fantasy-city-warbands/issues/new?template=bug.yml),
an [idea](https://github.com/HENNIROCKS/fantasy-city-warbands/issues/new?template=idea.yml)
or a [wrong rule or number](https://github.com/HENNIROCKS/fantasy-city-warbands/issues/new?template=rules.yml).
Before reporting a rule, look at [`DEVIATIONS.md`](DEVIATIONS.md): the app reads
some rules its own way on purpose. What is planned is in [`ROADMAP.md`](ROADMAP.md).

## Prerequisites

Node 20 or newer. Go through the `Makefile` rather than calling npm directly –
it puts Homebrew's Node first in the `PATH`, where an older one would otherwise
win and fail with a message that reads like a problem with the project.

```sh
make install  # install the dependencies
make dev      # development server on the local network, with a QR code for a phone
make build    # static site into build/
make check    # type check
```

## Architecture constraints

**No backend.** Everything runs client-side and the build is a static site on
GitHub Pages. Warbands live in IndexedDB; keep it that way.

**Links through `resolve()`.** The site runs under `/fantasy-city-warbands/`,
so every link between routes goes through `resolve()`, never a hard `/`.

**Shared core, one module per game.** What every game shares lives in
`src/lib/core/`; what one game brings lives in `src/lib/systems/<game>.ts`.
Before a game gets something of its own, look whether the core already carries
it – a field in the data the core reads for every game beats a special case
with fixed ids.

**Light mode translates zinc classes.** `app.css` maps single zinc classes to
their light counterparts; a step without a mapping stays dark in light mode.
A new zinc class, also as `hover:` or `focus-visible:`, brings its mapping
along – or uses the theme variables (`--ui-*`).

**Checks belong in `validate`.** An action that adds or changes something is
run through `validate` first and disabled, with its reason, if it would break
a limit. A new limit goes into `validate`, not into the interface.

## Rules data

- One folder per faction under `src/lib/rules/<game>/factions/<faction>/`; a new
  folder is picked up without further code.
- The JSON files are formatted by hand. Edit the text, don't run a formatter
  over them.
- Read values off the rendered page of the book, not off copied text: copying
  from a PDF shifts columns.
- Where the app deliberately differs from a book, or settles a contradiction
  one way, add a line to [`DEVIATIONS.md`](DEVIATIONS.md).
- The rules data belongs to the authors of the games and is not covered by the
  MIT licence.

## Submitting changes

1. Fork the repository and create a branch from `main`.
2. Make your changes and verify `make check` and `make build` complete without
   errors.
3. Check a change for one game against every game: load a warband of each on
   every page you changed, at phone width (375 px).
4. Look at it in light and dark mode.
5. When a feature changes, change its guide in `docs/` in the same pull
   request, the README and the About page where they describe it, and tick
   it off in `ROADMAP.md`.
6. Open a pull request – fill in the PR template checklist.

Interface, comments and commit messages are in English. A commit message is one
sentence in the imperative, without a prefix: "Add an about page and fill the
roadmap".
