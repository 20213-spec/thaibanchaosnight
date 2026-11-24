export const MAX_PLAYERS = 40;
export const MAX_TEAM_SIZE = 8;

export const TEAMS = [
  { id: "red", name: "Team Red", color: "#E5383B" },
  { id: "blue", name: "Team Blue", color: "#2F6DF6" },
  { id: "green", name: "Team Green", color: "#2FA84F" },
  { id: "yellow", name: "Team Yellow", color: "#F5B700" },
  { id: "purple", name: "Team Purple", color: "#8E4FD6" },
] as const;

export type TeamId = (typeof TEAMS)[number]["id"];

/** counts: current member count per team. Returns the team with the fewest members that still has room. */
export function suggestTeam(counts: Record<TeamId, number>): TeamId | null {
  let best: TeamId | null = null;
  for (const t of TEAMS) {
    if (counts[t.id] >= MAX_TEAM_SIZE) continue;
    if (best === null || counts[t.id] < counts[best]) best = t.id;
  }
  return best;
}

export function canJoinTeam(counts: Record<TeamId, number>, team: TeamId, started: boolean): boolean {
  return !started && counts[team] < MAX_TEAM_SIZE;
}
