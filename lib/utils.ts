import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat("ru-RU").format(n);
}

/** Формат XXX-XX-XX, заполнение справа налево: 888290 → 088-82-90, 0 → 000-00-00 */
export function formatRangeSegment(value: number): string {
  const n = Math.max(0, Math.floor(value));
  const last2 = n % 100;
  const mid2 = Math.floor(n / 100) % 100;
  const first3 = Math.floor(n / 10000);
  return `${String(first3).padStart(3, "0")}-${String(mid2).padStart(2, "0")}-${String(last2).padStart(2, "0")}`;
}
