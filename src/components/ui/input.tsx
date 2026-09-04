import { cn, formatOptionalAmount, parseOptionalAmountInput } from "@/lib/utils";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "flex h-10 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400/45 placeholder:italic focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-900 dark:text-white dark:placeholder:text-gray-500/40",
        className
      )}
      {...props}
    />
  );
}

type NumberInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> & {
  value: number;
  onChange: (value: number) => void;
};

/** Numeric field: blank when 0, faded placeholder, empty input stored as 0 */
export function NumberInput({ value, onChange, className, ...props }: NumberInputProps) {
  return (
    <Input
      type="text"
      inputMode="decimal"
      className={className}
      value={formatOptionalAmount(value)}
      onChange={(e) => onChange(parseOptionalAmountInput(e.target.value))}
      {...props}
    />
  );
}

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("text-sm font-medium text-gray-700 dark:text-gray-300", className)}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "flex min-h-[80px] w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400/45 placeholder:italic focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white dark:placeholder:text-gray-500/40",
        className
      )}
      {...props}
    />
  );
}
