import { GAME_MODE_LABELS } from "../../../../shared/constants";
import type { GameMode, PeriodAnalysis } from "../../../../shared/types";
import { formatDecimal, formatRate } from "../../../lib/format";

export function PeriodAnalysisCards({
  periods,
  gameMode
}: {
  periods: PeriodAnalysis[];
  gameMode: GameMode | null;
}) {
  return (
    <section className="analysis-section">
      <div className="section-heading">
        <h2>直近期間</h2>
        <p>{gameMode ? GAME_MODE_LABELS[gameMode] : "すべて"}</p>
      </div>
      <div className="period-grid">
        {periods.length === 0 ? (
          <p className="empty-state">適切な基準記録なし</p>
        ) : (
          periods.map((period) => (
            <div className="period-tile" key={period.label}>
              <div className="period-tile-header">
                <strong>{period.label}</strong>
                <span>{period.actual_matches > 0 ? `${period.actual_matches}戦` : "-"}</span>
              </div>
              <dl className="period-metrics">
                <div><dt>平均順位</dt><dd>{formatDecimal(period.period_avg_place)}</dd></div>
                <div><dt>和了率</dt><dd>{formatRate(period.period_win_rate)}</dd></div>
                <div><dt>放銃率</dt><dd>{formatRate(period.period_deal_in_rate)}</dd></div>
                <div><dt>攻守差</dt><dd>{formatDecimal(period.attack_defense_gap)}</dd></div>
              </dl>
              <span className={`quality-pill quality-${period.quality}`}>
                {period.quality === "ok" ? "良好" : "概算"}
              </span>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
