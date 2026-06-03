type CsvColumn<T> = {
  key: keyof T;
  label: string;
  userControlled?: boolean;
};

const dangerousFormulaPrefix = /^[=+\-@]/;

export function escapeCsvCell(value: unknown, userControlled = false): string {
  if (value == null) return "";

  let text = String(value);
  if (userControlled && dangerousFormulaPrefix.test(text)) {
    text = `'${text}`;
  }

  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

export function buildCsv<T extends object>(
  rows: T[],
  columns: Array<CsvColumn<T>>
): string {
  const header = columns.map((column) => escapeCsvCell(column.label)).join(",");
  const body = rows.map((row) =>
    columns
      .map((column) => escapeCsvCell(row[column.key], column.userControlled))
      .join(",")
  );

  return [header, ...body].join("\n");
}
