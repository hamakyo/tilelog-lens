export function formatRate(value: number | null | undefined): string {
  return value == null ? "-" : `${value.toFixed(2)}%`;
}

export function formatNumber(value: number | null | undefined): string {
  return value == null ? "-" : String(value);
}

export function formatDecimal(value: number | null | undefined): string {
  return value == null ? "-" : value.toFixed(2);
}

export function formatDateTime(value: string): string {
  return value.replace("T", " ").replace(".000Z", " UTC");
}
