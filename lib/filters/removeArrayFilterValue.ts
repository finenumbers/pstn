/** Remove one facet value; supports empty string (e.g. settlement «Не указан»). */
export function removeArrayFilterValue(values: string[], value: string): string[] {
  return values.filter((v) => v !== value);
}
