# CLAUDE.md – Fantasy City Warbands

Eine SvelteKit-App, mit der man eine Bande für ein Skirmish-Spiel in einer
Fantasy-Stadt baut und umbaut: Wyrdcry und Black Death City, Mordheim geplant.
Was die App kann und wie sie deployt wird, steht in der `README.md`.

Was gebaut ist und was als nächstes drankommt, steht als Checkliste in der
`ROADMAP.md`: eine Zeile je Punkt, keine Unterpunkte, keine Begründungen, keine
Daten. Architektur, Entscheidungen und offene Punkte im Vault unter
`Projekte/Fantasy City Warbands.md`.

## Befehle

| Befehl | Zweck |
| --- | --- |
| `make install` | Abhängigkeiten installieren |
| `make dev` | Dev-Server auf `localhost:5173` |
| `make build` | statische Seite nach `build/` |
| `make check` | Typprüfung |

**Immer `make`, nie `npm run` direkt.** Herds nvm stellt Node 16 in den PATH,
SvelteKit und Vite brauchen 20+; das Makefile stellt `/opt/homebrew/bin` voran.

Deployt wird bei jedem Push auf `main` über GitHub Actions nach Pages, unter
`/fantasy-city-warbands/`. Den Pfad setzt `BASE_PATH` nur im Workflow; jeder
Link zwischen Routen läuft deshalb über `resolve()`, nie über ein hartes `/`.

## Aufbau

- `src/lib/core/` – was alle Spiele teilen: Bande, Prüfungen, Wirkungen einer
  Wahl. Spielunabhängig; ein Feld, das nur ein Spiel kennt, gehört nicht hierher.
- `src/lib/systems/<spiel>.ts` – je Spiel Werte, Budget, Gruppen, Rollen und die
  Übersetzung der Rohdaten in die gemeinsame Form.
- `src/lib/rules/<spiel>/factions/<fraktion>/` – die Daten, ein Ordner je
  Fraktion. Ein neuer Ordner wird ohne weiteren Code geladen.

**Wyrdcry** ist unverändert aus dem handgepflegten Bestand des Warband Decks
kopiert (`~/Sites/wyrdcry-warband-deck/src/lib/rules/`), nur die offiziellen
Fraktionen. Hier nicht von Hand ändern – sonst ist der Abgleich per `diff` mit
dem Deck verloren. Eine Korrektur gehört ins Deck und wird neu kopiert.

**Black Death City** ist von Hand aus dem Playtest v1.01 übertragen
(`~/Spiele/+ Games Workshop/Mordheim Fanac [1e] - Black Death City Playtest v1.01.pdf`).
Werte **an der PDF-Seite ablesen, nicht am extrahierten Text** – die
Spaltenextraktion verschiebt Profile. Widersprechen sich Fighters List und
Fighter Scroll, gilt die Scroll; der Widerspruch kommt in die Roadmap.

## Grundsatz der Prüfung

Eine Meldung ist `missing` (Bande noch nicht fertig) oder `excess` (zu weit
gegangen). `excess` darf nicht entstehen: Jede Aktion, die etwas hinzufügt oder
umstellt, wird vorher probehalber durch `validate` gerechnet und gesperrt, wenn
sie einen neuen Verstoß brächte – mit dem Grund am Button. Eine neue Grenze
gehört deshalb in `validate`, nicht als eigene Sperre in die Oberfläche.

## Oberfläche

Farben und Formularelemente folgen dem Wyrdcry Card Creator. Der helle Modus
übersetzt in `app.css` einzelne Zink-Klassen; eine nicht übersetzte Stufe bleibt
im hellen Modus dunkel. Für eine neue Zink-Klasse, auch als `hover:` oder
`focus-visible:`, die Übersetzung mitliefern – oder die Theme-Variablen
(`--ui-*`) nutzen.

Die Karten folgen dem Wyrdcry Warband Deck (`~/Sites/wyrdcry-warband-deck`):
Aufbau und Bausteine (Deck, WarbandCard, FighterCard, ValueTable, WeaponTable,
Explanation, fit-text) sind dort übernommen und gekürzt. Eine Änderung am
Kartenaufbau wird zuerst am Deck verglichen.

Auswahl als Button-Matrix oder Buttons über die volle Breite, nicht als Select.
Geprüft wird am Telefon-Format, 375 px: Die Kopfzeile ist dort auf wenige Pixel
genau ausgelegt, eine Änderung an ihr wird gemessen.

## Sprache und Commits

Oberfläche, Kommentare, README und Commits sind englisch; das Gespräch und der
Vault bleiben deutsch. Commit-Messages im Imperativ, ein Satz ohne Präfix,
passend zur Historie: „Add an about page and fill the roadmap". Git-Befehle
führt ausschließlich der Nutzer aus, wie in der globalen `CLAUDE.md`.

`_works/` ist gitignored und der Ort für Arbeitsmaterial.
