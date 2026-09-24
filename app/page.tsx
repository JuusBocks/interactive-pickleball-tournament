"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  Copy,
  Lock,
  ListRestart,
  Plus,
  RefreshCcw,
  RotateCcw,
  Shuffle,
  Trophy,
  Unlock,
  Users,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { BracketView } from "@/lib/bracket";

type TournamentMode = "singles" | "doubles";

type BracketResponse = {
  title: string;
  revision: number;
  updatedAt: string;
  payload: {
    players: Array<{ id: string; name: string }>;
    picks: Record<string, string>;
    locked?: boolean;
    mode?: TournamentMode;
  };
  view: BracketView;
  error?: string;
};

type SaveAction =
  | { type: "setWinner"; matchId: string; winnerId: string | null }
  | { type: "setRoster"; names: string[] }
  | { type: "setMode"; mode: TournamentMode }
  | { type: "addPlayer"; name: string }
  | { type: "removePlayer"; playerId: string }
  | { type: "shufflePlayers" }
  | { type: "startTournament" }
  | { type: "unlockSetup" }
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
  const [newPlayer, setNewPlayer] = useState("");
  const mounted = useRef(true);
  const rosterEditing = useRef(false);
  const titleEditing = useRef(false);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const response = await fetch("/api/bracket", { cache: "no-store" });
      const next = (await response.json()) as BracketResponse;
      if (!response.ok) throw new Error(next.error || "Could not load bracket");
      if (!mounted.current) return;
      setData(next);
      if (!titleEditing.current) {
        setTitle(next.title);
      }
      if (!rosterEditing.current) {
        setRoster(next.payload.players.map((player) => player.name).join("\n"));
      }
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
      titleEditing.current = false;
      rosterEditing.current = false;
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
                  mode: data.view.mode,
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
  const tournamentLocked = Boolean(data?.payload.locked);
  const tournamentMode: TournamentMode = data?.payload.mode === "singles" ? "singles" : "doubles";
  const rosterCount = data?.payload.players.length ?? 0;
  const canStart =
    tournamentMode === "singles"
      ? rosterCount >= 2
      : rosterCount >= 4 && rosterCount % 2 === 0;
  const setupWarning =
    tournamentMode === "doubles" && rosterCount % 2 === 1
      ? "2v2 needs one more player to complete the last team."
      : tournamentMode === "doubles" && rosterCount < 4
        ? "2v2 needs at least four players."
        : "";

  async function copyLink() {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  function saveRoster() {
    rosterEditing.current = false;
    const names = roster
      .split("\n")
      .map((name) => name.trim())
      .filter(Boolean);
    void save({ type: "setRoster", names });
  }

  function addPlayer() {
    const name = newPlayer.trim();
    if (!name) return;
    setNewPlayer("");
    void save({ type: "addPlayer", name });
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f7f8f2_0%,#edf3eb_100%)] pb-[env(safe-area-inset-bottom)] text-foreground">
      <div className="mx-auto flex w-full max-w-[1800px] flex-col gap-3 px-3 py-3 sm:gap-5 sm:px-6 sm:py-4 lg:px-8">
        <header className="flex flex-col gap-3 border-b border-border pb-3 sm:gap-4 sm:pb-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 space-y-2 sm:space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="rounded-md bg-[#db7c26] text-white hover:bg-[#db7c26]">
                Live
              </Badge>
              <Badge variant={tournamentLocked ? "default" : "outline"} className="rounded-md">
                {tournamentLocked ? "Started" : "Setup"}
              </Badge>
              <Badge variant="outline" className="rounded-md bg-white/70">
                {tournamentMode === "doubles" ? "2v2" : "1v1"}
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
              onFocus={() => {
                titleEditing.current = true;
              }}
              onChange={(event) => {
                titleEditing.current = true;
                setTitle(event.target.value);
              }}
              onBlur={() => {
                titleEditing.current = false;
                if (data && title.trim() && title.trim() !== data.title) {
                  void save({ type: "setTitle", title: title.trim() });
                }
              }}
              className="h-auto border-0 bg-transparent px-0 text-2xl font-semibold leading-tight shadow-none focus-visible:ring-0 sm:text-4xl"
              aria-label="Bracket title"
            />
          </div>
          <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap">
            <Button
              variant="outline"
              onClick={() => void load()}
              disabled={loading}
              className="min-h-11 px-2 text-xs sm:min-h-9 sm:px-4 sm:text-sm"
            >
              <RefreshCcw />
              Refresh
            </Button>
            <Button
              variant="outline"
              onClick={() => void copyLink()}
              className="min-h-11 px-2 text-xs sm:min-h-9 sm:px-4 sm:text-sm"
            >
              {copied ? <Check /> : <Copy />}
              {copied ? "Copied" : "Copy link"}
            </Button>
            <Button
              variant="secondary"
              onClick={() => void save({ type: "resetResults" })}
              disabled={!tournamentLocked}
              className="min-h-11 px-2 text-xs sm:min-h-9 sm:px-4 sm:text-sm"
            >
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

        <section className="grid gap-3 sm:gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="order-2 space-y-4 rounded-md border border-border bg-card p-3 shadow-sm sm:p-4 xl:order-1">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Setup</h2>
                <p className="text-sm text-muted-foreground">
                  Choose the format, add players, shuffle, then start.
                </p>
              </div>
              <Users className="size-5 text-primary" />
            </div>

            <div className="grid grid-cols-2 gap-2 rounded-md bg-muted p-1">
              <Button
                type="button"
                variant={tournamentMode === "singles" ? "default" : "ghost"}
                onClick={() => void save({ type: "setMode", mode: "singles" })}
                disabled={tournamentLocked || saving}
                className="min-h-11"
              >
                1v1
              </Button>
              <Button
                type="button"
                variant={tournamentMode === "doubles" ? "default" : "ghost"}
                onClick={() => void save({ type: "setMode", mode: "doubles" })}
                disabled={tournamentLocked || saving}
                className="min-h-11"
              >
                2v2
              </Button>
            </div>

            {setupWarning ? (
              <div className="rounded-md border border-[#db7c26]/30 bg-[#db7c26]/10 px-3 py-2 text-sm text-[#7a3f08] dark:text-[#f0b775]">
                {setupWarning}
              </div>
            ) : null}

            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
              <Input
                value={newPlayer}
                onChange={(event) => setNewPlayer(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") addPlayer();
                }}
                disabled={tournamentLocked || saving}
                placeholder="Add player"
                className="min-h-11 bg-white/70 dark:bg-black/10"
                aria-label="Add player"
              />
              <Button
                type="button"
                onClick={addPlayer}
                disabled={tournamentLocked || saving || !newPlayer.trim()}
                className="min-h-11 px-3"
                aria-label="Add player"
              >
                <Plus />
                Add
              </Button>
            </div>

            <Textarea
              value={roster}
              onFocus={() => {
                rosterEditing.current = true;
              }}
              onChange={(event) => {
                rosterEditing.current = true;
                setRoster(event.target.value);
              }}
              onBlur={() => {
                rosterEditing.current = false;
              }}
              disabled={tournamentLocked}
              className="min-h-[190px] resize-y bg-white/70 leading-6 dark:bg-black/10 sm:min-h-[250px]"
              aria-label="Player roster"
            />
            <div className="grid grid-cols-2 gap-2">
              <Button
                onClick={saveRoster}
                disabled={tournamentLocked || saving}
                className="min-h-11"
              >
                <Check />
                Save list
              </Button>
              <Button
                variant="outline"
                onClick={() => void save({ type: "shufflePlayers" })}
                disabled={tournamentLocked || saving}
                className="min-h-11"
              >
                <Shuffle />
                {tournamentMode === "doubles" ? "Shuffle teams" : "Shuffle"}
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                onClick={() => void save({ type: "restoreDefault" })}
                disabled={tournamentLocked || saving}
                className="min-h-11"
              >
                <ListRestart />
                Restore
              </Button>
              <Button
                onClick={() =>
                  void save({
                    type: tournamentLocked ? "unlockSetup" : "startTournament",
                  })
                }
                disabled={saving || (!tournamentLocked && !canStart)}
                className="min-h-11"
              >
                {tournamentLocked ? <Unlock /> : <Lock />}
                {tournamentLocked ? "Edit setup" : "Start"}
              </Button>
            </div>

            <div className="space-y-2 border-t border-border pt-4">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">
                  {tournamentMode === "doubles" ? "Teams" : "Standings"}
                </span>
                <span className="text-muted-foreground">
                  {tournamentMode === "doubles"
                    ? `${data?.view.players.length ?? 0} teams`
                    : `${data?.view.players.length ?? 0} players`}
                </span>
              </div>
              <div className="max-h-[260px] space-y-2 overflow-auto pr-1 sm:max-h-[340px]">
                {data?.view.players.map((player) => (
                  <div
                    key={player.id}
                    className="grid min-h-11 grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 rounded-md border border-border bg-background/70 px-3 py-2"
                  >
                    <span className="truncate text-sm font-medium">{player.name}</span>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {player.wins}-{player.losses}
                    </span>
                    {!tournamentLocked ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        onClick={() =>
                          void save({ type: "removePlayer", playerId: player.id })
                        }
                        disabled={saving || (data?.payload.players.length ?? 0) <= 2}
                        aria-label={`Remove ${player.name}`}
                      >
                        <X />
                      </Button>
                    ) : null}
                  </div>
                ))}
                {tournamentMode === "doubles" && data?.view.unpairedPlayer ? (
                  <div className="rounded-md border border-dashed border-[#db7c26]/40 bg-[#db7c26]/10 px-3 py-2 text-sm">
                    Waiting for partner: {data.view.unpairedPlayer.name}
                  </div>
                ) : null}
              </div>
            </div>
          </aside>

          <section className="order-1 min-w-0 overflow-hidden rounded-md border border-border bg-card shadow-sm xl:order-2">
            <div className="flex flex-col gap-3 border-b border-border p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
              <div>
                <h2 className="text-lg font-semibold">Bracket</h2>
                <p className="text-sm text-muted-foreground">
                  {tournamentLocked
                    ? `Tap a ${tournamentMode === "doubles" ? "team" : "player"} to advance them. Open screens update automatically.`
                    : `${tournamentMode === "doubles" ? "Shuffle teams" : "Shuffle players"} and start the tournament to enable match picks.`}
                </p>
              </div>
              <div className="flex min-h-11 items-center gap-2 rounded-md bg-accent px-3 py-2 text-sm text-accent-foreground">
                <Trophy className="size-4" />
                <span className="truncate">
                  {data?.view.champion ? data.view.champion.name : "Champion pending"}
                </span>
              </div>
            </div>

            <div className="overflow-visible md:overflow-x-auto">
              <div className="flex flex-col gap-3 p-3 md:grid md:min-w-[980px] md:auto-cols-[minmax(220px,1fr)] md:grid-flow-col md:gap-4 md:p-4">
                {loading && !data ? (
                  <div className="col-span-full rounded-md border border-border bg-muted p-6 text-sm text-muted-foreground">
                    Loading live bracket...
                  </div>
                ) : null}

                {!tournamentLocked && data ? (
                  <div className="rounded-md border border-dashed border-[#0f6b4f]/40 bg-accent/60 p-4 text-sm text-accent-foreground md:col-span-full">
                    Setup is unlocked. Add everyone, use Shuffle to randomize{" "}
                    {tournamentMode === "doubles" ? "teams" : "matchups"}, then tap Start.
                  </div>
                ) : null}

                {rounds.map((round) => (
                  <div key={round.name} className="flex min-w-0 flex-col gap-3 md:min-w-[220px]">
                    <div className="sticky top-0 z-10 rounded-md bg-[#0f6b4f] px-3 py-2 text-sm font-semibold text-white shadow-sm">
                      {round.name}
                    </div>
                    <div className="flex flex-1 flex-col gap-3 md:justify-around md:gap-4">
                      {round.matches.map((match) => {
                        const players = [match.playerA, match.playerB];
                        return (
                          <article
                            key={match.id}
                            className="rounded-md border border-border bg-background p-3 shadow-sm"
                          >
                            <div className="mb-2 flex items-center justify-between gap-2 text-sm text-muted-foreground md:text-xs">
                              <span>Match {match.index}</span>
                              {match.autoAdvanced ? <span>Bye</span> : null}
                            </div>
                            <div className="space-y-2">
                              {players.map((player, index) => {
                                const selected = Boolean(
                                  player && match.winner && player.id === match.winner.id
                                );
                                const disabled =
                                  !tournamentLocked || !player || match.locked || saving;
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
                                    className="h-auto min-h-14 w-full justify-between whitespace-normal px-3 py-3 text-left text-base md:min-h-11 md:py-2 md:text-sm"
                                  >
                                    <span className="min-w-0 overflow-hidden text-ellipsis">
                                      {playerLabel(player?.name)}
                                    </span>
                                    {selected ? (
                                      <span className="flex items-center gap-1 text-xs font-semibold">
                                        Won <Check className="size-4" />
                                      </span>
                                    ) : player && tournamentLocked && !match.locked ? (
                                      <span className="text-xs font-semibold">Win</span>
                                    ) : null}
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
