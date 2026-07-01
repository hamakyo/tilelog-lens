export type SidebarPreference = "expanded" | "collapsed" | "auto";

const sidebarPreferenceStorageKey = "tilelog-lens:sidebar-preference";
const sidebarCollapsedStorageKey = "tilelog-lens:sidebar-collapsed";

function isSidebarPreference(value: string | null): value is SidebarPreference {
  return value === "expanded" || value === "collapsed" || value === "auto";
}

export function loadSidebarPreference(): SidebarPreference {
  const stored = readStoredValue(sidebarPreferenceStorageKey);
  return isSidebarPreference(stored) ? stored : "auto";
}

export function saveSidebarPreference(preference: SidebarPreference): void {
  writeStoredValue(sidebarPreferenceStorageKey, preference);
}

export function loadSidebarCollapsed(): boolean {
  return readStoredValue(sidebarCollapsedStorageKey) === "true";
}

export function saveSidebarCollapsed(collapsed: boolean): void {
  writeStoredValue(sidebarCollapsedStorageKey, String(collapsed));
}

export function resolveSidebarCollapsed(
  preference: SidebarPreference,
  autoCollapsed: boolean
): boolean {
  if (preference === "expanded") return false;
  if (preference === "collapsed") return true;
  return autoCollapsed;
}

function readStoredValue(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStoredValue(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage may be unavailable in restricted browser modes.
  }
}
