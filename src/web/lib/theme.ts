export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

const themeStorageKey = "tilelog-lens:theme";

function isThemePreference(value: string | null): value is ThemePreference {
  return value === "light" || value === "dark" || value === "system";
}

export function loadThemePreference(): ThemePreference {
  const stored = readStoredThemePreference();
  return isThemePreference(stored) ? stored : "system";
}

export function saveThemePreference(preference: ThemePreference): void {
  try {
    window.localStorage.setItem(themeStorageKey, preference);
  } catch {
    // Storage may be unavailable in restricted browser modes.
  }
}

export function resolveThemePreference(preference: ThemePreference): ResolvedTheme {
  if (preference !== "system") return preference;
  if (!window.matchMedia) return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyThemePreference(preference: ThemePreference): ResolvedTheme {
  const resolvedTheme = resolveThemePreference(preference);
  document.documentElement.dataset.theme = resolvedTheme;
  document.documentElement.dataset.themePreference = preference;
  return resolvedTheme;
}

function readStoredThemePreference(): string | null {
  try {
    return window.localStorage.getItem(themeStorageKey);
  } catch {
    return null;
  }
}
