"use client";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";

export const ThemeSwitcher = () => {
  const { setTheme, theme } = useTheme();

  const onChangeMode = () => {
    if (theme === "light") {
      return setTheme("dark");
    }
    return setTheme("light");
  };
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onChangeMode}
      className="rounded-full"
      asChild
    >
      <span className="block relative">
        <Moon
          size={20}
          className="rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0"
        />
        <Sun
          size={20}
          className="absolute rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
        />
        <span className="sr-only">Toggle Theme</span>
      </span>
    </Button>
  );
};
