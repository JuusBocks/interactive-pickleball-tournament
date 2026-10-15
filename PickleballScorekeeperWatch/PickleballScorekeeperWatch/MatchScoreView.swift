import SwiftUI

struct MatchScoreView: View {
    @EnvironmentObject private var store: TournamentStore
    let match: Match

    private var latest: Match {
        store.bracket?.view.matches.first(where: { $0.id == match.id }) ?? match
    }

    var body: some View {
        let game = latest
        let serveColor: Color = game.score.serverNumber == 1 ? .orange : .blue

        VStack(spacing: 6) {
            teamCard(name: game.playerA?.name ?? "Top team", score: game.score.scoreA, side: "a", enabled: game.isPlayable)
            teamCard(name: game.playerB?.name ?? "Bottom team", score: game.score.scoreB, side: "b", enabled: game.isPlayable)

            HStack(spacing: 6) {
                Button {
                    Task { await store.send(.advanceServe(matchID: game.id)) }
                } label: {
                    VStack(spacing: 0) {
                        Text("SERVE")
                            .font(.caption2.weight(.bold))
                        Text(String(game.score.serverNumber))
                            .font(.title3.weight(.bold))
                    }
                    .frame(width: 58, height: 38)
                    .background(serveColor, in: Capsule())
                }
                .buttonStyle(.plain)
                .disabled(!game.isPlayable || store.isSaving)

                Button {
                    Task { await store.send(.undo(matchID: game.id)) }
                } label: {
                    Label("Undo", systemImage: "arrow.uturn.backward")
                        .font(.caption.weight(.bold))
                        .frame(width: 58, height: 38)
                        .background(Color.white.opacity(0.18), in: Capsule())
                }
                .buttonStyle(.plain)
                .disabled(game.score.history.isEmpty || store.isSaving)

                if game.isPlayable {
                    NavigationLink {
                        WinnerPicker(match: game)
                    } label: {
                        Image(systemName: "flag.checkered")
                            .font(.headline)
                            .frame(width: 34, height: 38)
                            .background(Color.white.opacity(0.14), in: Capsule())
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .padding(.horizontal, 8)
        .toolbar(.hidden, for: .navigationBar)
        .task { await store.refresh() }
    }

    private func teamCard(name: String, score: Int, side: String, enabled: Bool) -> some View {
        let tint: Color = side == "a" ? .teal : .purple
        let label = side == "a" ? "TEAM A" : "TEAM B"

        return VStack(spacing: 3) {
            HStack(spacing: 5) {
                Text(label)
                    .font(.caption2.weight(.bold))
                    .foregroundStyle(tint)
                Text(name)
                    .font(.caption.weight(.semibold))
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            HStack(spacing: 12) {
                scoreButton(symbol: "minus", color: .white.opacity(0.16), action: {
                    Task { await store.send(.adjust(matchID: latest.id, side: side, delta: -1)) }
                })
                .disabled(!enabled || score == 0 || store.isSaving)

                Text(String(score))
                    .font(.system(size: 32, weight: .bold, design: .rounded))
                    .monospacedDigit()
                    .frame(minWidth: 34)

                scoreButton(symbol: "plus", color: tint, action: {
                    Task { await store.send(.adjust(matchID: latest.id, side: side, delta: 1)) }
                })
                .disabled(!enabled || store.isSaving)
            }
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background(tint.opacity(0.18), in: RoundedRectangle(cornerRadius: 14))
    }

    private func scoreButton(symbol: String, color: Color, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: symbol)
                .font(.headline)
                .frame(width: 40, height: 40)
                .background(color, in: Circle())
        }
        .buttonStyle(.plain)
    }
}

private struct WinnerPicker: View {
    @EnvironmentObject private var store: TournamentStore
    @Environment(\.dismiss) private var dismiss
    let match: Match

    var body: some View {
        VStack(spacing: 8) {
            Text("Choose winner")
                .font(.headline)

            if let a = match.playerA {
                Button(a.name + " won") {
                    Task {
                        await store.send(.setWinner(matchID: match.id, winnerID: a.id))
                        dismiss()
                    }
                }
                .buttonStyle(.borderedProminent)
            }

            if let b = match.playerB {
                Button(b.name + " won") {
                    Task {
                        await store.send(.setWinner(matchID: match.id, winnerID: b.id))
                        dismiss()
                    }
                }
                .buttonStyle(.borderedProminent)
            }

            Button("Cancel") { dismiss() }
                .buttonStyle(.bordered)
        }
        .padding(.horizontal, 8)
    }
}
