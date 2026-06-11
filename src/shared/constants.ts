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

export const RANK_LEVELS = [1, 2, 3] as const;

export const RANK_LEVEL_LABELS: Record<(typeof RANK_LEVELS)[number], string> = {
  1: "★☆☆",
  2: "★★☆",
  3: "★★★"
};

export const RANK_POINT_MAX_BY_RANK_AND_LEVEL: Partial<
  Record<(typeof RANK_NAMES)[number], Record<(typeof RANK_LEVELS)[number], number>>
> = {
  初心: {
    1: 20,
    2: 80,
    3: 200
  },
  雀士: {
    1: 600,
    2: 800,
    3: 1000
  },
  雀傑: {
    1: 1200,
    2: 1400,
    3: 2000
  },
  雀豪: {
    1: 2800,
    2: 3200,
    3: 3600
  },
  雀聖: {
    1: 4000,
    2: 6000,
    3: 9000
  }
};

export const PRIVACY_DISCLAIMER =
  "TileLog Lens は雀魂 / Mahjong Soul の非公式な個人用成績記録ツールです。Yostarおよび雀魂とは関係ありません。対局後の個人記録のみを目的としており、リアルタイムの対局支援は行いません。";
