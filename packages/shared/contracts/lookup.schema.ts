import { z } from "zod";
import { parseLookupSearchPhone } from "@/lib/phoneNumberMask";
import type { NumberRangeRow } from "./filters.schema";

export const LOOKUP_SEARCH_PAGE_SIZE_MAX = 100;

export const lookupQuerySchema = z.object({
  phone: z
    .string()
    .regex(/^\d{10}$/, "Phone must be exactly 10 digits"),
});

export type LookupQuery = z.infer<typeof lookupQuerySchema>;

export const lookupSearchQuerySchema = z.object({
  phone: z.string().min(1, "Phone mask is required"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(LOOKUP_SEARCH_PAGE_SIZE_MAX)
    .default(50),
});

export type LookupSearchQuery = z.infer<typeof lookupSearchQuerySchema>;

export function parseLookupSearchQuery(input: unknown):
  | { success: true; data: LookupSearchQuery & { normalized: string; display: string } }
  | { success: false; error: z.ZodError } {
  const parsed = lookupSearchQuerySchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error };
  }

  const phone = parseLookupSearchPhone(parsed.data.phone);
  if (!phone) {
    return {
      success: false,
      error: new z.ZodError([
        {
          code: z.ZodIssueCode.custom,
          message: "Invalid phone mask",
          path: ["phone"],
        },
      ]),
    };
  }

  return {
    success: true,
    data: {
      ...parsed.data,
      normalized: phone.normalized,
      display: phone.display,
    },
  };
}

export interface LookupSuccessResponse {
  found: true;
  phone: string;
  data: NumberRangeRow;
}

export interface LookupNotFoundResponse {
  found: false;
  phone: string;
}

export type LookupResponse = LookupSuccessResponse | LookupNotFoundResponse;

export interface LookupSearchResponse {
  phone: string;
  data: NumberRangeRow[];
  meta: {
    page: number;
    pageSize: number;
    totalRows: number;
    hasMore: boolean;
  };
}
