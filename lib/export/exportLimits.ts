/** Soft UI confirm threshold — export still proceeds after confirm. */
export const EXPORT_ROW_WARN_THRESHOLD = 100_000;

/** Above this row count UI/API use async export jobs instead of sync GET. */
export const EXPORT_ASYNC_THRESHOLD = 25_000;

/** Excel worksheet max rows including header. */
export const EXCEL_SHEET_MAX_ROWS = 1_048_576;

/** Max data rows per sheet (reserve 1 for header). */
export const EXCEL_SHEET_MAX_DATA_ROWS = EXCEL_SHEET_MAX_ROWS - 1;
