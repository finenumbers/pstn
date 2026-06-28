import {
  EMPTY_PHONE_SLOT,
  isPhoneMaskEmpty,
  parsePhoneNumberMask,
} from "@/lib/phoneNumberMask";
import { isAllSubscriberDigitsFixed } from "@/packages/db/queries/phoneNumberMatchCount";
import type { FiltersDTO } from "@/packages/shared/contracts/filters.schema";

export interface PhoneFilterTimingMeta {
  hasPhoneFilter: boolean;
  phoneFixedAbcDigits?: number;
  phoneFixedSubscriberDigits?: number;
  isFullSubscriber?: boolean;
}

/** Metadata for API timing logs when a phone mask filter is active. */
export function phoneFilterTimingMeta(filters: FiltersDTO): PhoneFilterTimingMeta {
  if (isPhoneMaskEmpty(filters.phoneNumber)) {
    return { hasPhoneFilter: false };
  }

  const parts = parsePhoneNumberMask(filters.phoneNumber);
  if (!parts) {
    return { hasPhoneFilter: false };
  }

  return {
    hasPhoneFilter: true,
    phoneFixedAbcDigits: parts.abcSlots.filter(
      (slot) => slot !== EMPTY_PHONE_SLOT
    ).length,
    phoneFixedSubscriberDigits: parts.subscriberSlots.filter(
      (slot) => slot !== EMPTY_PHONE_SLOT
    ).length,
    isFullSubscriber: isAllSubscriberDigitsFixed(parts),
  };
}
