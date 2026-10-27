import type { Faction, GameSystem, Warband } from "$lib/core/types";
import { upgrade } from "$lib/core/warband";

import * as blackDeathCity from "./black-death-city";
import * as wyrdcry from "./wyrdcry";

export interface System {
  game: GameSystem;
  factions: Faction[];
}

/** Every game the app can build a warband for, by its id. */
export const systems: Record<string, System> = {
  [wyrdcry.game.id]: wyrdcry,
  [blackDeathCity.game.id]: blackDeathCity,
};

/** Games that are meant to come but have no data yet: shown, but not selectable. */
export const planned: { id: string; name: string; author: string }[] = [
  { id: "mordheim", name: "Mordheim", author: "Tuomas Pirinen" },
  { id: "necropolis", name: "Necropolis", author: "Peter Vigors" },
];

/** The warband in the ids its game's data uses now; see `Wargear.replaces`. */
export function upgraded(warband: Warband): Warband {
  const system = systems[warband.game];
  const faction = system?.factions.find((f) => f.id === warband.factionId);
  return faction ? upgrade(warband, faction) : warband;
}

/* An id a piece replaces that is a piece of its own never fires: a slip in the data. */
if (import.meta.env.DEV) {
  for (const { factions } of Object.values(systems)) {
    for (const faction of factions) {
      for (const w of faction.wargear) {
        const live = (w.replaces ?? []).filter((id) => faction.wargear.some((x) => x.id === id));
        if (live.length) console.warn(`${faction.id}/${w.id} replaces ${live.join(", ")}, which the faction still has`);
      }
    }
  }
}
