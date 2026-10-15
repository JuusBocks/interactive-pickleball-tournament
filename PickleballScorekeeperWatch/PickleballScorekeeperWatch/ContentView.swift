import SwiftUI

struct ContentView: View {
    @EnvironmentObject private var store: TournamentStore

    var body: some View {
        NavigationStack {
            List {
                if let bracket = store.bracket {
                    ForEach(bracket.view.matches) { match in
                        NavigationLink(value: match) {
                            MatchRow(match: match)
                        }
                    }
                } else {
                    ProgressView("Loading scores")
                }
            }
            .navigationTitle("Pickleball")
            .navigationDestination(for: Match.self) { match in
                MatchScoreView(match: match)
            }
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
            Text("\(match.roundName.uppercased()) • MATCH \(match.index)")
                .font(.caption2.weight(.bold))
                .foregroundStyle(match.isPlayable ? Color.accentColor : Color.secondary)
            Text(match.playerA?.name ?? "Waiting")
                .lineLimit(1)
            Text(match.playerB?.name ?? "Waiting")
                .lineLimit(1)
            Text("\(match.score.scoreA) – \(match.score.scoreB)")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
    }
}
