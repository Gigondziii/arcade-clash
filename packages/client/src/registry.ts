import { GAME_REGISTRY, type GameRegistryItem } from "@fugluck/shared";

export { GAME_REGISTRY, type GameRegistryItem };

export type ClientGameRegistryEntry = GameRegistryItem & {
  title: string;
  plays: number;
  rating: number;
};

export const CLIENT_GAME_REGISTRY: ClientGameRegistryEntry[] = GAME_REGISTRY.map((item) => ({
  ...item,
  title: item.name,
  plays: 0,
  rating: 0,
}));
