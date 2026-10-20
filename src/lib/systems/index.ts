import type { Faction, GameSystem, Warband } from "$lib/core/types";

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

/** The warband in the ids its game's data uses now; see `GameSystem.upgrade`. */
export function upgraded(warband: Warband): Warband {
  const system = systems[warband.game];
  const faction = system?.factions.find((f) => f.id === warband.factionId);
  return system?.game.upgrade && faction ? system.game.upgrade(warband, faction) : warband;
}
