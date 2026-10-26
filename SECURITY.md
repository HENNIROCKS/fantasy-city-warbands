# Security Policy

## Scope

Fantasy City Warbands is a fully client-side, static web application. It has no
server, no account and no database of its own: every warband lives in the
browser's IndexedDB on one device, and nothing is sent anywhere unless you
export it or share it yourself. The attack surface is therefore very limited.

Only the live site built from `main` is maintained; there are no older versions
to patch.

Known areas of note:

- **Files and links from someone else** – an imported warband file and an
  opponent's link carry data the app did not make. Both are read as data and
  rendered as text; no user-supplied HTML is passed through.
- **`{@html}`** – used only for SVG the app makes itself: the icons in
  `docs/icons/`, and the QR code of a link to the app's own pages.
- **Dependencies** – the npm dependency tree is the most realistic source of
  supply-chain risk. Run `npm audit` to check for known vulnerabilities.

## Reporting a vulnerability

Because there is no server or user data at risk, there is no need for a private
disclosure channel. Please open a [GitHub issue](https://github.com/HENNIROCKS/fantasy-city-warbands/issues)
describing the vulnerability. Include steps to reproduce and, where applicable,
a proof-of-concept.

Issues will be reviewed and responded to as soon as possible.
