import SwiftUI

struct ContentView: View {
    @EnvironmentObject private var store: TournamentStore

    var body: some View {
        NavigationStack {
            Group {
                if let bracket = store.bracket {
                    List {
                        ForEach(bracket.view.rounds, id: \.self) { round in
                            let matches = bracket.view.matches.filter { $0.roundName == round }
                            if !matches.isEmpty {
                                Section(round) {
                                    ForEach(matches) { match in
                                        NavigationLink(value: match) { MatchRow(match: match) }
                                    }
                                }
                            }
                        }
                    }
                } else if let error = store.errorMessage {
                    ContentUnavailableView("Scorekeeper unavailable", systemImage: "wifi.exclamationmark", description: Text(error))
                } else {
                    ProgressView("Loading bracket")
                }
            }
            .navigationTitle(store.bracket?.title ?? "Pickleball")
            .navigationDestination(for: Match.self) { MatchScoreView(match: $0) }
            .task {
                while !Task.isCancelled {
                    await store.refresh()
                    try? await Task.sleep(nanoseconds: 5_000_000_000)
                }
            }
            .refreshable { await store.refresh() }
        }
    }
}

private struct MatchRow: View {
    let match: Match
    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            Text("Match \(match.index)").font(.caption).foregroundStyle(.secondary)
            Text(match.playerA?.name ?? "Waiting").lineLimit(1)
            Text(match.playerB?.name ?? "Waiting").lineLimit(1)
            if match.playerA != nil && match.playerB != nil {
                Text("\(match.score.scoreA) – \(match.score.scoreB)  ·  \(match.score.servingLabel)")
                    .font(.caption2)
                    .foregroundStyle(match.isPlayable ? Color.accentColor : Color.secondary)
            }
        }
    }
}
