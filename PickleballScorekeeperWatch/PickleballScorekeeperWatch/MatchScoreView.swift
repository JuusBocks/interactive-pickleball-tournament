import SwiftUI

struct MatchScoreView: View {
    @EnvironmentObject private var store: TournamentStore
    let match: Match

    private var latest: Match {
        store.bracket?.view.matches.first(where: { $0.id == match.id }) ?? match
    }

    var body: some View {
        let game = latest

        VStack(spacing: 6) {
            Text(game.score.servingLabel + "  •  Server " + String(game.score.serverNumber))
                .font(.caption2.weight(.semibold))
                .foregroundStyle(.secondary)
                .lineLimit(1)

            teamRow(name: game.playerA?.name ?? "Top team", score: game.score.scoreA, side: "a", enabled: game.isPlayable)
            teamRow(name: game.playerB?.name ?? "Bottom team", score: game.score.scoreB, side: "b", enabled: game.isPlayable)

            HStack(spacing: 8) {
                Button {
                    Task { await store.send(.advanceServe(matchID: game.id)) }
                } label: {
                    Label("Server " + String(game.score.serverNumber), systemImage: "arrow.triangle.2.circlepath")
                        .font(.caption.weight(.semibold))
                        .padding(.horizontal, 10)
                        .frame(height: 36)
                        .background(Color.teal, in: Capsule())
                }
                .buttonStyle(.plain)
                .disabled(!game.isPlayable || store.isSaving)

                Button {
                    Task { await store.send(.undo(matchID: game.id)) }
                } label: {
                    Label("Undo", systemImage: "arrow.uturn.backward")
                        .font(.caption.weight(.semibold))
                        .padding(.horizontal, 10)
                        .frame(height: 36)
                        .background(Color.white.opacity(0.16), in: Capsule())
                }
                .buttonStyle(.plain)
                .disabled(game.score.history.isEmpty || store.isSaving)
            }

            if game.isPlayable {
                NavigationLink {
                    WinnerPicker(match: game)
                } label: {
                    Label("Finish", systemImage: "flag.checkered")
                        .font(.caption.weight(.semibold))
                        .padding(.horizontal, 14)
                        .frame(height: 32)
                        .background(Color.white.opacity(0.12), in: Capsule())
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 8)
        .toolbar(.hidden, for: .navigationBar)
        .task { await store.refresh() }
    }

    private func teamRow(name: String, score: Int, side: String, enabled: Bool) -> some View {
        let tint: Color = side == "a" ? .teal : .purple

        return HStack(spacing: 7) {
            Text(name)
                .font(.caption.weight(.medium))
                .lineLimit(1)
                .minimumScaleFactor(0.6)
                .frame(maxWidth: .infinity, alignment: .leading)

            Button {
                Task { await store.send(.adjust(matchID: latest.id, side: side, delta: -1)) }
            } label: {
                Image(systemName: "minus")
                    .font(.headline)
                    .frame(width: 38, height: 38)
                    .background(Color.white.opacity(0.14), in: Circle())
            }
            .buttonStyle(.plain)
            .disabled(!enabled || score == 0 || store.isSaving)

            Text(String(score))
                .font(.system(size: 28, weight: .bold, design: .rounded))
                .monospacedDigit()
                .frame(minWidth: 28)

            Button {
                Task { await store.send(.adjust(matchID: latest.id, side: side, delta: 1)) }
            } label: {
                Image(systemName: "plus")
                    .font(.headline)
                    .frame(width: 38, height: 38)
                    .background(tint, in: Circle())
            }
            .buttonStyle(.plain)
            .disabled(!enabled || store.isSaving)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 5)
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
