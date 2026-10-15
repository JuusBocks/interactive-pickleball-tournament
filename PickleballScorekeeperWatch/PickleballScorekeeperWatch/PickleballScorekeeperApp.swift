import SwiftUI

@main
struct PickleballScorekeeperApp: App {
    @StateObject private var store = TournamentStore()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(store)
        }
    }
}
