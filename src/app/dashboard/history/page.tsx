"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/context";
import { formatDateTime } from "@/lib/utils";

interface AuditLog {
  id: string;
  entity: string;
  action: string;
  summary: string;
  createdAt: string;
  updatedAt: string;
}

export default function HistoryPage() {
  const { t, locale } = useI18n();
  const [logs, setLogs] = useState<AuditLog[]>([]);

  useEffect(() => {
    fetch("/api/analytics?period=year")
      .then((r) => r.json())
      .then((d) => setLogs(d.logs ?? []));
  }, []);

  const actionColor = (action: string) => {
    switch (action) {
      case "CREATE": return "bg-emerald-100 text-emerald-700";
      case "UPDATE": return "bg-blue-100 text-blue-700";
      case "DELETE": return "bg-red-100 text-red-700";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{t.history.title}</h1>

      <div className="space-y-3">
        {logs.map((log) => {
          const wasEdited = log.updatedAt !== log.createdAt;
          return (
            <div key={log.id} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <p className="font-medium text-sm">{log.summary}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${actionColor(log.action)}`}>
                      {log.action}
                    </span>
                    <span className="text-xs text-gray-500">{log.entity}</span>
                    {wasEdited && (
                      <span className="text-xs text-orange-500">{t.history.edited}</span>
                    )}
                  </div>
                </div>
                <div className="text-right text-xs text-gray-500 whitespace-nowrap">
                  <p>{formatDateTime(log.createdAt, locale)}</p>
                  {wasEdited && (
                    <p className="text-orange-500 mt-0.5">
                      Updated: {formatDateTime(log.updatedAt, locale)}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {logs.length === 0 && (
          <p className="text-center text-gray-500 py-12">{t.common.noData}</p>
        )}
      </div>
    </div>
  );
}
