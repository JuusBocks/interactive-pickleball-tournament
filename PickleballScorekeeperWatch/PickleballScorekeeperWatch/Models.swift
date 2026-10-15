import Foundation

struct BracketResponse: Codable {
    let title: String
    let revision: Int
    let updatedAt: String
    let view: BracketView
}

struct BracketView: Codable {
    let matches: [Match]
    let rounds: [String]
}

struct Team: Codable, Hashable {
    let id: String
    let name: String
}

struct MatchScore: Codable, Hashable {
    let scoreA: Int
    let scoreB: Int
    let servingSide: String
    let serverNumber: Int
    let history: [ScoreSnapshot]

    var servingLabel: String {
        let side = servingSide == "a" ? "top" : "bottom"
        return "Serving: \(side) · Server \(serverNumber)"
    }
}

struct ScoreSnapshot: Codable, Hashable {
    let scoreA: Int
    let scoreB: Int
    let servingSide: String
    let serverNumber: Int
}

struct Match: Codable, Identifiable, Hashable {
    let id: String
    let round: Int
    let roundName: String
    let index: Int
    let playerA: Team?
    let playerB: Team?
    let winner: Team?
    let locked: Bool
    let score: MatchScore

    var isPlayable: Bool { playerA != nil && playerB != nil && winner == nil }
}

enum ScoreAction: Encodable {
    case adjust(matchID: String, side: String, delta: Int)
    case advanceServe(matchID: String)
    case serverNumber(matchID: String, number: Int)
    case undo(matchID: String)
    case setWinner(matchID: String, winnerID: String?)

    enum CodingKeys: String, CodingKey { case type, matchId, side, delta, serverNumber, winnerId }
    enum Kind: String, Encodable { case adjustScore, advanceServe, setServerNumber, undoScoreAction, setWinner }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case let .adjust(matchID, side, delta):
            try container.encode(Kind.adjustScore, forKey: .type)
            try container.encode(matchID, forKey: .matchId)
            try container.encode(side, forKey: .side)
            try container.encode(delta, forKey: .delta)
        case let .advanceServe(matchID):
            try container.encode(Kind.advanceServe, forKey: .type)
            try container.encode(matchID, forKey: .matchId)
        case let .serverNumber(matchID, number):
            try container.encode(Kind.setServerNumber, forKey: .type)
            try container.encode(matchID, forKey: .matchId)
            try container.encode(number, forKey: .serverNumber)
        case let .undo(matchID):
            try container.encode(Kind.undoScoreAction, forKey: .type)
            try container.encode(matchID, forKey: .matchId)
        case let .setWinner(matchID, winnerID):
            try container.encode(Kind.setWinner, forKey: .type)
            try container.encode(matchID, forKey: .matchId)
            try container.encode(winnerID, forKey: .winnerId)
        }
    }
}
