"use client";

import { useState } from "react";
import { cn, formatOptionalAmount, parseOptionalAmountInput } from "@/lib/utils";

const inputClassName =
  "flex h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--input-text)] placeholder:text-[var(--placeholder)] placeholder:italic focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-50";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(inputClassName, className)} {...props} />;
}

type NumberInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> & {
  value: number;
  onChange: (value: number) => void;
};

/** Numeric field: blank when 0, keeps partial typing (e.g. 0.), empty → 0 on blur */
export function NumberInput({ value, onChange, className, onBlur, onFocus, ...props }: NumberInputProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const display = draft ?? formatOptionalAmount(value);

  return (
    <Input
      type="text"
      inputMode="decimal"
      className={className}
      value={display}
      onFocus={(e) => {
        setDraft(formatOptionalAmount(value));
        onFocus?.(e);
      }}
      onChange={(e) => {
        const next = e.target.value;
        setDraft(next);
        onChange(parseOptionalAmountInput(next));
      }}
      onBlur={(e) => {
        setDraft(null);
        onBlur?.(e);
      }}
      {...props}
    />
  );
}

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("text-sm font-medium text-[var(--foreground)]", className)}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(inputClassName, "min-h-[80px]", className)} {...props} />;
}

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(inputClassName, className)} {...props} />;
}
