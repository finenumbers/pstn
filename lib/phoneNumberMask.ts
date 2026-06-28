export const PHONE_MASK_LENGTH = 10;
export const EMPTY_PHONE_SLOT = "_";

export interface PhoneNumberMaskParts {
  slots: string[];
  abcSlots: string[];
  subscriberSlots: string[];
  subscriberMin: number;
  subscriberMax: number;
}

export function normalizePhoneMask(value: string): string[] {
  if (value && !value.includes(EMPTY_PHONE_SLOT) && /^\d+$/.test(value)) {
    const digits = value.slice(-10);
    const slots = Array(PHONE_MASK_LENGTH).fill(EMPTY_PHONE_SLOT);
    const numberLen = Math.min(7, digits.length);
    const subscriberStart = 3 + (7 - numberLen);
    const abcLen = digits.length - numberLen;
    for (let i = 0; i < abcLen; i++) {
      slots[i] = digits[i];
    }
    for (let i = 0; i < numberLen; i++) {
      slots[subscriberStart + i] = digits[abcLen + i];
    }
    return slots;
  }

  const chars = value
    .padEnd(PHONE_MASK_LENGTH, EMPTY_PHONE_SLOT)
    .slice(0, PHONE_MASK_LENGTH)
    .split("");

  return chars.map((char) =>
    /\d/.test(char) ? char : EMPTY_PHONE_SLOT
  );
}

export function serializePhoneMask(slots: string[]): string {
  return slots.join("");
}

export function isPhoneMaskEmpty(value: string): boolean {
  return normalizePhoneMask(value).every((slot) => slot === EMPTY_PHONE_SLOT);
}

/** Strip formatting and map API wildcards (X) to internal `_` slots. */
export function normalizePhoneMaskQuery(input: string): string | null {
  const stripped = input
    .trim()
    .replace(/[\s()-]/g, "")
    .replace(/[Xx]/g, EMPTY_PHONE_SLOT);

  if (!stripped) return null;

  const serialized = serializePhoneMask(normalizePhoneMask(stripped));
  if (isPhoneMaskEmpty(serialized)) return null;
  if (!parsePhoneNumberMask(serialized)) return null;
  return serialized;
}

/** External API display: `_` wildcards shown as `X`. */
export function formatPhoneMaskForApi(serialized: string): string {
  return serialized.replace(/_/g, "X");
}

export function parseLookupSearchPhone(
  raw: string
): { normalized: string; display: string } | null {
  const normalized = normalizePhoneMaskQuery(raw);
  if (!normalized) return null;
  return {
    normalized,
    display: formatPhoneMaskForApi(normalized),
  };
}

/** Visual hint: (XXX) XXX-XX-XX — X for empty slots */
export function formatPhoneMaskHint(slots: string[]): string {
  const d = (index: number) =>
    slots[index] === EMPTY_PHONE_SLOT ? "X" : slots[index];
  return `(${d(0)}${d(1)}${d(2)}) ${d(3)}${d(4)}${d(5)}-${d(6)}${d(7)}-${d(8)}${d(9)}`;
}

export function formatPhoneMaskValue(slots: string[]): string {
  const d = (index: number) =>
    slots[index] === EMPTY_PHONE_SLOT ? "" : slots[index];
  const abc = `${d(0)}${d(1)}${d(2)}`;
  const sub = `${d(3)}${d(4)}${d(5)}${d(6)}${d(7)}${d(8)}${d(9)}`;
  if (!abc && !sub) return "";
  if (!abc) return sub;
  if (!sub) return abc;
  return `${abc} ${sub}`;
}

export function parsePhoneNumberMask(value: string): PhoneNumberMaskParts | null {
  const slots = normalizePhoneMask(value);
  if (isPhoneMaskEmpty(serializePhoneMask(slots))) return null;

  const abcSlots = slots.slice(0, 3);
  const subscriberSlots = slots.slice(3, 10);

  const minDigits = [0, 0, 0, 0, 0, 0, 0];
  const maxDigits = [9, 9, 9, 9, 9, 9, 9];

  for (let index = 0; index < 7; index++) {
    const slot = subscriberSlots[index];
    if (slot !== EMPTY_PHONE_SLOT) {
      const digit = Number(slot);
      minDigits[index] = digit;
      maxDigits[index] = digit;
    }
  }

  let subscriberMin = 0;
  let subscriberMax = 0;
  for (let index = 0; index < 7; index++) {
    const power = 10 ** (6 - index);
    subscriberMin += minDigits[index] * power;
    subscriberMax += maxDigits[index] * power;
  }

  return {
    slots,
    abcSlots,
    subscriberSlots,
    subscriberMin,
    subscriberMax,
  };
}

/** Count of subscriber numbers in [start, end] matching positional mask slots. */
export function countMatchingNumbersInRange(
  start: number,
  end: number,
  parts: PhoneNumberMaskParts
): number {
  if (start > end) return 0;

  let first = start;
  let last = end;

  for (let index = 0; index < 7; index++) {
    const slot = parts.subscriberSlots[index];
    if (slot === EMPTY_PHONE_SLOT) continue;

    const digit = Number(slot);
    first = Math.max(first, subscriberDigitFirstInRange(first, index, digit));
    last = Math.min(last, subscriberDigitLastInRange(last, index, digit));
  }

  if (first > last) return 0;

  let maxFreeIndex = -1;
  for (let index = 0; index < 7; index++) {
    if (parts.subscriberSlots[index] === EMPTY_PHONE_SLOT) {
      maxFreeIndex = index;
    }
  }

  if (maxFreeIndex === -1) {
    return first <= last ? 1 : 0;
  }

  const step = 10 ** (6 - maxFreeIndex);
  return Math.floor((last - first) / step) + 1;
}

/** Whether [start, end] contains a subscriber number matching positional mask slots. */
export function rangeMatchesPhoneMask(
  start: number,
  end: number,
  parts: PhoneNumberMaskParts
): boolean {
  if (start > end) return false;

  let first = start;
  let last = end;

  for (let index = 0; index < 7; index++) {
    const slot = parts.subscriberSlots[index];
    if (slot === EMPTY_PHONE_SLOT) continue;

    const digit = Number(slot);
    first = Math.max(first, subscriberDigitFirstInRange(first, index, digit));
    last = Math.min(last, subscriberDigitLastInRange(last, index, digit));
  }

  return first <= last;
}

function subscriberDigitBounds(index: number, digit: number): { low: number; high: number } {
  const base = 10 ** (6 - index);
  return { low: digit * base, high: digit * base + base - 1 };
}

function subscriberDigitFirstInRange(start: number, index: number, digit: number): number {
  const pow = 10 ** (6 - index);
  const blockStep = 10 * pow;
  const offset = digit * pow;

  if (index === 0) {
    const { low } = subscriberDigitBounds(index, digit);
    return Math.max(start, low);
  }

  const div = Math.floor(start / blockStep);
  const rem = start - div * blockStep;

  if (rem >= offset && rem < offset + pow) {
    return start;
  }
  if (rem < offset) {
    return div * blockStep + offset;
  }
  return (div + 1) * blockStep + offset;
}

function subscriberDigitLastInRange(end: number, index: number, digit: number): number {
  const pow = 10 ** (6 - index);
  const blockStep = 10 * pow;
  const offset = digit * pow;

  if (index === 0) {
    const { high } = subscriberDigitBounds(index, digit);
    return Math.min(end, high);
  }

  const div = Math.floor(end / blockStep);
  const rem = end - div * blockStep;

  if (rem >= offset && rem < offset + pow) {
    return end;
  }
  if (rem < offset) {
    return Math.min(end, (div - 1) * blockStep + offset + pow - 1);
  }
  return div * blockStep + offset + pow - 1;
}

export function abcMatchesPhoneMask(abc: string, parts: PhoneNumberMaskParts): boolean {
  if (abc.length !== 3) return false;
  for (let index = 0; index < 3; index++) {
    const slot = parts.abcSlots[index];
    if (slot !== EMPTY_PHONE_SLOT && abc[index] !== slot) return false;
  }
  return true;
}

const ABC_MASK_EXPAND_LIMIT = 1000;

/** Expand partial ABC mask slots into concrete codes for index-friendly IN filters. */
export function expandAbcMask(abcSlots: string[]): string[] | null {
  if (abcSlots.length !== 3) return null;

  const allWildcard = abcSlots.every((slot) => slot === EMPTY_PHONE_SLOT);
  if (allWildcard) return null;

  const allFixed = abcSlots.every((slot) => slot !== EMPTY_PHONE_SLOT);
  if (allFixed) {
    return [abcSlots.join("")];
  }

  const codes: string[] = [];

  function expandAt(index: number, prefix: string) {
    if (index === 3) {
      codes.push(prefix);
      return;
    }

    const slot = abcSlots[index];
    if (slot !== EMPTY_PHONE_SLOT) {
      expandAt(index + 1, prefix + slot);
      return;
    }

    for (let digit = 0; digit <= 9; digit++) {
      expandAt(index + 1, prefix + String(digit));
    }
  }

  expandAt(0, "");
  return codes.length <= ABC_MASK_EXPAND_LIMIT ? codes : null;
}
