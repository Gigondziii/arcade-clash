export type FriendshipStatus = "pending" | "accepted" | "rejected";

export type FriendEntry = {
  friendshipId: string;
  userId: string;
  username: string;
  // Relative to the requesting user: "incoming" = they asked you,
  // "outgoing" = you asked them, "friend" = accepted either direction.
  direction: "incoming" | "outgoing" | "friend";
  status: FriendshipStatus;
  createdAt: string;
};
