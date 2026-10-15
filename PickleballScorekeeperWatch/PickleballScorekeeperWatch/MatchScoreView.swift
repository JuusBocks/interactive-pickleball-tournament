import SwiftUI

struct MatchScoreView: View {
    @EnvironmentObject private var store: TournamentStore
    let match: Match

    private var latest: Match { store.bracket?.view.matches.first(where: { $0.id == match.id }) ?? match }

    var body: some View {
        let game = latest
        ScrollView {
            VStack(spacing: 10) {
                scoreButton(name: game.playerA?.name ?? "Top team", score: game.score.scoreA, side: "a", enabled: game.isPlayable)
                HStack {
                    Text(game.score.servingLabel).font(.caption).foregroundStyle(.secondary)
                    Spacer()
                    Text("\(game.score.scoreA) – \(game.score.scoreB)").font(.title3.monospacedDigit()).bold()
                }
                scoreButton(name: game.playerB?.name ?? "Bottom team", score: game.score.scoreB, side: "b", enabled: game.isPlayable)
                Divider()
                Button("Change serve", systemImage: "arrow.triangle.2.circlepath") { Task { await store.send(.advanceServe(matchID: game.id)) } }
                    .buttonStyle(.bordered).disabled(!game.isPlayable || store.isSaving)
                Button("Server \(game.score.serverNumber) · Switch") { Task { await store.send(.serverNumber(matchID: game.id, number: game.score.serverNumber == 1 ? 2 : 1)) } }
                    .buttonStyle(.bordered).disabled(!game.isPlayable || store.isSaving)
                Button("Undo", systemImage: "arrow.uturn.backward") { Task { await store.send(.undo(matchID: game.id)) } }
                    .buttonStyle(.bordered).disabled(game.score.history.isEmpty || store.isSaving)
                if game.isPlayable {
                    Menu("Finish game", systemImage: "flag.checkered") {
                        if let a = game.playerA { Button("\(a.name) won") { Task { await store.send(.setWinner(matchID: game.id, winnerID: a.id)) } } }
                        if let b = game.playerB { Button("\(b.name) won") { Task { await store.send(.setWinner(matchID: game.id, winnerID: b.id)) } } }
                    }.buttonStyle(.borderedProminent)
                }
            }.padding(.horizontal, 5)
        }
        .navigationTitle("Match \(game.index)")
        .task { await store.refresh() }
    }

    private func scoreButton(name: String, score: Int, side: String, enabled: Bool) -> some View {
        VStack(spacing: 6) {
            Text(name).font(.caption).lineLimit(2).multilineTextAlignment(.center)
            Button { Task { await store.send(.adjust(matchID: latest.id, side: side, delta: 1)) } } label: {
                Text("+  \(score)").font(.title2.monospacedDigit()).frame(maxWidth: .infinity)
            }.buttonStyle(.borderedProminent).tint(side == "a" ? .teal : .purple).disabled(!enabled || store.isSaving)
            Button("−") { Task { await store.send(.adjust(matchID: latest.id, side: side, delta: -1)) } }
                .buttonStyle(.bordered).disabled(!enabled || score == 0 || store.isSaving)
        }
    }
}
