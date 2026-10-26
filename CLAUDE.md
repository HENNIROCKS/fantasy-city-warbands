# CLAUDE.md – Fantasy City Warbands

Eine SvelteKit-App, mit der man eine Bande für ein Skirmish-Spiel in einer
Fantasy-Stadt baut und umbaut: Wyrdcry und Black Death City, Mordheim und
Necropolis irgendwann.
Was die App kann und wie sie deployt wird, steht in der `README.md`.

Sie löst das Wyrdcry Warband Deck (Archiv auf GitHub, `HENNIROCKS/wyrdcry-warband-deck`)
auf Dauer ab: Wyrdcry soll hier den Stand des Decks erreichen, und die App wird so
gebaut, dass sie alle Spiele trägt. Was dem Deck gegenüber noch fehlt, steht in
der `ROADMAP.md`. Beim Übertragen einer Funktion zuerst den Code des Decks lesen,
nur lesend über `gh api repos/HENNIROCKS/wyrdcry-warband-deck/contents/<pfad>`.

Was gebaut ist und was als nächstes drankommt, steht als Checkliste in der
`ROADMAP.md`: eine Zeile je Punkt, keine Unterpunkte, keine Begründungen, keine
Daten. Sie ist die einzige Stelle, an der offene Punkte zum Bauen gepflegt
werden. Abgehakte Punkte stehen oben, nie zwischen offenen. Der abgehakte
Block beginnt mit einer Übersicht, eine Zeile je Bereich; darunter bekommt ein
erledigter Punkt eine eigene Zeile am Ende des Blocks, damit „What’s new“ das
Neueste zeigt. Sind es mehr als etwa zehn solcher Zeilen, gehen sie in die
Übersichtszeilen ein. Unter „Ideas“ steht, was weder versprochen noch geplant
ist.

Wo die App bewusst anders steht als das, was ein Spiel druckt oder als Daten
mitbringt, oder einen Widerspruch darin in eine Richtung auflöst, führt
`DEVIATIONS.md` – je Spiel ein Abschnitt, `[x]` vom Autor der Regeln bestätigt,
`[ ]` eigene Lesart. Eine neue Abweichung bekommt dort eine Zeile, nicht in der
Roadmap; was dort steht, gleicht keine Session wieder an. Darunter steht unter
„Open upstream“, was nur der Autor klären kann und hier noch nichts ändert –
nur Offenes. Eine beantwortete Frage verlässt die Liste: Weicht die App danach
weiter von Gedrucktem ab, wandert sie als `[x]` darüber, sonst wird sie
gelöscht; die Antwort steht in der Vault-Notiz. Ist nichts offen, entfällt die
Überschrift.

Was bei Wyrdcry unter „Open upstream“ steht, und jede Lesart `[ ]`, die nur
der Autor klären kann, steht zugleich als Frage in
`_works/wyrdcry-questions-<datum>.txt` – ein Post für den Discord des Autors:
englisch, einfache Sprache, keine Anrede, kein Begleittext, keine
Ausrufezeichen, keine Gedankenstriche, unter 2000 Zeichen. Je Frage eine
nummerierte Zeile mit der Quelle (Seite, Datei) in Klammern, gegliedert nach
Rulebook, Campaign Book, Daten und Fraktionen. Kommt eine Frage dazu oder
fällt eine weg, weil der Autor geantwortet hat und die Zeile abgehakt ist,
entsteht eine neue Datei mit dem Datum des Tages, und die vorige geht per
`trash` in den Papierkorb; ist keine Frage mehr offen, liegt keine Datei dort.

Anleitungen für Spielende stehen in `docs/`, gegliedert erst nach Spielen
(`docs/<spiel>/`), dann nach Themen, eine Seite je Thema; was für alle Spiele
gleich gilt, liegt direkt in `docs/`. Die App liest dieselben Dateien beim
Build ein (`src/lib/docs.ts`) und zeigt sie unter `/docs`, erreichbar über
Settings und verlinkt aus der README. Der Renderer kennt nur Überschriften,
Absätze, Listen, fett, kursiv, Links und Bilder; eine Liste, deren Punkte mit
einem Link beginnen, wird zu Buttons. Bilder sind die Icons der App aus
`docs/icons/`, Kopien der SVGs aus dem Markup: Ändert sich ein Icon in der
App, zieht seine Datei dort mit.

Die Seiten sind kurz und in einfacher Sprache, ein roter Faden durch den
Spielabend statt einer Liste von Änderungen. Sie beschreiben, wie man eine
Spielmechanik mit der App anwendet, und schreiben keine Regeln ab. Ändert sich
eine Funktion, ändert sich ihre Seite im selben Schritt; was die Docs
erklären, steht nicht noch einmal in den Fragen der Settings-Seite.

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

Bevor ein Spiel etwas Eigenes bekommt, wird gesucht, ob der Kern es schon trägt
(`Wargear.effects`, `FighterChoice`, `campaign.recruited` …): lieber ein Feld in
den Daten, das der Kern für jedes Spiel liest, als ein Haken mit festen Ids.
Eine Änderung für ein Spiel wird an allen Spielen geprüft – Daten laden, die
anderen Spiele durch die geänderten Funktionen, je eine Bande auf jeder
geänderten Seite.

**Wyrdcry** wird hier gepflegt. Der Bestand stammt aus dem handgepflegten
Regelbestand des Warband Decks (`src/lib/rules/` im Archiv),
dessen Daten eingefroren sind; sein Repo ist seit 12.10.2026 ein öffentliches
Archiv, nur lesend. Eine Korrektur gehört hierher, nicht ins Deck.
Einzige Laufzeitquelle ist dieser Bestand – kein Sync aus dem Site-Repo
`~/Sites/wyrdcry`. Ob sich das Regelwerk bewegt hat, zeigt der Skill
`wyrdcry-rules-watch`; übertragen wird von Hand. Eine Bravery-Verbesserung ist
ein negativer Bonus: Bravery ist ein Wurfziel.
Die App folgt Wyrdcry 1.0, die PDFs liegen unter `_works/Rulebooks/`. Die
Kernregeln – Deckung, Moral, Universal Abilities und Reactions, Waffenregeln –
folgen dem Rulebook 1.0.1; Kampagne, Renown, Heroic Talents, Lasting Injuries,
Trading Post und die acht Hired Swords, die es druckt, dem Campaign Book 1.0.
Fraktionen, ihre Kämpfer und Waffen folgen den 1.0-Daten und Fraktionsseiten
des Site-Repos, von Hand übertragen; ebenso Thief und Beastman, die beiden
übrigen der zehn offiziellen Hired Swords unter `rules/wyrdcry/hired-swords/`.

**Black Death City** ist von Hand aus dem Playtest v1.03 übertragen
(`_works/Rulebooks/Black Death City Playtest v1.03.pdf`; die High-Res-Fassung
daneben hat dieselben Seiten und hinten Spickzettel und Roster-Bögen).
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
gesperrt wird nur beim Bauen. Entfernen wird nur gesperrt, wo es eine vorher
eingehaltene Grenze bräche, etwa die Pecking Order; was eine Bande schon
bricht, lässt sich abbauen.

Was schon bezahlt ist, schützt dagegen die Oberfläche, nicht `validate`: Hat
eine Bande gekämpft, sind Fraktion, ihre Wahl und die bezahlte Ausrüstung im
Builder gesperrt. Eine Bande mit anderer Wahl ist nicht ungültig, sie lässt
sich nur nicht mehr so bauen; ein Import bringt sie deshalb ohne Meldung mit.

## Oberfläche

Farben und Formularelemente folgen dem Wyrdcry Card Creator. Der helle Modus
übersetzt in `app.css` einzelne Zink-Klassen; eine nicht übersetzte Stufe bleibt
im hellen Modus dunkel. Für eine neue Zink-Klasse, auch als `hover:` oder
`focus-visible:`, die Übersetzung mitliefern – oder die Theme-Variablen
(`--ui-*`) nutzen.

Die Karten folgen dem Wyrdcry Warband Deck (Archiv auf GitHub):
Aufbau und Bausteine (Deck, WarbandCard, FighterCard, CardBack, WarbandBack,
BattleBar, MenuButton, ValueTable, WeaponTable, Explanation, RenownSheet,
LevelPicker – im Deck TalentPicker –, fit-text) sind dort übernommen und
gekürzt. Eine Änderung am Kartenaufbau wird
zuerst am Deck verglichen. Abweichend vom Deck sind die Sheets über dem Deck
(AftermathSheet, RenownSheet) als Kartenrückseite gesetzt (`.card.back.sheet`),
nicht im Stil der App; das ist gewollt und wird nicht ans Deck angeglichen.
Ebenso stehen die Zustände einer Schlacht in einem Band, durch „·“ getrennt,
nicht je eines wie im Deck, und Rüstung und Items in einem Kasten unter den
Waffen, ihr Text hinter dem Namen, nicht als Absätze.

Auf Kartenrückseiten und Sheets runden alle Buttons mit `--card-button-radius`,
Felder und Kästen nicht. Ein Ja oder Nein ist eine `.switch-row`, eine Wahl
zwischen mehreren Antworten ein Segment oder gestapelte Buttons. `.switch` ist
der Schalter der Settings im App-Stil, global in `@layer components` – nicht für
Karten.

Auswahl als Button-Matrix oder Buttons über die volle Breite, nicht als Select.
Beschriftungen enden nie auf „…“, auch wenn der Button erst ein Sheet öffnet
oder nachfragt („End battle“, „Dismiss Konrad“).
Geprüft wird am Telefon-Format, 375 px: Die Kopfzeile ist dort auf wenige Pixel
genau ausgelegt, eine Änderung an ihr wird gemessen.

## Sprache und Commits

Oberfläche, Kommentare, README und Commits sind englisch; das Gespräch und der
Vault bleiben deutsch. Commit-Messages im Imperativ, ein Satz ohne Präfix,
passend zur Historie: „Add an about page and fill the roadmap". Git-Befehle
führt ausschließlich der Nutzer aus, wie in der globalen `CLAUDE.md`.

`_works/` ist gitignored und der Ort für Arbeitsmaterial.
