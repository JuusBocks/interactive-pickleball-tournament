import Foundation
import WidgetKit
import Combine

@MainActor
final class TournamentStore: ObservableObject {
    // Change this only when you deploy to a different domain.
    @Published var siteURL = URL(string: "https://live-pickleball-bracket.work-email-bruh.chatgpt.site")!
    @Published private(set) var bracket: BracketResponse?
    @Published private(set) var errorMessage: String?
    @Published private(set) var isSaving = false

    func refresh() async {
        do {
            let url = siteURL.appending(path: "api/bracket")
            let (data, response) = try await URLSession.shared.data(from: url)
            guard (response as? HTTPURLResponse)?.statusCode == 200 else { throw URLError(.badServerResponse) }
            bracket = try JSONDecoder().decode(BracketResponse.self, from: data)
            WidgetCenter.shared.reloadAllTimelines()
            errorMessage = nil
        } catch {
            errorMessage = "Couldn’t reach the score site. Check your connection."
        }
    }

    func send(_ action: ScoreAction) async {
        isSaving = true
        defer { isSaving = false }
        do {
            let url = siteURL.appending(path: "api/bracket")
            var request = URLRequest(url: url)
            request.httpMethod = "POST"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try JSONEncoder().encode(action)
            let (data, response) = try await URLSession.shared.data(for: request)
            guard (response as? HTTPURLResponse)?.statusCode == 200 else { throw URLError(.badServerResponse) }
            bracket = try JSONDecoder().decode(BracketResponse.self, from: data)
            WidgetCenter.shared.reloadAllTimelines()
            errorMessage = nil
        } catch {
            errorMessage = "That change didn’t save. Try once more."
        }
    }
}
