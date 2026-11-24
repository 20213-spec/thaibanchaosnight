import { Schema, MapSchema, type } from "@colyseus/schema";

export class Player extends Schema {
  @type("string") name = "";
  @type("string") team = "";
  @type("boolean") ready = false;
  @type("number") score = 0;
  @type("boolean") connected = true;
  @type("number") x = 0;
  @type("number") y = 0;
  @type("number") z = 0;
  @type("number") ry = 0;
  @type("string") role = "human";
  @type("boolean") carrying = false;
  @type("number") delivered = 0;
  @type("boolean") scared = false;
  @type("string") acc = ""; // equipped cosmetic id (public); the wallet itself is never put in the shared state
  @type("number") skin = 0;
  @type("number") hat = 0;
  @type("number") hair = 0;
  @type("number") hairColor = 0;
  @type("number") top = 0;
  @type("number") bottom = 1;
  @type("number") bottomColor = 0;
  @type("number") shoes = 0;
  @type("boolean") gadget = false; // holding a throwable gadget (Chaos Party relay and fishing rounds)
  @type("boolean") fishing = false; // true while a line is in the water (drives the fishing pose for everyone)
}
export class Evidence extends Schema {
  @type("number") x = 0;
  @type("number") z = 0;
  @type("boolean") active = true;
  @type("boolean") special = false;
}
export class GhostView extends Schema {
  @type("string") kind = "lantern"; // lantern | prankster | shadow | guardian
  @type("number") x = 0;
  @type("number") z = 0;
}
export class GameState extends Schema {
  @type({ map: Evidence }) evidence = new MapSchema<Evidence>();
  @type({ map: GhostView }) ghosts = new MapSchema<GhostView>(); // AI ghosts, created when the match starts
  @type({ map: Player }) players = new MapSchema<Player>();
  @type("string") hostId = "";
  @type("boolean") started = false;
  @type("string") mode = "ghost_hunt"; // "ghost_hunt" | "chaos_party" | "chaos_night"
  @type("string") weather = "clear"; // clear | fog | rain | storm | wind (hunt modes only)
  @type("string") phase = "";          // chaos_party only: intro | collect | quiz | relay | break
  @type("number") phaseLeft = 0;
  @type("number") round = 0;
  @type("string") roundTitle = "";
  @type({ map: Evidence }) orbs = new MapSchema<Evidence>(); // chaos_party collect-round orbs
  @type({ map: Evidence }) gadgets = new MapSchema<Evidence>(); // throwable gadgets lying on the map (relay and fishing rounds)
  @type({ map: Evidence }) crates = new MapSchema<Evidence>();  // crates knocked out of a carrier's hands, free for anyone to grab
  @type("boolean") ended = false;
  @type("number") secondsLeft = 0;
}

