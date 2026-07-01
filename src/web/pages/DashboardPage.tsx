import { useEffect, useMemo, useState } from "react";
import Activity from "lucide-react/dist/esm/icons/activity.js";
import BarChart3 from "lucide-react/dist/esm/icons/bar-chart-3.js";
import Flag from "lucide-react/dist/esm/icons/flag.js";
import Gauge from "lucide-react/dist/esm/icons/gauge.js";
import ShieldAlert from "lucide-react/dist/esm/icons/shield-alert.js";
import type { EstimatedDelta, Snapshot } from "../../shared/types";
import {
  GAME_MODE_LABELS,
  GAME_MODES,
  RANK_LEVEL_LABELS,
  RANK_LEVELS,
  RANK_NAME_LABELS,
  RANK_POINT_MAX_BY_RANK_AND_LEVEL
} from "../../shared/constants";
import { buildEstimatedDeltas, buildRankPointAnalysis } from "../../shared/metrics";
import { listDeltas, listSnapshots } from "../lib/api";
import {
  loadDashboardCardPreferences,
  type DashboardCardId
} from "../lib/dashboardCards";
import { formatDecimal, formatNumber, formatRate } from "../lib/format";
import { RankRatePieChart } from "../components/RankRatePieChart";
import { TrendChart } from "../components/TrendChart";

type DashboardPageProps = {
  navigate: (path: string) => void;
};

type ChartPoint = {
  label: string;
  avg_place: number;
  win_rate: number;
  deal_in_rate: number;
  rank_point_progress: number | null;
};

type DashboardCardView = {
  id: DashboardCardId;
  icon: typeof Gauge;
  label: string;
  value: string;
};

function rankPointMaxForSnapshot(snapshot: Snapshot): number | null {
  if (snapshot.rank_points_max != null) return snapshot.rank_points_max;
  const level = snapshot.rank_level;
  if (snapshot.rank_name == null || level == null) return null;
  if (!RANK_LEVELS.includes(level as (typeof RANK_LEVELS)[number])) return null;

  return (
    RANK_POINT_MAX_BY_RANK_AND_LEVEL[
      snapshot.rank_name as keyof typeof RANK_POINT_MAX_BY_RANK_AND_LEVEL
    ]?.[level as (typeof RANK_LEVELS)[number]] ?? null
  );
}

function rankLabel(snapshot: Snapshot | undefined): string {
  if (!snapshot?.rank_name) return "-";
  const level = snapshot.rank_level;
  const levelLabel =
    level != null && RANK_LEVELS.includes(level as (typeof RANK_LEVELS)[number])
      ? ` ${RANK_LEVEL_LABELS[level as (typeof RANK_LEVELS)[number]]}`
      : "";

  return `${RANK_NAME_LABELS[snapshot.rank_name as keyof typeof RANK_NAME_LABELS] ?? snapshot.rank_name}${levelLabel}`;
}

function toChartPoints(snapshots: Snapshot[]): ChartPoint[] {
  return [...snapshots]
    .sort((a, b) => a.observed_at_utc.localeCompare(b.observed_at_utc))
    .map((snapshot) => {
      const rankPointsMax = rankPointMaxForSnapshot(snapshot);

      return {
        label: `${snapshot.observed_date} ${snapshot.observed_time}`,
        avg_place: snapshot.avg_place,
        win_rate: snapshot.win_rate,
        deal_in_rate: snapshot.deal_in_rate,
        rank_point_progress:
          snapshot.rank_points != null && rankPointsMax != null
            ? Number(((snapshot.rank_points / rankPointsMax) * 100).toFixed(2))
            : null
      };
    });
}

export function DashboardPage({ navigate }: DashboardPageProps) {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [deltas, setDeltas] = useState<EstimatedDelta[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMode, setSelectedMode] = useState<Snapshot["game_mode"] | "all">("all");
  const [cardPreferences] = useState(() => loadDashboardCardPreferences());

  useEffect(() => {
    Promise.all([listSnapshots(), listDeltas()])
      .then(([snapshotResult, deltaResult]) => {
        setSnapshots(snapshotResult.items);
        setDeltas(deltaResult.items);
      })
      .catch((caught) =>
        setError(caught instanceof Error ? caught.message : "読み込みに失敗しました。")
      )
      .finally(() => setLoading(false));
  }, []);

  const availableModes = useMemo(
    () => GAME_MODES.filter((mode) => snapshots.some((snapshot) => snapshot.game_mode === mode)),
    [snapshots]
  );
  const displaySnapshots = useMemo(
    () =>
      selectedMode === "all"
        ? snapshots
        : snapshots.filter((snapshot) => snapshot.game_mode === selectedMode),
    [selectedMode, snapshots]
  );
  const latest = displaySnapshots[0];
  const latestMode = latest?.game_mode ?? (selectedMode === "all" ? null : selectedMode);
  const modeSnapshots = useMemo(
    () =>
      latestMode
        ? displaySnapshots.filter((snapshot) => snapshot.game_mode === latestMode)
        : displaySnapshots,
    [displaySnapshots, latestMode]
  );
  const chartData = useMemo(() => toChartPoints(displaySnapshots), [displaySnapshots]);
  const rankPointAnalysis = useMemo(
    () => buildRankPointAnalysis(modeSnapshots),
    [modeSnapshots]
  );
  const displayDeltas = useMemo(
    () => (selectedMode === "all" ? deltas : buildEstimatedDeltas(displaySnapshots)),
    [deltas, displaySnapshots, selectedMode]
  );
  const latestDelta = displayDeltas.at(-1);
  const dashboardCards = useMemo<DashboardCardView[]>(() => {
    const cardMap: Record<DashboardCardId, DashboardCardView> = {
      avg_place: {
        id: "avg_place",
        icon: Gauge,
        label: "最新の平均順位",
        value: latest ? formatDecimal(latest.avg_place) : "-"
      },
      win_deal_rate: {
        id: "win_deal_rate",
        icon: Activity,
        label: "最新の和了率 / 放銃率",
        value: latest
          ? `${formatRate(latest.win_rate)} / ${formatRate(latest.deal_in_rate)}`
          : "-"
      },
      matches_delta: {
        id: "matches_delta",
        icon: ShieldAlert,
        label: "最新の対戦数差分",
        value: latestDelta ? formatNumber(latestDelta.matches_delta) : "-"
      },
      rank_points: {
        id: "rank_points",
        icon: Flag,
        label: "段位 / 昇格まで",
        value:
          rankPointAnalysis?.remaining_points == null
            ? rankLabel(latest)
            : `${rankLabel(latest)} / ${formatNumber(rankPointAnalysis.remaining_points)}pt`
      },
      fourth_rate: {
        id: "fourth_rate",
        icon: ShieldAlert,
        label: "最新のラス率",
        value: latest ? formatRate(latest.fourth_rate) : "-"
      },
      riichi_rate: {
        id: "riichi_rate",
        icon: BarChart3,
        label: "最新の立直率",
        value: latest ? formatRate(latest.riichi_rate) : "-"
      }
    };

    return cardPreferences
      .filter((preference) => preference.enabled)
      .map((preference) => cardMap[preference.id])
      .filter((card): card is DashboardCardView => card != null);
  }, [cardPreferences, latest, latestDelta, rankPointAnalysis]);

  return (
    <main className="page-stack">
      <div className="page-header">
        <div>
          <p className="eyebrow">ダッシュボード</p>
          <h1>TileLog Lens</h1>
        </div>
        <div className="action-row">
          <button className="secondary-button" type="button" onClick={() => navigate("/analysis")}>
            <BarChart3 size={18} aria-hidden="true" />
            <span>詳細分析</span>
          </button>
          <button className="primary-button" type="button" onClick={() => navigate("/import")}>
            <Activity size={18} aria-hidden="true" />
            <span>新規記録</span>
          </button>
        </div>
      </div>

      {error ? <p className="error-banner">{error}</p> : null}
      {loading ? <p className="empty-state">成績を読み込んでいます...</p> : null}

      <section className="filter-bar" aria-label="ゲームモード切替">
        <button
          type="button"
          className={selectedMode === "all" ? "active" : ""}
          onClick={() => setSelectedMode("all")}
        >
          すべて
        </button>
        {availableModes.map((mode) => (
          <button
            key={mode}
            type="button"
            className={selectedMode === mode ? "active" : ""}
            onClick={() => setSelectedMode(mode)}
          >
            {GAME_MODE_LABELS[mode]}
          </button>
        ))}
      </section>

      <section className="summary-grid">
        {dashboardCards.map((card) => {
          const Icon = card.icon;
          return (
            <div className="summary-tile" key={card.id}>
              <Icon size={20} aria-hidden="true" />
              <span>{card.label}</span>
              <strong>{card.value}</strong>
            </div>
          );
        })}
      </section>

      <section className="analysis-section dashboard-focus">
        <div className="section-heading inline-heading">
          <div>
            <h2>主要トレンド</h2>
            <p>詳しい分析は専用ページに分離しています。</p>
          </div>
          <button className="secondary-button" type="button" onClick={() => navigate("/analysis")}>
            詳細分析を開く
          </button>
        </div>
        <div className="chart-grid dashboard-chart-grid">
          <TrendChart
            title="平均順位"
            data={chartData}
            lines={[{ dataKey: "avg_place", label: "平均順位", color: "#1f6f8b" }]}
          />
          <TrendChart
            title="和了率と放銃率"
            data={chartData}
            lines={[
              { dataKey: "win_rate", label: "和了率", color: "#117a65" },
              { dataKey: "deal_in_rate", label: "放銃率", color: "#b23b3b" }
            ]}
          />
          <TrendChart
            title="段位ポイント進捗"
            data={chartData.filter((point) => point.rank_point_progress != null)}
            lines={[
              { dataKey: "rank_point_progress", label: "進捗率", color: "#3d5a80" }
            ]}
          />
          <RankRatePieChart title="最新順位率" rates={latest} />
        </div>
      </section>
    </main>
  );
}
