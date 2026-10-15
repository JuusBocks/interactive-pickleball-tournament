import { desc } from "drizzle-orm";
import { getDb } from "@/db";
import { tournamentRecords } from "@/db/schema";

type ArchivedPlayer = { name: string; wins?: number; losses?: number };

export async function GET() {
  try {
    const records = await getDb()
      .select()
      .from(tournamentRecords)
      .orderBy(desc(tournamentRecords.completedAt))
      .limit(100);

    const standings = new Map<string, { name: string; wins: number; losses: number; titles: number }>();
    for (const record of records) {
      const players = JSON.parse(record.players) as ArchivedPlayer[];
      for (const player of players) {
        const current = standings.get(player.name) ?? {
          name: player.name,
          wins: 0,
          losses: 0,
          titles: 0,
        };
        current.wins += player.wins ?? 0;
        current.losses += player.losses ?? 0;
        if (player.name === record.championName) current.titles += 1;
        standings.set(player.name, current);
      }
    }

    return Response.json({
      tournaments: records,
      standings: [...standings.values()].sort(
        (a, b) => b.titles - a.titles || b.wins - a.wins || a.losses - b.losses
      ),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load tournament records.";
    return Response.json({ error: message }, { status: 500 });
  }
}
