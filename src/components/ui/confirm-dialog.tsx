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
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />
      <div className="relative z-10 w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-gray-900">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          {title ?? t.common.confirm}
        </h3>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          {message ?? t.common.confirmMessage}
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="outline" onClick={onCancel} disabled={loading}>
            {t.common.no}
          </Button>
          <Button onClick={onConfirm} disabled={loading}>
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
