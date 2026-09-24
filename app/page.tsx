"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  Copy,
  ListRestart,
  RefreshCcw,
  RotateCcw,
  Trophy,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { BracketView } from "@/lib/bracket";

type BracketResponse = {
  title: string;
  revision: number;
  updatedAt: string;
  payload: {
    players: Array<{ id: string; name: string }>;
    picks: Record<string, string>;
  };
  view: BracketView;
  error?: string;
};

type SaveAction =
  | { type: "setWinner"; matchId: string; winnerId: string | null }
  | { type: "setRoster"; names: string[] }
  | { type: "setTitle"; title: string }
  | { type: "resetResults" }
  | { type: "restoreDefault" };

const DATE_FORMATTER = new Intl.DateTimeFormat("en", {
  hour: "numeric",
  minute: "2-digit",
});

function playerLabel(name?: string) {
  return name || "Waiting";
}

export default function Home() {
  const [data, setData] = useState<BracketResponse | null>(null);
  const [title, setTitle] = useState("Pickleball Bracket");
  const [roster, setRoster] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const mounted = useRef(true);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const response = await fetch("/api/bracket", { cache: "no-store" });
      const next = (await response.json()) as BracketResponse;
      if (!response.ok) throw new Error(next.error || "Could not load bracket");
      if (!mounted.current) return;
      setData(next);
      setTitle(next.title);
      setRoster(next.payload.players.map((player) => player.name).join("\n"));
      setError("");
    } catch (loadError) {
      if (!mounted.current) return;
      setError(loadError instanceof Error ? loadError.message : "Could not load bracket");
    } finally {
      if (mounted.current && !quiet) setLoading(false);
    }
  }, []);

  const save = useCallback(async (action: SaveAction) => {
    setSaving(true);
    try {
      const response = await fetch("/api/bracket", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(action),
      });
      const next = (await response.json()) as BracketResponse;
      if (!response.ok) throw new Error(next.error || "Could not save change");
      setData(next);
      setTitle(next.title);
      setRoster(next.payload.players.map((player) => player.name).join("\n"));
      setError("");
      return next;
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save change");
      return null;
    } finally {
      setSaving(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    const firstLoad = window.setTimeout(() => void load(), 0);
    const interval = window.setInterval(() => void load(true), 2500);
    return () => {
      mounted.current = false;
      window.clearTimeout(firstLoad);
      window.clearInterval(interval);
    };
  }, [load]);

  useEffect(() => {
    const modelContext = (
      document as Document & {
        modelContext?: {
          registerTool?: (
            tool: {
              name: string;
              title: string;
              description: string;
              inputSchema: object;
              annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
              execute: (input: unknown) => Promise<unknown> | unknown;
            },
            options: { signal: AbortSignal }
          ) => void | Promise<void>;
        };
      }
    ).modelContext;

    if (!modelContext?.registerTool) return;

    const lifecycle = new AbortController();
    const register = modelContext.registerTool.bind(modelContext);

    void Promise.resolve(
      register(
        {
          name: "read_live_bracket",
          title: "Read live bracket",
          description: "Read the currently visible bracket, players, picks, and champion.",
          inputSchema: {
            type: "object",
            properties: {},
            additionalProperties: false,
          },
          annotations: { readOnlyHint: true, untrustedContentHint: false },
          execute() {
            return data
              ? {
                  title: data.title,
                  revision: data.revision,
                  champion: data.view.champion?.name ?? null,
                  players: data.view.players,
                  matches: data.view.matches,
                }
              : { error: "Bracket is still loading." };
          },
        },
        { signal: lifecycle.signal }
      )
    ).catch(() => undefined);

    void Promise.resolve(
      register(
        {
          name: "set_live_match_winner",
          title: "Set match winner",
          description: "Advance a player in a bracket match and update the shared live bracket.",
          inputSchema: {
            type: "object",
            properties: {
              matchId: { type: "string" },
              winnerId: { type: ["string", "null"] },
            },
            required: ["matchId", "winnerId"],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false, untrustedContentHint: false },
          async execute(input) {
            const value = input as { matchId?: unknown; winnerId?: unknown };
            if (typeof value.matchId !== "string") {
              throw new Error("matchId must be a string.");
            }
            if (typeof value.winnerId !== "string" && value.winnerId !== null) {
              throw new Error("winnerId must be a string or null.");
            }
            const next = await save({
              type: "setWinner",
              matchId: value.matchId,
              winnerId: value.winnerId,
            });
            return next
              ? { revision: next.revision, champion: next.view.champion?.name ?? null }
              : { error: "Could not update winner." };
          },
        },
        { signal: lifecycle.signal }
      )
    ).catch(() => undefined);

    return () => lifecycle.abort();
  }, [data, save]);

  const rounds = useMemo(() => {
    if (!data) return [];
    return data.view.rounds.map((roundName, index) => ({
      name: roundName,
      matches: data.view.matches.filter((match) => match.round === index + 1),
    }));
  }, [data]);

  const lastUpdated = data?.updatedAt
    ? DATE_FORMATTER.format(new Date(`${data.updatedAt.replace(" ", "T")}Z`))
    : "";

  async function copyLink() {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  function saveRoster() {
    const names = roster
      .split("\n")
      .map((name) => name.trim())
      .filter(Boolean);
    void save({ type: "setRoster", names });
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f7f8f2_0%,#edf3eb_100%)] text-foreground">
      <div className="mx-auto flex w-full max-w-[1800px] flex-col gap-5 px-4 py-4 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b border-border pb-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="rounded-md bg-[#db7c26] text-white hover:bg-[#db7c26]">
                Live
              </Badge>
              <Badge variant="outline" className="rounded-md bg-white/70">
                Revision {data?.revision ?? "-"}
              </Badge>
              <Badge variant="outline" className="rounded-md bg-white/70">
                {lastUpdated ? `Updated ${lastUpdated}` : "Syncing"}
              </Badge>
            </div>
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              onBlur={() => {
                if (data && title.trim() && title.trim() !== data.title) {
                  void save({ type: "setTitle", title: title.trim() });
                }
              }}
              className="h-auto border-0 bg-transparent px-0 text-3xl font-semibold shadow-none focus-visible:ring-0 sm:text-4xl"
              aria-label="Bracket title"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void load()} disabled={loading}>
              <RefreshCcw />
              Refresh
            </Button>
            <Button variant="outline" onClick={() => void copyLink()}>
              {copied ? <Check /> : <Copy />}
              {copied ? "Copied" : "Copy link"}
            </Button>
            <Button variant="secondary" onClick={() => void save({ type: "resetResults" })}>
              <RotateCcw />
              Clear picks
            </Button>
          </div>
        </header>

        {error ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        <section className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="space-y-4 rounded-md border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Players</h2>
                <p className="text-sm text-muted-foreground">
                  One name per line. Saving a new roster starts a fresh bracket.
                </p>
              </div>
              <Users className="size-5 text-primary" />
            </div>
            <Textarea
              value={roster}
              onChange={(event) => setRoster(event.target.value)}
              className="min-h-[250px] resize-y bg-white/70 leading-6 dark:bg-black/10"
              aria-label="Player roster"
            />
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={saveRoster} disabled={saving}>
                <Check />
                Save roster
              </Button>
              <Button
                variant="outline"
                onClick={() => void save({ type: "restoreDefault" })}
                disabled={saving}
              >
                <ListRestart />
                Restore
              </Button>
            </div>

            <div className="space-y-2 border-t border-border pt-4">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Standings</span>
                <span className="text-muted-foreground">
                  {data?.view.players.length ?? 0} players
                </span>
              </div>
              <div className="max-h-[340px] space-y-2 overflow-auto pr-1">
                {data?.view.players.map((player) => (
                  <div
                    key={player.id}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-md border border-border bg-background/70 px-3 py-2"
                  >
                    <span className="truncate text-sm font-medium">{player.name}</span>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {player.wins}-{player.losses}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </aside>

          <section className="min-w-0 overflow-hidden rounded-md border border-border bg-card shadow-sm">
            <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold">Bracket</h2>
                <p className="text-sm text-muted-foreground">
                  Tap a player in each match to advance them. Open screens update automatically.
                </p>
              </div>
              <div className="flex items-center gap-2 rounded-md bg-accent px-3 py-2 text-sm text-accent-foreground">
                <Trophy className="size-4" />
                <span className="truncate">
                  {data?.view.champion ? data.view.champion.name : "Champion pending"}
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <div className="grid min-w-[980px] auto-cols-[minmax(220px,1fr)] grid-flow-col gap-4 p-4">
                {loading && !data ? (
                  <div className="col-span-full rounded-md border border-border bg-muted p-6 text-sm text-muted-foreground">
                    Loading live bracket...
                  </div>
                ) : null}

                {rounds.map((round) => (
                  <div key={round.name} className="flex min-w-[220px] flex-col gap-3">
                    <div className="sticky top-0 z-10 rounded-md bg-[#0f6b4f] px-3 py-2 text-sm font-semibold text-white shadow-sm">
                      {round.name}
                    </div>
                    <div className="flex flex-1 flex-col justify-around gap-4">
                      {round.matches.map((match) => {
                        const players = [match.playerA, match.playerB];
                        return (
                          <article
                            key={match.id}
                            className="rounded-md border border-border bg-background p-3 shadow-sm"
                          >
                            <div className="mb-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                              <span>Match {match.index}</span>
                              {match.autoAdvanced ? <span>Bye</span> : null}
                            </div>
                            <div className="space-y-2">
                              {players.map((player, index) => {
                                const selected = player?.id === match.winner?.id;
                                const disabled = !player || match.locked || saving;
                                return (
                                  <Button
                                    key={`${match.id}-${index}`}
                                    type="button"
                                    variant={selected ? "default" : "outline"}
                                    disabled={disabled}
                                    onClick={() =>
                                      player &&
                                      void save({
                                        type: "setWinner",
                                        matchId: match.id,
                                        winnerId: selected ? null : player.id,
                                      })
                                    }
                                    className="h-auto min-h-11 w-full justify-between whitespace-normal px-3 py-2 text-left"
                                  >
                                    <span className="min-w-0 truncate">
                                      {playerLabel(player?.name)}
                                    </span>
                                    {selected ? <Check className="size-4" /> : null}
                                  </Button>
                                );
                              })}
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}
