import SwiftUI

struct MatchScoreView: View {
    @EnvironmentObject private var store: TournamentStore
    let match: Match

    private var latest: Match {
        store.bracket?.view.matches.first(where: { $0.id == match.id }) ?? match
    }

    var body: some View {
        let game = latest

        VStack(spacing: 7) {
            HStack {
                Text("MATCH " + String(game.index))
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(.secondary)
                Spacer()
                Text(game.score.servingLabel)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }

            teamCard(name: game.playerA?.name ?? "Top team", score: game.score.scoreA, side: "a", enabled: game.isPlayable)
            teamCard(name: game.playerB?.name ?? "Bottom team", score: game.score.scoreB, side: "b", enabled: game.isPlayable)

            HStack(spacing: 6) {
                Button {
                    Task { await store.send(.advanceServe(matchID: game.id)) }
                } label: {
                    Label("Serve", systemImage: "arrow.triangle.2.circlepath")
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.small)
                .disabled(!game.isPlayable || store.isSaving)

                Button("Undo", systemImage: "arrow.uturn.backward") {
                    Task { await store.send(.undo(matchID: game.id)) }
                }
                .buttonStyle(.bordered)
                .controlSize(.small)
                .disabled(game.score.history.isEmpty || store.isSaving)
            }

            if game.isPlayable {
                NavigationLink {
                    WinnerPicker(match: game)
                } label: {
                    Label("Finish match", systemImage: "flag.checkered")
                }
                .buttonStyle(.bordered)
                .controlSize(.small)
            }
        }
        .padding(.horizontal, 8)
        .toolbar(.hidden, for: .navigationBar)
        .task { await store.refresh() }
    }

    private func teamCard(name: String, score: Int, side: String, enabled: Bool) -> some View {
        let tint: Color = side == "a" ? .teal : .purple

        return VStack(spacing: 2) {
            Text(name)
                .font(.caption.weight(.medium))
                .lineLimit(1)
                .minimumScaleFactor(0.65)
                .frame(maxWidth: .infinity)

            HStack(spacing: 10) {
                Button {
                    Task { await store.send(.adjust(matchID: latest.id, side: side, delta: -1)) }
                } label: {
                    Image(systemName: "minus")
                        .font(.headline)
                        .frame(width: 38, height: 38)
                }
                .buttonStyle(.bordered)
                .disabled(!enabled || score == 0 || store.isSaving)

                Text(String(score))
                    .font(.system(size: 30, weight: .bold, design: .rounded))
                    .monospacedDigit()
                    .frame(minWidth: 34)

                Button {
                    Task { await store.send(.adjust(matchID: latest.id, side: side, delta: 1)) }
                } label: {
                    Image(systemName: "plus")
                        .font(.headline)
                        .frame(width: 38, height: 38)
                }
                .buttonStyle(.borderedProminent)
                .tint(tint)
                .disabled(!enabled || store.isSaving)
            }
        }
        .padding(6)
        .background(tint.opacity(0.16), in: RoundedRectangle(cornerRadius: 14))
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
