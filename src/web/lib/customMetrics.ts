import {
  defaultCustomMetrics,
  sanitizeCustomMetricDefinitions,
  type CustomMetricDefinition
} from "../../shared/customMetrics";

const customMetricStorageKey = "tilelog-lens:custom-metrics";

export function loadCustomMetrics(): CustomMetricDefinition[] {
  try {
    const stored = window.localStorage.getItem(customMetricStorageKey);
    if (!stored) return defaultCustomMetrics;
    const parsed = JSON.parse(stored) as CustomMetricDefinition[];
    return sanitizeCustomMetricDefinitions(parsed);
  } catch {
    return defaultCustomMetrics;
  }
}

export function saveCustomMetrics(definitions: CustomMetricDefinition[]): void {
  const sanitized = sanitizeCustomMetricDefinitions(definitions);
  try {
    window.localStorage.setItem(customMetricStorageKey, JSON.stringify(sanitized));
  } catch {
    // Storage may be unavailable in restricted browser modes.
  }
}

export function resetCustomMetrics(): CustomMetricDefinition[] {
  saveCustomMetrics(defaultCustomMetrics);
  return defaultCustomMetrics;
}
