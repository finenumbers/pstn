/** Remove one facet value; supports empty string. */
export function removeArrayFilterValue(values: string[], value: string): string[] {
  return values.filter((v) => v !== value);
}
