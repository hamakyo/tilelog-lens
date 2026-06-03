export const APP_NAME = "TileLog Lens";
export const GAME_NAME = "Mahjong Soul / 雀魂";
export const DEFAULT_TIMEZONE = "Asia/Tokyo";

export const GAME_MODES = ["east", "south", "three_player", "other"] as const;

export const GAME_MODE_LABELS: Record<(typeof GAME_MODES)[number], string> = {
  east: "East",
  south: "South",
  three_player: "Three-player",
  other: "Other"
};

export const PRIVACY_DISCLAIMER =
  "TileLog Lens is an unofficial personal statistics tracker. It is not affiliated with Yostar or Mahjong Soul / 雀魂. It is designed only for post-game personal record keeping and does not provide real-time gameplay assistance.";
