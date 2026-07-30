// The user shape sent to the client — never includes passwordHash.
export type PublicUser = {
  id: string;
  username: string;
  email: string | null;
  avatarUrl: string | null;
  gamesPlayed: number;
  gamesWon: number;
  createdAt: string;
};
