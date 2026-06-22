/** Label for rows / facet values with empty settlement in the UI. */
export const EMPTY_SETTLEMENT_LABEL = "Не указан";

export function formatSettlementDisplay(value: string): string {
  return value || EMPTY_SETTLEMENT_LABEL;
}
