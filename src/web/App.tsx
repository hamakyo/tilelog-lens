import { useEffect, useMemo, useState } from "react";
import BarChart3 from "lucide-react/dist/esm/icons/bar-chart-3.js";
import Download from "lucide-react/dist/esm/icons/download.js";
import FilePlus2 from "lucide-react/dist/esm/icons/file-plus-2.js";
import GitCompareArrows from "lucide-react/dist/esm/icons/git-compare-arrows.js";
import History from "lucide-react/dist/esm/icons/history.js";
import LayoutDashboard from "lucide-react/dist/esm/icons/layout-dashboard.js";
import List from "lucide-react/dist/esm/icons/list.js";
import PanelLeftClose from "lucide-react/dist/esm/icons/panel-left-close.js";
import PanelLeftOpen from "lucide-react/dist/esm/icons/panel-left-open.js";
import Settings from "lucide-react/dist/esm/icons/settings.js";
import ShieldCheck from "lucide-react/dist/esm/icons/shield-check.js";
import Server from "lucide-react/dist/esm/icons/server.js";
import { PRIVACY_DISCLAIMER } from "../shared/constants";
import { AnalysisPage } from "./pages/AnalysisPage";
import { DashboardPage } from "./pages/DashboardPage";
import { ExportPage } from "./pages/ExportPage";
import { ImportPage } from "./pages/ImportPage";
import { ImportHistoryPage } from "./pages/ImportHistoryPage";
import { ComparePage } from "./pages/ComparePage";
import { QualityPage } from "./pages/QualityPage";
import { SettingsPage } from "./pages/SettingsPage";
import { SnapshotEditPage } from "./pages/SnapshotEditPage";
import { SnapshotListPage } from "./pages/SnapshotListPage";
import { SystemPage } from "./pages/SystemPage";
import {
  applyThemePreference,
  loadThemePreference,
  saveThemePreference,
  type ThemePreference
} from "./lib/theme";

type NavItem = {
  path: string;
  label: string;
  icon: typeof LayoutDashboard;
};

const navItems: NavItem[] = [
  { path: "/", label: "ダッシュボード", icon: LayoutDashboard },
  { path: "/analysis", label: "詳細分析", icon: BarChart3 },
  { path: "/import", label: "インポート", icon: FilePlus2 },
  { path: "/import-history", label: "取込履歴", icon: History },
  { path: "/snapshots", label: "記録一覧", icon: List },
  { path: "/compare", label: "比較", icon: GitCompareArrows },
  { path: "/quality", label: "品質", icon: ShieldCheck },
  { path: "/export", label: "エクスポート", icon: Download },
  { path: "/system", label: "状態", icon: Server },
  { path: "/settings", label: "設定", icon: Settings }
];

const sidebarCollapsedStorageKey = "tilelog-lens:sidebar-collapsed";

function getPath(): string {
  return window.location.pathname || "/";
}

function loadSidebarCollapsed(): boolean {
  try {
    return window.localStorage.getItem(sidebarCollapsedStorageKey) === "true";
  } catch {
    return false;
  }
}

function saveSidebarCollapsed(collapsed: boolean): void {
  try {
    window.localStorage.setItem(sidebarCollapsedStorageKey, String(collapsed));
  } catch {
    // localStorage can be unavailable in hardened browser settings.
  }
}

export function App() {
  const [path, setPath] = useState(getPath);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(loadSidebarCollapsed);
  const [themePreference, setThemePreference] = useState<ThemePreference>(() =>
    loadThemePreference()
  );

  useEffect(() => {
    const handlePopState = () => setPath(getPath());
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    applyThemePreference(themePreference);
    if (themePreference !== "system" || !window.matchMedia) return undefined;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => applyThemePreference(themePreference);
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [themePreference]);

  const navigate = (nextPath: string) => {
    window.history.pushState(null, "", nextPath);
    setPath(nextPath);
  };

  const updateThemePreference = (preference: ThemePreference) => {
    saveThemePreference(preference);
    setThemePreference(preference);
  };

  const toggleSidebar = () => {
    setSidebarCollapsed((current) => {
      const next = !current;
      saveSidebarCollapsed(next);
      return next;
    });
  };

  const content = useMemo(() => {
    if (path === "/") return <DashboardPage navigate={navigate} />;
    if (path === "/analysis") return <AnalysisPage navigate={navigate} />;
    if (path === "/import") return <ImportPage />;
    if (path === "/import-history") return <ImportHistoryPage />;
    if (path === "/snapshots") return <SnapshotListPage navigate={navigate} />;
    if (path === "/compare") return <ComparePage />;
    if (path === "/quality") return <QualityPage navigate={navigate} />;
    if (path === "/export") return <ExportPage />;
    if (path === "/system") return <SystemPage />;
    if (path === "/settings") {
      return (
        <SettingsPage
          themePreference={themePreference}
          onThemePreferenceChange={updateThemePreference}
        />
      );
    }

    const editMatch = path.match(/^\/snapshots\/(\d+)$/);
    if (editMatch) {
      return <SnapshotEditPage id={Number(editMatch[1])} />;
    }

    return <DashboardPage navigate={navigate} />;
  }, [path, themePreference]);

  return (
    <div className={`app-shell${sidebarCollapsed ? " sidebar-collapsed" : ""}`}>
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="brand-block">
            <BarChart3 size={28} aria-hidden="true" />
            <div>
              <strong>TileLog Lens</strong>
              <span>個人成績トラッカー</span>
            </div>
          </div>
          <button
            type="button"
            className="sidebar-toggle"
            aria-label={sidebarCollapsed ? "メニューを開く" : "メニューを閉じる"}
            title={sidebarCollapsed ? "メニューを開く" : "メニューを閉じる"}
            onClick={toggleSidebar}
          >
            {sidebarCollapsed ? (
              <PanelLeftOpen size={18} aria-hidden="true" />
            ) : (
              <PanelLeftClose size={18} aria-hidden="true" />
            )}
          </button>
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
                aria-label={item.label}
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
