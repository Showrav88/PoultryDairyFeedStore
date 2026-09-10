"use client";

import { useEffect, useRef, useState } from "react";
import { formatCurrency, cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface AnimatedNumberProps {
  value: number;
  loading?: boolean;
  format?: (n: number) => string;
  duration?: number;
  className?: string;
}

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

export function AnimatedNumber({
  value,
  loading = false,
  format = (n) => Math.round(n).toLocaleString("en-BD"),
  duration = 850,
  className,
}: AnimatedNumberProps) {
  const [display, setDisplay] = useState(0);
  const fromRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (loading) return;

    const from = fromRef.current;
    const to = value;
    const start = performance.now();

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const next = from + (to - from) * easeOutCubic(t);
      setDisplay(next);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = to;
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [value, loading, duration]);

  if (loading) {
    return (
      <Skeleton
        className={cn("h-8 w-28 bg-white/25 dark:bg-white/20", className)}
      />
    );
  }

  return <span className={className}>{format(display)}</span>;
}

export function AnimatedCurrency({
  value,
  loading = false,
  className,
  duration,
}: {
  value: number;
  loading?: boolean;
  className?: string;
  duration?: number;
}) {
  return (
    <AnimatedNumber
      value={value}
      loading={loading}
      duration={duration}
      className={className}
      format={(n) => formatCurrency(Math.round(n * 100) / 100)}
    />
  );
}

export function AnimatedCount({
  value,
  loading = false,
  className,
}: {
  value: number;
  loading?: boolean;
  className?: string;
}) {
  return (
    <AnimatedNumber
      value={value}
      loading={loading}
      className={className}
      format={(n) => Math.round(n).toString()}
    />
  );
}
