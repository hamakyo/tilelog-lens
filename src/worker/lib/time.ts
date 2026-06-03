import { DEFAULT_TIMEZONE } from "../../shared/constants";

export function observedAtUtc(
  observedDate: string,
  observedTime: string,
  timezone: string
): string {
  if (timezone !== DEFAULT_TIMEZONE) {
    throw new Error(`Unsupported timezone: ${timezone}`);
  }

  return new Date(`${observedDate}T${observedTime}:00+09:00`).toISOString();
}

export function nowIso(): string {
  return new Date().toISOString();
}
