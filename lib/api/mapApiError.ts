import { API_ERROR_CODES } from "@/lib/api/apiErrorCodes";
import { parseErrorBody } from "@/lib/api/parseErrorBody";

export interface MappedApiError {
  code?: string;
  userMessage: string;
  retryAfterSec?: number;
}

const DEFAULT_MESSAGES: Record<number, string> = {
  400: "Некорректный запрос. Проверьте фильтры и параметры.",
  401: "Доступ запрещён.",
  404: "Запрошенные данные не найдены.",
  429: "Слишком много запросов. Подождите и повторите попытку.",
  500: "Внутренняя ошибка сервера. Попробуйте позже.",
  503: "Сервис временно недоступен. Попробуйте позже.",
};

const CODE_FALLBACKS: Record<string, string> = {
  [API_ERROR_CODES.RATE_LIMITED]:
    "Слишком много запросов. Подождите и повторите попытку.",
  [API_ERROR_CODES.VALIDATION_ERROR]:
    "Некорректные параметры фильтра или сортировки.",
  [API_ERROR_CODES.DATASET_NOT_FOUND]: "Снимок расхождений не найден.",
  [API_ERROR_CODES.EXPORT_TOO_LARGE]:
    "Слишком много строк для экспорта. Сузьте фильтры.",
  [API_ERROR_CODES.INTERNAL_ERROR]:
    "Внутренняя ошибка сервера. Попробуйте позже.",
  [API_ERROR_CODES.UNAUTHORIZED]: "Доступ запрещён.",
  [API_ERROR_CODES.IMPORT_FAILED]: "Не удалось запустить загрузку данных.",
};

function parseRetryAfterHeader(header: string | null | undefined): number | undefined {
  if (!header) return undefined;
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds > 0) return Math.ceil(seconds);
  return undefined;
}

export function mapApiError(
  status: number,
  body: unknown,
  retryAfterHeader?: string | null
): MappedApiError {
  const parsed = parseErrorBody(body);
  const retryAfterSec =
    parsed.retryAfterSec ?? parseRetryAfterHeader(retryAfterHeader);

  if (parsed.code === API_ERROR_CODES.RATE_LIMITED || status === 429) {
    const seconds = retryAfterSec ?? 60;
    return {
      code: API_ERROR_CODES.RATE_LIMITED,
      userMessage: `Слишком много запросов. Повторите через ${seconds} сек.`,
      retryAfterSec: seconds,
    };
  }

  if (parsed.message) {
    return {
      code: parsed.code,
      userMessage: parsed.message,
      retryAfterSec,
    };
  }

  if (parsed.code && CODE_FALLBACKS[parsed.code]) {
    return {
      code: parsed.code,
      userMessage: CODE_FALLBACKS[parsed.code]!,
      retryAfterSec,
    };
  }

  return {
    code: parsed.code,
    userMessage: DEFAULT_MESSAGES[status] ?? `Ошибка запроса (${status}).`,
    retryAfterSec,
  };
}
