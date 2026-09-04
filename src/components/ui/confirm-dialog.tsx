"use client";

import { useState } from "react";
import { Button } from "./button";
import { useI18n } from "@/lib/i18n/context";

interface ConfirmDialogProps {
  open: boolean;
  title?: string;
  message?: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export function ConfirmDialog({
  open,
  title,
  message,
  onConfirm,
  onCancel,
  loading,
}: ConfirmDialogProps) {
  const { t } = useI18n();
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center p-3 pb-[calc(.75rem+env(safe-area-inset-bottom))] sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />
      <div className="relative z-10 w-full max-w-md rounded-2xl bg-white p-5 shadow-xl dark:bg-gray-900 sm:p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          {title ?? t.common.confirm}
        </h3>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          {message ?? t.common.confirmMessage}
        </p>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:flex sm:justify-end">
          <Button className="min-h-12" variant="outline" onClick={onCancel} disabled={loading}>
            {t.common.no}
          </Button>
          <Button className="min-h-12" onClick={onConfirm} disabled={loading}>
            {loading ? t.common.loading : t.common.yes}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function useConfirmDialog() {
  const [state, setState] = useState<{
    open: boolean;
    title?: string;
    message?: string;
    onConfirm: () => void;
  }>({ open: false, onConfirm: () => {} });

  const confirm = (
    onConfirm: () => void,
    options?: { title?: string; message?: string }
  ) => {
    setState({ open: true, onConfirm, ...options });
  };

  const close = () => setState((s) => ({ ...s, open: false }));

  return { state, confirm, close };
}
