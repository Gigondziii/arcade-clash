// Wire protocol for the matchmaking queue, shared between client and server so
// both sides agree on event names/payload shapes at compile time. Scope: for-fun
// matches only — async-independent rounds (each player plays their own instance
// off a shared server-issued seed; no in-match real-time sync). See PROGRESS.md
// for why async was chosen and what it does/doesn't foreclose for a future
// live-synchronized mode (e.g. Arena Shooter).
import type { InputLogEntry } from "./gameModule";

// username is deliberately absent — the server derives it from the
// authenticated session (see packages/server/src/matchmaking/socketAuth.ts),
// never trusts a client-supplied display name.
export type JoinQueuePayload = {
  gameId: string;
};

export type MatchedPayload = {
  matchId: string;
  gameId: string;
  // Server-generated (crypto.randomInt), never client-proposed — this is the
  // whole point of moving seed generation server-side for match mode.
  seed: number;
  opponentUsername: string;
};

export type SubmitScorePayload = {
  matchId: string;
  score: number;
  reason: string;
  durationMs: number;
  // seed is deliberately absent — the server already has the authoritative
  // seed for this match (issued at createMatch), so replay never trusts a
  // client-supplied one.
  inputLog: InputLogEntry[];
  viewport: { width: number; height: number };
};

// "valid"/"invalid" come from server-side replay (see
// packages/server/src/validation/scoreValidator.ts). "unverifiable" is kept
// in the type for a future non-tick-based game whose input genuinely can't
// be replayed — no current game's adapter can produce it: match mode only
// accepts discretely-loggable input (Sky Dodge's analog drag is disabled in
// match mode specifically so this holds), so an unreplayable match run is
// treated as invalid, not exempted. See PROGRESS.md Known Gaps.
export type ScoreVerdict = "valid" | "invalid" | "unverifiable";

// Explicit status union, not a `forfeited: boolean` + sentinel score value —
// deliberate choice (session decision, not a default): this type's shape is
// what escrow will eventually settle payouts on and what a dispute log will
// read back, so "never played because the opponent left" has to be a real,
// distinct state from "scored zero" or "forfeited by timeout," not something
// encoded into a free-form `reason` string alongside a fake `score: 0`. Three
// states:
//  - "completed": a real score was submitted and replayed (verdict: valid or
//    invalid — see ScoreVerdict below; even an invalid score is still a
//    completed submission, just a rejected one).
//  - "forfeited": never submitted anything, by choice or timeout (idle,
//    tabbed away, deliberately withholding, or the FORFEIT_GRACE_MS window
//    expired). See PROGRESS.md's forfeit-timeout section for why this is a
//    loss for them (the submitter wins) rather than voiding the match.
//  - "opponent_disconnected": this player's own run was still in progress —
//    never submitted, never had the chance to — when their opponent left.
//    Not their fault, not a forfeit; the match resolved because of the OTHER
//    side's action, not this side's inaction. See packages/server/src/
//    matchmaking/matches.ts's handleDisconnect and PROGRESS.md's session log.
export type PlayerResult =
  | { username: string; score: number; reason: string; status: "completed"; verdict: ScoreVerdict }
  | { username: string; score: null; reason: null; status: "forfeited" }
  | { username: string; score: null; reason: null; status: "opponent_disconnected" };

// Outcome is already relative to the recipient (mirrors you/opponent, which
// emitResolved already personalizes per socket) — "win"/"loss" from the
// recipient's own perspective, so the client never has to compare scores
// itself. "void" is exactly-one-of-{both invalid}; see matchOutcome.ts.
export type MatchOutcome = "win" | "loss" | "draw" | "void";

export type MatchResolvedPayload = {
  matchId: string;
  outcome: MatchOutcome;
  you: PlayerResult;
  opponent: PlayerResult;
};

// Evidence-only — logged server-side, never affects a verdict or outcome.
// Sent by the client whenever document.visibilitychange fires hidden, for as
// long as MatchLoader is mounted (queued through resolved/ended), not just
// during active play — see PROGRESS.md's freeze-frame Known Gaps entry for
// why this is one signal among a client-side-only set, not a real defense on
// its own (a modified client can simply never emit it).
export type VisibilityHiddenPayload = {
  matchId: string;
};

export type QueueErrorPayload = {
  message: string;
};

// Direct friend invite — private match using the same async seeded flow as
// random queue pairing. Invite state is in-memory only (same as the queue).
export type InviteFriendPayload = {
  friendUserId: string;
  gameId: string;
};

export type RespondInvitePayload = {
  inviteId: string;
  accept: boolean;
};

export type InviteReceivedPayload = {
  inviteId: string;
  fromUserId: string;
  fromUsername: string;
  gameId: string;
};

export type InviteRejectedPayload = {
  inviteId: string;
  reason: string;
};

export type InviteErrorPayload = {
  message: string;
};

export interface ClientToServerEvents {
  joinQueue: (payload: JoinQueuePayload) => void;
  submitScore: (payload: SubmitScorePayload) => void;
  visibilityHidden: (payload: VisibilityHiddenPayload) => void;
  inviteFriend: (payload: InviteFriendPayload) => void;
  respondInvite: (payload: RespondInvitePayload) => void;
  // Cancel a pending invite you sent (or leave the "waiting for accept" screen).
  cancelInvite: (payload: { inviteId: string }) => void;
}

export interface ServerToClientEvents {
  matched: (payload: MatchedPayload) => void;
  matchResolved: (payload: MatchResolvedPayload) => void;
  queueError: (payload: QueueErrorPayload) => void;
  inviteReceived: (payload: InviteReceivedPayload) => void;
  inviteRejected: (payload: InviteRejectedPayload) => void;
  inviteError: (payload: InviteErrorPayload) => void;
  // Echoed to the inviter so the waiting UI knows which inviteId to cancel.
  inviteSent: (payload: { inviteId: string; gameId: string; toUsername: string }) => void;
}
