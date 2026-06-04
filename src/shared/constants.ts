export const APP_NAME = "TileLog Lens";
export const GAME_NAME = "Mahjong Soul / 雀魂";
export const DEFAULT_TIMEZONE = "Asia/Tokyo";

export const GAME_MODES = ["east", "south", "three_player", "other"] as const;

export const GAME_MODE_LABELS: Record<(typeof GAME_MODES)[number], string> = {
  east: "東風戦",
  south: "半荘戦",
  three_player: "三人戦",
  other: "その他"
};

export const RANK_NAMES = [
  "初心",
  "雀士",
  "雀傑",
  "雀豪",
  "雀聖",
  "魂天"
] as const;

export const RANK_NAME_LABELS: Record<(typeof RANK_NAMES)[number], string> = {
  "初心": "初心",
  "雀士": "雀士",
  "雀傑": "雀傑",
  "雀豪": "雀豪",
  "雀聖": "雀聖",
  "魂天": "魂天"
};

export const PRIVACY_DISCLAIMER =
  "TileLog Lens は雀魂 / Mahjong Soul の非公式な個人用成績記録ツールです。Yostarおよび雀魂とは関係ありません。対局後の個人記録のみを目的としており、リアルタイムの対局支援は行いません。";
