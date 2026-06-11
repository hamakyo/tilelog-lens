import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  Download,
  FilePlus2,
  GitCompareArrows,
  LayoutDashboard,
  List,
  Settings,
  ShieldCheck
} from "lucide-react";
import { PRIVACY_DISCLAIMER } from "../shared/constants";
import { DashboardPage } from "./pages/DashboardPage";
import { ExportPage } from "./pages/ExportPage";
import { ImportPage } from "./pages/ImportPage";
import { ComparePage } from "./pages/ComparePage";
import { QualityPage } from "./pages/QualityPage";
import { SettingsPage } from "./pages/SettingsPage";
import { SnapshotEditPage } from "./pages/SnapshotEditPage";
import { SnapshotListPage } from "./pages/SnapshotListPage";

type NavItem = {
  path: string;
  label: string;
  icon: typeof LayoutDashboard;
};

const navItems: NavItem[] = [
  { path: "/", label: "ダッシュボード", icon: LayoutDashboard },
  { path: "/import", label: "インポート", icon: FilePlus2 },
  { path: "/snapshots", label: "記録一覧", icon: List },
  { path: "/compare", label: "比較", icon: GitCompareArrows },
  { path: "/quality", label: "品質", icon: ShieldCheck },
  { path: "/export", label: "エクスポート", icon: Download },
  { path: "/settings", label: "設定", icon: Settings }
];

function getPath(): string {
  return window.location.pathname || "/";
}

export function App() {
  const [path, setPath] = useState(getPath);

  useEffect(() => {
    const handlePopState = () => setPath(getPath());
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const navigate = (nextPath: string) => {
    window.history.pushState(null, "", nextPath);
    setPath(nextPath);
  };

  const content = useMemo(() => {
    if (path === "/") return <DashboardPage navigate={navigate} />;
    if (path === "/import") return <ImportPage />;
    if (path === "/snapshots") return <SnapshotListPage navigate={navigate} />;
    if (path === "/compare") return <ComparePage />;
    if (path === "/quality") return <QualityPage />;
    if (path === "/export") return <ExportPage />;
    if (path === "/settings") return <SettingsPage />;

    const editMatch = path.match(/^\/snapshots\/(\d+)$/);
    if (editMatch) {
      return <SnapshotEditPage id={Number(editMatch[1])} />;
    }

    return <DashboardPage navigate={navigate} />;
  }, [path]);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <BarChart3 size={28} aria-hidden="true" />
          <div>
            <strong>TileLog Lens</strong>
            <span>個人成績トラッカー</span>
          </div>
        </div>
        <nav aria-label="メインナビゲーション">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active =
              item.path === "/"
                ? path === "/"
                : path === item.path || path.startsWith(`${item.path}/`);
            return (
              <a
                key={item.path}
                href={item.path}
                className={active ? "active" : ""}
                onClick={(event) => {
                  event.preventDefault();
                  navigate(item.path);
                }}
              >
                <Icon size={18} aria-hidden="true" />
                <span>{item.label}</span>
              </a>
            );
          })}
        </nav>
      </aside>
      <div className="content-shell">
        {content}
        <footer>{PRIVACY_DISCLAIMER}</footer>
      </div>
    </div>
  );
}
