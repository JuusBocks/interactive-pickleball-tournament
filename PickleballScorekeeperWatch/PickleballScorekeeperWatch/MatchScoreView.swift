import SwiftUI

struct MatchScoreView: View {
    @EnvironmentObject private var store: TournamentStore
    let match: Match

    private var latest: Match {
        store.bracket?.view.matches.first(where: { $0.id == match.id }) ?? match
    }

    var body: some View {
        let game = latest

        VStack(spacing: 4) {
            teamRow(name: game.playerA?.name ?? "Top team", score: game.score.scoreA, side: "a", enabled: game.isPlayable)
            teamRow(name: game.playerB?.name ?? "Bottom team", score: game.score.scoreB, side: "b", enabled: game.isPlayable)

            Text(game.score.servingLabel)
                .font(.caption2)
                .foregroundStyle(.secondary)

            HStack(spacing: 5) {
                Button {
                    Task { await store.send(.advanceServe(matchID: game.id)) }
                } label: {
                    Label("Serve", systemImage: "arrow.triangle.2.circlepath")
                }
                .buttonStyle(.borderedProminent)
                .disabled(!game.isPlayable || store.isSaving)

                Button {
                    Task { await store.send(.serverNumber(matchID: game.id, number: game.score.serverNumber == 1 ? 2 : 1)) }
                } label: {
                    Label("S" + String(game.score.serverNumber), systemImage: "arrow.left.arrow.right")
                }
                .buttonStyle(.bordered)
                .disabled(!game.isPlayable || store.isSaving)
            }

            HStack(spacing: 5) {
                Button("Undo") {
                    Task { await store.send(.undo(matchID: game.id)) }
                }
                .buttonStyle(.bordered)
                .disabled(game.score.history.isEmpty || store.isSaving)

                if game.isPlayable {
                    NavigationLink {
                        WinnerPicker(match: game)
                    } label: {
                        Label("Finish", systemImage: "flag.checkered")
                    }
                    .buttonStyle(.bordered)
                }
            }
        }
        .padding(.horizontal, 4)
        .navigationTitle("Match " + String(game.index))
        .navigationBarTitleDisplayMode(.inline)
        .task { await store.refresh() }
    }

    private func teamRow(name: String, score: Int, side: String, enabled: Bool) -> some View {
        HStack(spacing: 4) {
            Text(name)
                .font(.caption2)
                .lineLimit(1)
                .frame(maxWidth: .infinity, alignment: .leading)

            Button {
                Task { await store.send(.adjust(matchID: latest.id, side: side, delta: -1)) }
            } label: {
                Image(systemName: "minus")
            }
            .buttonStyle(.bordered)
            .disabled(!enabled || score == 0 || store.isSaving)

            Text(String(score))
                .font(.title3.monospacedDigit())
                .bold()
                .frame(minWidth: 20)

            Button {
                Task { await store.send(.adjust(matchID: latest.id, side: side, delta: 1)) }
            } label: {
                Image(systemName: "plus")
            }
            .buttonStyle(.borderedProminent)
            .tint(side == "a" ? .teal : .purple)
            .disabled(!enabled || store.isSaving)
        }
    }
}

private struct WinnerPicker: View {
    @EnvironmentObject private var store: TournamentStore
    let match: Match

    var body: some View {
        List {
            if let a = match.playerA {
                Button(a.name + " won") {
                    Task { await store.send(.setWinner(matchID: match.id, winnerID: a.id)) }
                }
                .buttonStyle(.borderedProminent)
            }
            if let b = match.playerB {
                Button(b.name + " won") {
                    Task { await store.send(.setWinner(matchID: match.id, winnerID: b.id)) }
                }
                .buttonStyle(.borderedProminent)
            }
        }
        .navigationTitle("Choose winner")
    }
}
