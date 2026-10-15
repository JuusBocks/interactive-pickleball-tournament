import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const bracketStates = sqliteTable("bracket_states", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  payload: text("payload").notNull(),
  revision: integer("revision").notNull().default(1),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const tournamentRecords = sqliteTable("tournament_records", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  mode: text("mode").notNull(),
  championName: text("champion_name").notNull(),
  players: text("players").notNull(),
  matches: text("matches").notNull(),
  completedAt: text("completed_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
