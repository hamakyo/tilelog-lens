import { useEffect, useState } from "react";
import { Download, Edit, Trash2 } from "lucide-react";
import type { Snapshot } from "../../shared/types";
import { deleteSnapshot, listSnapshots } from "../lib/api";
import { formatDecimal, formatRate } from "../lib/format";

type SnapshotListPageProps = {
  navigate: (path: string) => void;
};

export function SnapshotListPage({ navigate }: SnapshotListPageProps) {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    try {
      const result = await listSnapshots();
      setSnapshots(result.items);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Load failed.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function handleDelete(snapshot: Snapshot) {
    if (!window.confirm(`Delete snapshot ${snapshot.observed_date} ${snapshot.observed_time}?`)) {
      return;
    }

    try {
      await deleteSnapshot(snapshot.id);
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Delete failed.");
    }
  }

  return (
    <main className="page-stack">
      <div className="page-header">
        <div>
          <p className="eyebrow">Snapshots</p>
          <h1>Snapshot List</h1>
        </div>
        <a className="secondary-button" href="/api/export/snapshots.csv">
          <Download size={18} aria-hidden="true" />
          <span>CSV</span>
        </a>
      </div>

      {error ? <p className="error-banner">{error}</p> : null}
      {loading ? <p className="empty-state">Loading snapshots...</p> : null}

      <section className="table-section">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Observed</th>
                <th>Mode</th>
                <th>Rank</th>
                <th>Points</th>
                <th>Matches</th>
                <th>Avg</th>
                <th>1st</th>
                <th>2nd</th>
                <th>3rd</th>
                <th>4th</th>
                <th>Win</th>
                <th>Deal-in</th>
                <th>Call</th>
                <th>Riichi</th>
                <th>Note</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {snapshots.length === 0 ? (
                <tr>
                  <td colSpan={16}>No snapshots yet.</td>
                </tr>
              ) : (
                snapshots.map((snapshot) => (
                  <tr key={snapshot.id}>
                    <td>{`${snapshot.observed_date} ${snapshot.observed_time}`}</td>
                    <td>{snapshot.game_mode}</td>
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
                    <td>{snapshot.note ? "Yes" : "-"}</td>
                    <td>
                      <div className="row-actions">
                        <button
                          type="button"
                          className="icon-button"
                          aria-label="Edit snapshot"
                          title="Edit snapshot"
                          onClick={() => navigate(`/snapshots/${snapshot.id}`)}
                        >
                          <Edit size={16} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          className="icon-button danger"
                          aria-label="Delete snapshot"
                          title="Delete snapshot"
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
      </section>
    </main>
  );
}
