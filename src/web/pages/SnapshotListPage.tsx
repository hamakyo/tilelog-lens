import { useEffect, useState } from "react";
import Download from "lucide-react/dist/esm/icons/download.js";
import Edit from "lucide-react/dist/esm/icons/edit.js";
import Trash2 from "lucide-react/dist/esm/icons/trash-2.js";
import ChevronLeft from "lucide-react/dist/esm/icons/chevron-left.js";
import ChevronRight from "lucide-react/dist/esm/icons/chevron-right.js";
import { GAME_MODE_LABELS } from "../../shared/constants";
import type { Snapshot } from "../../shared/types";
import { deleteSnapshot, listSnapshotPage } from "../lib/api";
import { formatDecimal, formatRate } from "../lib/format";

type SnapshotListPageProps = {
  navigate: (path: string) => void;
};

export function SnapshotListPage({ navigate }: SnapshotListPageProps) {
  const pageSize = 50;
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    try {
      const result = await listSnapshotPage({
        limit: pageSize,
        offset: page * pageSize,
        order: "desc"
      });
      setSnapshots(result.items);
      setTotal(result.pagination.total);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "読み込みに失敗しました。");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, [page]);

  async function handleDelete(snapshot: Snapshot) {
    if (!window.confirm(`${snapshot.observed_date} ${snapshot.observed_time} の記録を削除しますか?`)) {
      return;
    }

    try {
      await deleteSnapshot(snapshot.id);
      if (snapshots.length === 1 && page > 0) setPage((current) => current - 1);
      else await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "削除に失敗しました。");
    }
  }

  return (
    <main className="page-stack">
      <div className="page-header">
        <div>
          <p className="eyebrow">記録一覧</p>
          <h1>保存した記録</h1>
        </div>
        <a
          className="secondary-button"
          href="/api/export/snapshots.csv"
          download="tilelog-snapshots.csv"
        >
          <Download size={18} aria-hidden="true" />
          <span>CSV</span>
        </a>
      </div>

      {error ? <p className="error-banner">{error}</p> : null}
      {loading ? <p className="empty-state">記録を読み込んでいます...</p> : null}

      <section className="table-section">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>観測日時</th>
                <th>モード</th>
                <th>段位</th>
                <th>ポイント</th>
                <th>対戦数</th>
                <th>平均</th>
                <th>一位</th>
                <th>二位</th>
                <th>三位</th>
                <th>四位</th>
                <th>和了</th>
                <th>放銃</th>
                <th>副露</th>
                <th>立直</th>
                <th>メモ</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {snapshots.length === 0 ? (
                <tr>
                  <td colSpan={16}>まだ記録はありません。</td>
                </tr>
              ) : (
                snapshots.map((snapshot) => (
                  <tr key={snapshot.id}>
                    <td>{`${snapshot.observed_date} ${snapshot.observed_time}`}</td>
                    <td>{GAME_MODE_LABELS[snapshot.game_mode]}</td>
                    <td>{snapshot.rank_name ?? "-"}</td>
                    <td>
                      {snapshot.rank_points == null
                        ? "-"
                        : `${snapshot.rank_points}/${snapshot.rank_points_max ?? "-"}`}
                    </td>
                    <td>{snapshot.matches}</td>
                    <td>{formatDecimal(snapshot.avg_place)}</td>
                    <td>{formatRate(snapshot.first_rate)}</td>
                    <td>{formatRate(snapshot.second_rate)}</td>
                    <td>{formatRate(snapshot.third_rate)}</td>
                    <td>{formatRate(snapshot.fourth_rate)}</td>
                    <td>{formatRate(snapshot.win_rate)}</td>
                    <td>{formatRate(snapshot.deal_in_rate)}</td>
                    <td>{formatRate(snapshot.call_rate)}</td>
                    <td>{formatRate(snapshot.riichi_rate)}</td>
                    <td>{snapshot.note ? "あり" : "-"}</td>
                    <td>
                      <div className="row-actions">
                        <button
                          type="button"
                          className="icon-button"
                          aria-label="記録を編集"
                          title="記録を編集"
                          onClick={() => navigate(`/snapshots/${snapshot.id}`)}
                        >
                          <Edit size={16} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          className="icon-button danger"
                          aria-label="記録を削除"
                          title="記録を削除"
                          onClick={() => void handleDelete(snapshot)}
                        >
                          <Trash2 size={16} aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="action-row" aria-label="記録一覧のページ操作">
          <button
            type="button"
            className="icon-button"
            aria-label="前のページ"
            title="前のページ"
            disabled={page === 0}
            onClick={() => setPage((current) => Math.max(0, current - 1))}
          >
            <ChevronLeft size={18} aria-hidden="true" />
          </button>
          <span>{total === 0 ? "0件" : `${page * pageSize + 1}-${Math.min((page + 1) * pageSize, total)} / ${total}件`}</span>
          <button
            type="button"
            className="icon-button"
            aria-label="次のページ"
            title="次のページ"
            disabled={(page + 1) * pageSize >= total}
            onClick={() => setPage((current) => current + 1)}
          >
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        </div>
      </section>
    </main>
  );
}
