import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { bracketStates } from "@/db/schema";
import {
  buildBracket,
  defaultPayload,
  DEFAULT_TITLE,
  getTournamentMode,
  namesToPlayers,
  pruneInvalidPicks,
  type BracketPayload,
  type TournamentMode,
} from "@/lib/bracket";

const BRACKET_ID = "main";

const requestSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("setWinner"),
    matchId: z.string(),
    winnerId: z.string().nullable(),
  }),
  z.object({
    type: z.literal("setRoster"),
    names: z.array(z.string()).min(2).max(64),
  }),
  z.object({
    type: z.literal("setMode"),
    mode: z.enum(["singles", "doubles"]),
  }),
  z.object({
    type: z.literal("addPlayer"),
    name: z.string().min(1).max(80),
  }),
  z.object({
    type: z.literal("removePlayer"),
    playerId: z.string(),
  }),
  z.object({
    type: z.literal("shufflePlayers"),
  }),
  z.object({
    type: z.literal("startTournament"),
  }),
  z.object({
    type: z.literal("unlockSetup"),
  }),
  z.object({
    type: z.literal("setTitle"),
    title: z.string().min(1).max(80),
  }),
  z.object({
    type: z.literal("resetResults"),
  }),
  z.object({
    type: z.literal("restoreDefault"),
  }),
]);

function routeError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected error";
  if (message.includes("no such table")) {
    return "The live bracket database is not ready yet. Deploy the site so its D1 migration can run.";
  }
  return message;
}

function normalizePayload(payload: BracketPayload): BracketPayload {
  return {
    players: payload.players ?? [],
    picks: payload.picks ?? {},
    locked: Boolean(payload.locked),
    mode: getTournamentMode(payload),
  };
}

function startValidationError(mode: TournamentMode, playerCount: number) {
  if (mode === "singles" && playerCount < 2) {
    return "Add at least two players before starting.";
  }
  if (mode === "doubles" && playerCount < 4) {
    return "Add at least four players for a 2v2 tournament.";
  }
  if (mode === "doubles" && playerCount % 2 !== 0) {
    return "2v2 needs an even number of players. Add one more player or remove the unpaired player.";
  }
  return "";
}

function shufflePlayers(players: BracketPayload["players"]) {
  const shuffled = [...players];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

async function readRow() {
  const db = getDb();
  const [row] = await db
    .select()
    .from(bracketStates)
    .where(eq(bracketStates.id, BRACKET_ID))
    .limit(1);

  if (row) return row;

  const payload = defaultPayload();
  await db.insert(bracketStates).values({
    id: BRACKET_ID,
    title: DEFAULT_TITLE,
    payload: JSON.stringify(payload),
    revision: 1,
  });

  const [created] = await db
    .select()
    .from(bracketStates)
    .where(eq(bracketStates.id, BRACKET_ID))
    .limit(1);
  return created;
}

function serialize(row: Awaited<ReturnType<typeof readRow>>) {
  const payload = normalizePayload(JSON.parse(row.payload) as BracketPayload);
  return {
    id: row.id,
    title: row.title,
    revision: row.revision,
    updatedAt: row.updatedAt,
    payload,
    view: buildBracket(payload),
  };
}

export async function GET() {
  try {
    const row = await readRow();
    return Response.json(serialize(row));
  } catch (error) {
    return Response.json({ error: routeError(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const action = requestSchema.parse(await request.json());
    const row = await readRow();
    const currentPayload = normalizePayload(JSON.parse(row.payload) as BracketPayload);
    let title = row.title;
    let payload = currentPayload;

    if (action.type === "setWinner") {
      if (!payload.locked) {
        return Response.json(
          { error: "Start the tournament before picking winners." },
          { status: 400 }
        );
      }
      const picks = { ...payload.picks };
      if (action.winnerId) {
        const match = buildBracket(payload).matches.find(
          (candidate) => candidate.id === action.matchId
        );
        if (
          !match ||
          match.locked ||
          (match.playerA?.id !== action.winnerId && match.playerB?.id !== action.winnerId)
        ) {
          return Response.json(
            { error: "That team is not available to advance in this match yet." },
            { status: 400 }
          );
        }
        picks[action.matchId] = action.winnerId;
      } else {
        delete picks[action.matchId];
      }
      payload = pruneInvalidPicks({ ...payload, picks });
    }

    if (action.type === "setRoster") {
      payload = {
        players: namesToPlayers(action.names),
        picks: {},
        locked: false,
        mode: payload.mode,
      };
    }

    if (action.type === "setMode") {
      payload = {
        ...payload,
        picks: {},
        locked: false,
        mode: action.mode,
      };
    }

    if (action.type === "addPlayer") {
      if (payload.players.length >= 64) {
        return Response.json({ error: "Roster limit is 64 players." }, { status: 400 });
      }
      payload = {
        players: namesToPlayers([
          ...payload.players.map((player) => player.name),
          action.name,
        ]),
        picks: {},
        locked: false,
        mode: payload.mode,
      };
    }

    if (action.type === "removePlayer") {
      const remaining = payload.players.filter((player) => player.id !== action.playerId);
      if (remaining.length < 2) {
        return Response.json(
          { error: "Keep at least two players in the roster." },
          { status: 400 }
        );
      }
      payload = {
        players: remaining,
        picks: {},
        locked: false,
        mode: payload.mode,
      };
    }

    if (action.type === "shufflePlayers") {
      payload = {
        players: shufflePlayers(payload.players),
        picks: {},
        locked: false,
        mode: payload.mode,
      };
    }

    if (action.type === "startTournament") {
      const validationError = startValidationError(
        getTournamentMode(payload),
        payload.players.length
      );
      if (validationError) {
        return Response.json({ error: validationError }, { status: 400 });
      }
      payload = {
        ...payload,
        picks: {},
        locked: true,
      };
    }

    if (action.type === "unlockSetup") {
      payload = {
        ...payload,
        picks: {},
        locked: false,
      };
    }

    if (action.type === "setTitle") {
      title = action.title.trim();
    }

    if (action.type === "resetResults") {
      payload = { ...payload, picks: {} };
    }

    if (action.type === "restoreDefault") {
      title = DEFAULT_TITLE;
      payload = defaultPayload();
    }

    await getDb()
      .update(bracketStates)
      .set({
        title,
        payload: JSON.stringify(payload),
        revision: row.revision + 1,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      })
      .where(eq(bracketStates.id, BRACKET_ID));

    const updated = await readRow();
    return Response.json(serialize(updated));
  } catch (error) {
    const status = error instanceof z.ZodError ? 400 : 500;
    return Response.json({ error: routeError(error) }, { status });
  }
}
