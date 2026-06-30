const STALE_IMPORT_PATTERN =
  /import interrupted by server restart or timeout/i;

const VALIDATION_PATTERNS: Array<{ pattern: RegExp; message: string }> = [
  {
    pattern: /full import validation failed/i,
    message:
      "Не все обязательные файлы Минцифры загружены или данные неполные. Попробуйте позже.",
  },
  {
    pattern: /skipped .* of .* csv data rows/i,
    message:
      "При загрузке CSV пропущены строки данных. Попробуйте запустить загрузку снова.",
  },
  {
    pattern: /failed to download/i,
    message:
      "Не удалось скачать файл с opendata.digital.gov.ru. Проверьте доступность источника и повторите попытку.",
  },
];

/**
 * Maps stored import job errorMessage (often English) to user-facing Russian text.
 */
export function mapImportErrorMessage(
  errorMessage: string | null | undefined
): string | null {
  if (!errorMessage?.trim()) return null;

  const trimmed = errorMessage.trim();

  if (STALE_IMPORT_PATTERN.test(trimmed)) {
    return "Загрузка прервана из‑за перезапуска сервера или превышения времени ожидания. Текущие данные в таблице не изменены.";
  }

  for (const { pattern, message } of VALIDATION_PATTERNS) {
    if (pattern.test(trimmed)) {
      return message;
    }
  }

  if (/^[А-Яа-яЁё]/.test(trimmed)) {
    return trimmed;
  }

  return "Загрузка не завершена. Текущие данные в таблице не изменены. Попробуйте снова или обратитесь к администратору.";
}
