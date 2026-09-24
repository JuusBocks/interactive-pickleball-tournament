import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { bracketStates } from "@/db/schema";
import {
  buildBracket,
  defaultPayload,
  DEFAULT_TITLE,
  namesToPlayers,
  pruneInvalidPicks,
  type BracketPayload,
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
  const payload = JSON.parse(row.payload) as BracketPayload;
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
    const currentPayload = JSON.parse(row.payload) as BracketPayload;
    let title = row.title;
    let payload = currentPayload;

    if (action.type === "setWinner") {
      const picks = { ...payload.picks };
      if (action.winnerId) {
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

