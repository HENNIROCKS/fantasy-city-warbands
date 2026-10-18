# CLAUDE.md – Fantasy City Warbands

Eine SvelteKit-App, mit der man eine Bande für ein Skirmish-Spiel in einer
Fantasy-Stadt baut und umbaut: Wyrdcry und Black Death City, Mordheim irgendwann.
Was die App kann und wie sie deployt wird, steht in der `README.md`.

Sie löst das Wyrdcry Warband Deck (`~/Sites/wyrdcry-warband-deck`) auf Dauer
ab: Wyrdcry soll hier den Stand des Decks erreichen, und die App wird so
gebaut, dass sie alle Spiele trägt. Was dem Deck gegenüber noch fehlt, steht in
der `ROADMAP.md`. Beim Übertragen einer Funktion zuerst den Code des Decks lesen.

Was gebaut ist und was als nächstes drankommt, steht als Checkliste in der
`ROADMAP.md`: eine Zeile je Punkt, keine Unterpunkte, keine Begründungen, keine
Daten. Sie ist die einzige Stelle, an der offene Punkte zum Bauen gepflegt
werden. Abgehakte Punkte stehen oben, nie zwischen offenen: ein erledigter
Punkt rückt ans Ende des abgehakten Blocks – so liest sich der abgehakte Block
als Changelog, in der Reihenfolge, in der die Punkte fertig wurden. Unter
„Ideas“ steht, was weder versprochen noch geplant ist.

Wo die App bewusst anders steht als das, was ein Spiel druckt oder als Daten
mitbringt, oder einen Widerspruch darin in eine Richtung auflöst, führt
`DEVIATIONS.md` – je Spiel ein Abschnitt, `[x]` vom Autor der Regeln bestätigt,
`[ ]` eigene Lesart. Eine neue Abweichung bekommt dort eine Zeile, nicht in der
Roadmap; was dort steht, gleicht keine Session wieder an. Darunter steht unter
„Open upstream“, was nur der Autor klären kann und hier noch nichts ändert.

Architektur, Entscheidungen und offene Punkte im Vault unter
`Projekte/Fantasy City Warbands.md`.

## Befehle

| Befehl | Zweck |
| --- | --- |
| `make install` | Abhängigkeiten installieren |
| `make dev` | Dev-Server im Netz, öffnet `/dev` mit dem QR-Code fürs Telefon |
| `make build` | statische Seite nach `build/` |
| `make check` | Typprüfung |

**Immer `make`, nie `npm run` direkt.** Herds nvm stellt Node 16 in den PATH,
SvelteKit und Vite brauchen 20+; das Makefile stellt `/opt/homebrew/bin` voran.

Ein laufender Dev-Server wird nie beendet, auch kein selbst gestarteter; der
Nutzer prüft womöglich gerade darüber.

Deployt wird bei jedem Push auf `main` über GitHub Actions nach Pages, unter
`/fantasy-city-warbands/`. Den Pfad setzt `BASE_PATH` nur im Workflow; jeder
Link zwischen Routen läuft deshalb über `resolve()`, nie über ein hartes `/`.

## Aufbau

- `src/lib/core/` – was alle Spiele teilen: Bande, Prüfungen, Wirkungen einer
  Wahl. Spielunabhängig; ein Feld, das nur ein Spiel kennt, gehört nicht hierher.
- `src/lib/systems/<spiel>.ts` – je Spiel Werte, Budget, Gruppen, Rollen und die
  Übersetzung der Rohdaten in die gemeinsame Form.
- `src/lib/systems/<spiel>-*.ts` – was nur ein Spiel kann und sein System
  einbindet, etwa `wyrdcry-file.ts` (Import aus Deck und Builder) und
  `wyrdcry-renown.ts`. Als Spiel lädt `systems/index.ts` nur `<spiel>.ts`.
- `src/lib/rules/<spiel>/factions/<fraktion>/` – die Daten, ein Ordner je
  Fraktion. Ein neuer Ordner wird ohne weiteren Code geladen.

**Wyrdcry** wird hier gepflegt. Der Bestand stammt aus dem handgepflegten
Regelbestand des Warband Decks (`~/Sites/wyrdcry-warband-deck/src/lib/rules/`),
dessen Daten eingefroren sind; sein Repo ist seit 12.10.2026 ein öffentliches
Archiv, nur lesend. Eine Korrektur gehört hierher, nicht ins Deck.
Einzige Laufzeitquelle ist dieser Bestand – kein Sync aus dem Site-Repo
`~/Sites/wyrdcry`. Ob sich das Regelwerk bewegt hat, zeigt der Skill
`wyrdcry-rules-watch`; übertragen wird von Hand. Eine Bravery-Verbesserung ist
ein negativer Bonus: Bravery ist ein Wurfziel.
Die Kernregeln – Deckung, Moral, Universal Abilities und Reactions,
Waffenregeln – folgen dem Rulebook 1.0 unter `_works/Rulebooks/`, wo immer
die aktuellen PDFs liegen; Kampagne, Renown, Heroic Talents, Lasting Injuries
und Trading Post dem Campaign Book 0.9 dort. Fraktionen, ihre Kämpfer und
Waffen folgen den 0.9-Daten des Site-Repos, von Hand übertragen; Hired Swords
sind dort, aber noch nicht hier.

**Black Death City** ist von Hand aus dem Playtest v1.01 übertragen
(`~/Spiele/+ Games Workshop/Mordheim Fanac [1e] - Black Death City Playtest v1.01.pdf`).
Werte **an der PDF-Seite ablesen, nicht am extrahierten Text** – die
Spaltenextraktion verschiebt Profile. Widersprechen sich Fighters List und
Fighter Scroll, gilt die Scroll; der Widerspruch kommt in die `DEVIATIONS.md`.

## Grundsatz der Prüfung

Eine Meldung ist `missing` (Bande noch nicht fertig) oder `excess` (zu weit
gegangen). `excess` darf nicht entstehen: Jede Aktion, die etwas hinzufügt oder
umstellt, wird vorher probehalber durch `validate` gerechnet und gesperrt, wenn
sie einen neuen Verstoß brächte – mit dem Grund am Button. Eine neue Grenze
gehört deshalb in `validate`, nicht als eigene Sperre in die Oberfläche.
Ein Import übernimmt, was die Datei hat, auch ein `excess`, und sagt es;
gesperrt wird nur beim Bauen.

## Oberfläche

Farben und Formularelemente folgen dem Wyrdcry Card Creator. Der helle Modus
übersetzt in `app.css` einzelne Zink-Klassen; eine nicht übersetzte Stufe bleibt
im hellen Modus dunkel. Für eine neue Zink-Klasse, auch als `hover:` oder
`focus-visible:`, die Übersetzung mitliefern – oder die Theme-Variablen
(`--ui-*`) nutzen.

Die Karten folgen dem Wyrdcry Warband Deck (`~/Sites/wyrdcry-warband-deck`):
Aufbau und Bausteine (Deck, WarbandCard, FighterCard, CardBack, WarbandBack,
BattleBar, MenuButton, ValueTable, WeaponTable, Explanation, RenownSheet,
LevelPicker – im Deck TalentPicker –, fit-text) sind dort übernommen und
gekürzt. Eine Änderung am Kartenaufbau wird
zuerst am Deck verglichen. Abweichend vom Deck sind die Sheets über dem Deck
(AftermathSheet, RenownSheet) als Kartenrückseite gesetzt (`.card.back.sheet`),
nicht im Stil der App; das ist gewollt und wird nicht ans Deck angeglichen.

Auswahl als Button-Matrix oder Buttons über die volle Breite, nicht als Select.
Geprüft wird am Telefon-Format, 375 px: Die Kopfzeile ist dort auf wenige Pixel
genau ausgelegt, eine Änderung an ihr wird gemessen.

## Sprache und Commits

Oberfläche, Kommentare, README und Commits sind englisch; das Gespräch und der
Vault bleiben deutsch. Commit-Messages im Imperativ, ein Satz ohne Präfix,
passend zur Historie: „Add an about page and fill the roadmap". Git-Befehle
führt ausschließlich der Nutzer aus, wie in der globalen `CLAUDE.md`.

`_works/` ist gitignored und der Ort für Arbeitsmaterial.
