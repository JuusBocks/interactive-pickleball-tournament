export type Player = {
  id: string;
  name: string;
};

export type MatchSource =
  | { type: "player"; playerId: string }
  | { type: "match"; matchId: string }
  | { type: "bye" };

export type BracketMatch = {
  id: string;
  round: number;
  roundName: string;
  index: number;
  sourceA: MatchSource;
  sourceB: MatchSource;
  playerA: Player | null;
  playerB: Player | null;
  winner: Player | null;
  loser: Player | null;
  pickedWinnerId: string | null;
  autoAdvanced: boolean;
  ready: boolean;
  locked: boolean;
};

export type BracketPayload = {
  players: Player[];
  picks: Record<string, string>;
};

export type BracketView = {
  players: Array<Player & { wins: number; losses: number; eliminated: boolean }>;
  matches: BracketMatch[];
  champion: Player | null;
  rounds: string[];
};

const DEFAULT_NAMES = [
  "You",
  "Joel Binu George",
  "ibrar bhai atlanta",
  "Zohaib bhai Atlanta",
  "Farhan Bhai Cumming",
  "Raheel Kamal Bhai Cumming",
  "Mohammed Rizwan",
  "Shafiq bhai cumming #1",
  "Zaviyar Suvidaah Cricket",
  "Star",
  "Manesh",
];

export const DEFAULT_TITLE = "Pickleball Bracket";

function slugify(value: string, fallback: string) {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 42);
  return slug || fallback;
}

export function namesToPlayers(names: string[]) {
  const seen = new Map<string, number>();

  return names
    .map((name) => name.trim())
    .filter(Boolean)
    .map((name, index) => {
      const base = slugify(name, `player-${index + 1}`);
      const count = seen.get(base) ?? 0;
      seen.set(base, count + 1);
      return {
        id: count ? `${base}-${count + 1}` : base,
        name,
      };
    });
}

export function defaultPayload(): BracketPayload {
  return {
    players: namesToPlayers(DEFAULT_NAMES),
    picks: {},
  };
}

function nextPowerOfTwo(value: number) {
  let size = 2;
  while (size < value) size *= 2;
  return size;
}

function roundName(round: number, totalRounds: number) {
  if (round === totalRounds) return "Final";
  if (round === totalRounds - 1) return "Semifinals";
  if (round === totalRounds - 2) return "Quarterfinals";
  return `Round ${round}`;
}

function resolveSource(
  source: MatchSource,
  playersById: Map<string, Player>,
  matchesById: Map<string, BracketMatch>
) {
  if (source.type === "bye") return { player: null, ready: true };
  if (source.type === "player") {
    return { player: playersById.get(source.playerId) ?? null, ready: true };
  }

  const match = matchesById.get(source.matchId);
  return { player: match?.winner ?? null, ready: Boolean(match?.ready) };
}

export function buildBracket(payload: BracketPayload): BracketView {
  const players = payload.players.slice(0, 64);
  const playersById = new Map(players.map((player) => [player.id, player]));
  const size = nextPowerOfTwo(Math.max(players.length, 2));
  const totalRounds = Math.log2(size);
  const matchesById = new Map<string, BracketMatch>();
  const matches: BracketMatch[] = [];
  const roundIds: string[][] = [];
  const slots = Array.from({ length: size }, (_, index) => players[index] ?? null);

  for (let round = 1; round <= totalRounds; round += 1) {
    const count = size / 2 ** round;
    const ids: string[] = [];

    for (let index = 0; index < count; index += 1) {
      const id = `r${round}m${index + 1}`;
      const sourceA: MatchSource =
        round === 1
          ? slots[index * 2]
            ? { type: "player", playerId: slots[index * 2].id }
            : { type: "bye" }
          : { type: "match", matchId: roundIds[round - 2][index * 2] };
      const sourceB: MatchSource =
        round === 1
          ? slots[index * 2 + 1]
            ? { type: "player", playerId: slots[index * 2 + 1].id }
            : { type: "bye" }
          : { type: "match", matchId: roundIds[round - 2][index * 2 + 1] };

      const sideA = resolveSource(sourceA, playersById, matchesById);
      const sideB = resolveSource(sourceB, playersById, matchesById);
      const pickedWinnerId = payload.picks[id] ?? null;
      const pickedWinner =
        pickedWinnerId &&
        (sideA.player?.id === pickedWinnerId || sideB.player?.id === pickedWinnerId)
          ? playersById.get(pickedWinnerId) ?? null
          : null;
      const autoWinner =
        !pickedWinner &&
        sideA.ready &&
        sideB.ready &&
        Boolean(sideA.player) !== Boolean(sideB.player)
          ? sideA.player ?? sideB.player
          : null;
      const winner = pickedWinner ?? autoWinner;
      const loser =
        pickedWinner && sideA.player && sideB.player
          ? sideA.player.id === pickedWinner.id
            ? sideB.player
            : sideA.player
          : null;
      const ready =
        Boolean(winner) ||
        (sideA.ready && sideB.ready && !sideA.player && !sideB.player);
      const match: BracketMatch = {
        id,
        round,
        roundName: roundName(round, totalRounds),
        index: index + 1,
        sourceA,
        sourceB,
        playerA: sideA.player,
        playerB: sideB.player,
        winner,
        loser,
        pickedWinnerId: pickedWinner?.id ?? null,
        autoAdvanced: Boolean(autoWinner),
        ready,
        locked: !sideA.player || !sideB.player,
      };

      matchesById.set(id, match);
      matches.push(match);
      ids.push(id);
    }

    roundIds.push(ids);
  }

  const stats = new Map(
    players.map((player) => [player.id, { wins: 0, losses: 0, eliminated: false }])
  );

  for (const match of matches) {
    if (!match.pickedWinnerId || !match.winner || !match.loser) continue;
    const winner = stats.get(match.winner.id);
    const loser = stats.get(match.loser.id);
    if (winner) winner.wins += 1;
    if (loser) {
      loser.losses += 1;
      loser.eliminated = true;
    }
  }

  return {
    players: players.map((player) => ({ ...player, ...stats.get(player.id)! })),
    matches,
    champion: matches.at(-1)?.winner ?? null,
    rounds: Array.from({ length: totalRounds }, (_, index) =>
      roundName(index + 1, totalRounds)
    ),
  };
}

export function pruneInvalidPicks(payload: BracketPayload) {
  const next = { players: payload.players, picks: { ...payload.picks } };
  let changed = true;

  while (changed) {
    changed = false;
    const view = buildBracket(next);
    for (const match of view.matches) {
      const pick = next.picks[match.id];
      if (!pick) continue;
      if (match.playerA?.id !== pick && match.playerB?.id !== pick) {
        delete next.picks[match.id];
        changed = true;
      }
    }
  }

  return next;
}
