/** Neutralize Excel formula injection for string cell values. */
export function sanitizeSpreadsheetCell(
  value: string | number | null | undefined
): string | number {
  if (value == null) return "";
  if (typeof value === "number") return value;
  const text = String(value);
  if (/^[=+\-@]/.test(text) || /^\t/.test(text)) {
    return `'${text}`;
  }
  return text;
}
