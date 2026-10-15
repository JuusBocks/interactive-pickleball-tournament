import WidgetKit
import SwiftUI
import Foundation

struct ScoreEntry: TimelineEntry { let date: Date; let score: String }

private struct ScoreResponse: Decodable { let view: ScoreView }
private struct ScoreView: Decodable { let matches: [ScoreMatch] }
private struct ScoreMatch: Decodable {
    let playerA: ScoreTeam?
    let playerB: ScoreTeam?
    let winner: ScoreTeam?
    let score: ScoreValue
}
private struct ScoreTeam: Decodable { let name: String }
private struct ScoreValue: Decodable { let scoreA: Int; let scoreB: Int }

struct ScoreProvider: TimelineProvider {
    func placeholder(in context: Context) -> ScoreEntry { ScoreEntry(date: .now, score: "7–5") }
    func getSnapshot(in context: Context, completion: @escaping (ScoreEntry) -> Void) { completion(placeholder(in: context)) }
    func getTimeline(in context: Context, completion: @escaping (Timeline<ScoreEntry>) -> Void) {
        Task {
            let entry: ScoreEntry
            do {
                let url = URL(string: "https://live-pickleball-bracket.work-email-bruh.chatgpt.site/api/bracket")!
                let (data, _) = try await URLSession.shared.data(from: url)
                let response = try JSONDecoder().decode(ScoreResponse.self, from: data)
                if let match = response.view.matches.first(where: { $0.playerA != nil && $0.playerB != nil && $0.winner == nil }) {
                    entry = ScoreEntry(date: .now, score: "\(match.score.scoreA)–\(match.score.scoreB)")
                } else {
                    entry = ScoreEntry(date: .now, score: "Ready")
                }
            } catch {
                entry = ScoreEntry(date: .now, score: "—")
            }
            completion(Timeline(entries: [entry], policy: .after(.now.addingTimeInterval(15 * 60))))
        }
    }
}

struct PickleballScoreComplication: Widget {
    let kind = "PickleballScoreComplication"
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: ScoreProvider()) { entry in
            Text(entry.score).font(.headline.monospacedDigit()).widgetURL(URL(string: "pickleballscorekeeper://active-match"))
        }
        .configurationDisplayName("Pickleball score")
        .description("Open the active match scorekeeper.")
        .supportedFamilies([.accessoryCircular, .accessoryRectangular, .accessoryInline])
    }
}
