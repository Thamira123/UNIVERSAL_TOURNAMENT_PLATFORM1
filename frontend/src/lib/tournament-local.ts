export type TournamentTeam = {
  id: string;
  name: string;
  shortCode: string;
  manager: string;
  createdAt: string;
};

export type TournamentMatch = {
  id: string;
  homeTeamId: string;
  homeTeamName: string;
  awayTeamId: string;
  awayTeamName: string;
  startsAt: string;
  venue: string;
  homeScore: number | null;
  awayScore: number | null;
};

function storageKey(tournamentId: string, collection: "teams" | "matches") {
  return `utmp:${tournamentId}:${collection}`;
}

function readCollection<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(key) ?? "[]");
    return Array.isArray(value) ? value as T[] : [];
  } catch {
    return [];
  }
}

function writeCollection<T>(key: string, value: T[]) {
  if (typeof window !== "undefined") window.localStorage.setItem(key, JSON.stringify(value));
}

export function readTournamentTeams(tournamentId: string) {
  return readCollection<TournamentTeam>(storageKey(tournamentId, "teams"));
}

export function writeTournamentTeams(tournamentId: string, teams: TournamentTeam[]) {
  writeCollection(storageKey(tournamentId, "teams"), teams);
}

export function readTournamentMatches(tournamentId: string) {
  return readCollection<TournamentMatch>(storageKey(tournamentId, "matches"));
}

export function writeTournamentMatches(tournamentId: string, matches: TournamentMatch[]) {
  writeCollection(storageKey(tournamentId, "matches"), matches);
}