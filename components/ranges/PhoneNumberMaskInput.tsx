"use client";

import { useCallback, useRef, type KeyboardEvent } from "react";
import {
  EMPTY_PHONE_SLOT,
  normalizePhoneMask,
  serializePhoneMask,
} from "@/lib/phoneNumberMask";
import { cn } from "@/lib/utils";

const SLOT_COUNT = 10;

interface PhoneNumberMaskInputProps {
  value: string;
  disabled?: boolean;
  onChange?: (value: string) => void;
}

export function PhoneNumberMaskInput({
  value,
  disabled,
  onChange,
}: PhoneNumberMaskInputProps) {
  const slots = normalizePhoneMask(value);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  const emit = useCallback(
    (nextSlots: string[]) => {
      onChange?.(serializePhoneMask(nextSlots));
    },
    [onChange]
  );

  const focusSlot = (index: number) => {
    const el = inputRefs.current[index];
    if (el) {
      el.focus();
      el.select();
    }
  };

  const handleSlotChange = (index: number, raw: string) => {
    const digit = raw.replace(/\D/g, "").slice(-1);
    const next = [...slots];
    next[index] = digit || EMPTY_PHONE_SLOT;
    emit(next);

    if (digit && index < SLOT_COUNT - 1) {
      focusSlot(index + 1);
    }
  };

  const handleKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Backspace" && slots[index] === EMPTY_PHONE_SLOT) {
      event.preventDefault();
      if (index > 0) {
        const next = [...slots];
        next[index - 1] = EMPTY_PHONE_SLOT;
        emit(next);
        focusSlot(index - 1);
      }
      return;
    }

    if (event.key === "ArrowLeft" && index > 0) {
      event.preventDefault();
      focusSlot(index - 1);
      return;
    }

    if (event.key === "ArrowRight" && index < SLOT_COUNT - 1) {
      event.preventDefault();
      focusSlot(index + 1);
    }
  };

  const handlePaste = (event: React.ClipboardEvent) => {
    event.preventDefault();
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, SLOT_COUNT);
    if (!pasted) return;

    const next = [...slots];
    for (let i = 0; i < pasted.length; i++) {
      next[i] = pasted[i];
    }
    emit(next);
    focusSlot(Math.min(pasted.length, SLOT_COUNT - 1));
  };

  const renderSlot = (index: number) => {
    const filled = slots[index] !== EMPTY_PHONE_SLOT;

    return (
    <input
      key={index}
      ref={(el) => {
        inputRefs.current[index] = el;
      }}
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      maxLength={1}
      disabled={disabled}
      value={filled ? slots[index] : ""}
      placeholder="X"
      aria-label={`Цифра ${index + 1}`}
      className={cn(
        "h-[1.8rem] min-w-0 flex-1 rounded border border-input text-center text-[0.9rem] shadow-sm placeholder:text-muted-foreground/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        filled ? "bg-yellow-200/80" : "bg-background"
      )}
      onChange={(event) => handleSlotChange(index, event.target.value)}
      onKeyDown={(event) => handleKeyDown(index, event)}
      onFocus={(event) => event.currentTarget.select()}
    />
    );
  };

  return (
    <div className="w-full min-w-0" onPaste={handlePaste}>
      <div className="flex w-full items-center gap-[1.1px] text-[0.9rem] tabular-nums leading-none">
        <span className="shrink-0 px-0.5 text-2xl font-semibold text-muted-foreground">
          (
        </span>
        {renderSlot(0)}
        {renderSlot(1)}
        {renderSlot(2)}
        <span className="mr-1 shrink-0 px-0.5 text-2xl font-semibold text-muted-foreground">
          )
        </span>
        {renderSlot(3)}
        {renderSlot(4)}
        {renderSlot(5)}
        <span className="shrink-0 px-0.5 text-2xl font-semibold text-muted-foreground">
          -
        </span>
        {renderSlot(6)}
        {renderSlot(7)}
        <span className="shrink-0 px-0.5 text-2xl font-semibold text-muted-foreground">
          -
        </span>
        {renderSlot(8)}
        {renderSlot(9)}
      </div>
    </div>
  );
}
