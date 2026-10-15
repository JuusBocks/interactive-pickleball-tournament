# Apple Watch scorekeeper

This is the native SwiftUI source for the court-side scorekeeper. It uses the same `/api/bracket` endpoint as the website, so score, server, and completed-match changes are shared instantly.

## Run it today

1. Open Xcode and choose **File → New → Project → watchOS → App**. Name it `PickleballScorekeeper`, choose **SwiftUI** and **Watch App**.
2. Replace the generated app source with every file in `PickleballScorekeeperWatch/`.
3. Select your paired Apple Watch as the run destination and press Run. Xcode will install it directly to your personal Watch.
4. In Xcode, add a **Widget Extension** target. Add `PickleballScoreComplication.swift` to that target, then add the resulting complication to your watch face.

`TournamentStore.swift` already points to the deployed tournament site. If you deploy this repository at a new address, edit only `siteURL` in that file.

## Behavior

- Each team has side-by-side **−** and **+** score controls, so score changes are available without scrolling.
- **Serve** cycles server 1 → server 2 → other team’s server 1.
- **S1 / S2** explicitly corrects the server number.
- **Undo** reverses the last score or serving change.
- **Finish game** records the bracket winner after the score is final.
- The bracket refreshes from the shared site every five seconds while the app is open, so website and Watch edits stay in sync.

For the complication’s live number, the next deployment task is to add an authenticated lightweight “active match” endpoint and a WidgetKit push notification whenever a score changes. The app itself already refreshes from the shared website and is the reliable score-entry surface.
