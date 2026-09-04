"use client";

import { useTheme } from "next-themes";
import { Sun, Moon, Stars } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/context";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const { t } = useI18n();

  const cycle = () => {
    const order = ["light", "dark", "night"];
    const idx = order.indexOf(theme ?? "light");
    setTheme(order[(idx + 1) % order.length]);
  };

  const icon =
    theme === "dark" ? <Moon size={18} /> :
    theme === "night" ? <Stars size={18} /> :
    <Sun size={18} />;

  const label =
    theme === "dark" ? t.theme.dark :
    theme === "night" ? t.theme.night :
    t.theme.light;

  return (
    <Button variant="ghost" size="icon" onClick={cycle} title={label}>
      {icon}
    </Button>
  );
}

export function LocaleToggle() {
  const { locale, toggleLocale } = useI18n();
  return (
    <Button variant="outline" size="sm" onClick={toggleLocale}>
      {locale === "en" ? "বাংলা" : "EN"}
    </Button>
  );
}
