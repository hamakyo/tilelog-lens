import Download from "lucide-react/dist/esm/icons/download.js";
import { GAME_MODE_LABELS } from "../../../../shared/constants";
import type { AnalysisConclusion } from "../../../../shared/analysisConclusion";
import type { EstimatedDelta, GameMode } from "../../../../shared/types";

export function AnalysisConclusionPanel({
  conclusion,
  selectedMode,
  snapshotCount,
  latestDelta,
  aiExportPath,
  onShowEvidence,
  onShowSnapshots
}: {
  conclusion: AnalysisConclusion;
  selectedMode: GameMode | null;
  snapshotCount: number;
  latestDelta: EstimatedDelta | undefined;
  aiExportPath: string;
  onShowEvidence: () => void;
  onShowSnapshots: () => void;
}) {
  return (
    <section
      className={`analysis-conclusion conclusion-${conclusion.status}`}
      aria-labelledby="analysis-conclusion-title"
    >
      <div className="analysis-conclusion-main">
        <p className="eyebrow">今回の結論</p>
        <h2 id="analysis-conclusion-title">{conclusion.title}</h2>
        <p>{conclusion.summary}</p>
      </div>
      <div className="analysis-scope-row" aria-label="分析対象">
        <span className="code-pill">
          {selectedMode ? GAME_MODE_LABELS[selectedMode] : "モード未選択"}
        </span>
        <span className="code-pill pill-muted">{snapshotCount}件</span>
        {latestDelta ? (
          <span
            className={`quality-pill ${
              latestDelta.quality === "ok" ? "quality-ok" : "quality-limited_data"
            }`}
          >
            推定 {latestDelta.matches_delta}戦
          </span>
        ) : null}
      </div>
      {conclusion.evidence.length > 0 ? (
        <ul className="analysis-evidence-list">
          {conclusion.evidence.map((evidence) => <li key={evidence}>{evidence}</li>)}
        </ul>
      ) : null}
      <div className="action-row analysis-conclusion-actions">
        <button type="button" className="primary-button" onClick={onShowEvidence}>
          根拠を見る
        </button>
        <button type="button" className="secondary-button" onClick={onShowSnapshots}>
          関連記録を見る
        </button>
        <a className="secondary-button" href={aiExportPath} download="tilelog-ai-context.json">
          <Download size={18} aria-hidden="true" />
          <span>現在の条件でAI JSON</span>
        </a>
      </div>
    </section>
  );
}
